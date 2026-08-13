// ==========================================
// Test: Equipments CRUD + soft-delete + transaction rollback
// Evidence: server/index.js:308-489 (POST/PUT/DELETE /api/equipments)
//
// Ghi chú về "transaction rollback": tất cả các nhánh validate (device_type_id
// giả, status sai enum, xoá thiết bị không tồn tại) đều return SỚM (early
// return) TRƯỚC khi vào db.transaction(...) (xem index.js:341-345, 416-421,
// 467-468) -> đường code hiện tại không bao giờ throw GIỮA transaction với
// input hợp lệ đã qua validate. Cách kiểm chứng "không phát sinh log rác"
// đúng với thực tế code là: đếm số dòng asset_transfer_logs TRƯỚC/SAU mỗi
// request bị từ chối (400/404) và khẳng định KHÔNG đổi.
// ==========================================
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, waitForServer, cleanupDbFiles, closeServer } = require('./helpers/serverHarness');
const { seedMinimalOrg, seedUser } = require('./helpers/fixtures');

const PORT = 5902;
const MGR_HRM = 'EQ_MGR';
const MGR_PASS = 'Manager@123';

let ctx;
let fixtures;
let mgrToken;

before(async () => {
  ctx = startTestServer({ port: PORT, dbFileName: `ccdc-test-equipments-${Date.now()}.db` });
  await waitForServer(ctx.baseUrl);
  fixtures = seedMinimalOrg(ctx.db);
  seedUser(ctx.db, { hrmCode: MGR_HRM, fullName: 'Equipments Manager', role: 'ADMIN', password: MGR_PASS });

  const loginRes = await fetch(`${ctx.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hrm_code: MGR_HRM, password: MGR_PASS })
  });
  mgrToken = (await loginRes.json()).token;
});

after(async () => {
  await closeServer(ctx.server);
  cleanupDbFiles(ctx.testDbPath, ctx.db);
});

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${mgrToken}` };
}

function totalLogCount() {
  return ctx.db.prepare('SELECT COUNT(*) c FROM asset_transfer_logs').get().c;
}

function logCountFor(equipmentId) {
  return ctx.db.prepare('SELECT COUNT(*) c FROM asset_transfer_logs WHERE equipment_id = ?').get(equipmentId).c;
}

test('POST hợp lệ -> 201, phát sinh đúng 1 log CREATE', async () => {
  const res = await fetch(`${ctx.baseUrl}/api/equipments`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ device_type_id: fixtures.deviceTypeId, post_office_id: fixtures.postOfficeId, hostname: 'PC-001' })
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.ok(body.id);
  assert.equal(logCountFor(body.id), 1);
});

test('POST thiếu device_type_id -> 400', async () => {
  const res = await fetch(`${ctx.baseUrl}/api/equipments`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ post_office_id: fixtures.postOfficeId })
  });
  assert.equal(res.status, 400);
});

test('POST thiếu post_office_id -> 400', async () => {
  const res = await fetch(`${ctx.baseUrl}/api/equipments`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ device_type_id: fixtures.deviceTypeId })
  });
  assert.equal(res.status, 400);
});

test('POST với device_type_id giả (không tồn tại) -> 400, không phát sinh log rác', async () => {
  const before_ = totalLogCount();
  const res = await fetch(`${ctx.baseUrl}/api/equipments`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ device_type_id: 'khong-ton-tai-xxx', post_office_id: fixtures.postOfficeId })
  });
  assert.equal(res.status, 400);
  assert.equal(totalLogCount(), before_, 'request lỗi trước khi vào transaction -> tổng số log không được đổi');
});

test('POST với post_office_id giả (không tồn tại) -> 400, không phát sinh log rác', async () => {
  const before_ = totalLogCount();
  const res = await fetch(`${ctx.baseUrl}/api/equipments`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ device_type_id: fixtures.deviceTypeId, post_office_id: 'khong-ton-tai-xxx' })
  });
  assert.equal(res.status, 400);
  assert.equal(totalLogCount(), before_);
});

test('POST hostname > 255 ký tự -> 400', async () => {
  const res = await fetch(`${ctx.baseUrl}/api/equipments`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ device_type_id: fixtures.deviceTypeId, post_office_id: fixtures.postOfficeId, hostname: 'A'.repeat(256) })
  });
  assert.equal(res.status, 400);
});

test('POST hostname = 255 ký tự (biên hợp lệ) -> 201', async () => {
  const res = await fetch(`${ctx.baseUrl}/api/equipments`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ device_type_id: fixtures.deviceTypeId, post_office_id: fixtures.postOfficeId, hostname: 'B'.repeat(255) })
  });
  assert.equal(res.status, 201);
});

// Chuỗi vòng đời stateful: gộp vào 1 test tuần tự (đảm bảo thứ tự tuyệt đối,
// không phụ thuộc cách node:test lập lịch các test độc lập).
test('vòng đời: create -> PUT status sai enum (400) -> PUT status hợp lệ (200) -> DELETE (200) -> list/detail không còn thấy -> DELETE lần 2 (404)', async () => {
  // 1. create
  const createRes = await fetch(`${ctx.baseUrl}/api/equipments`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ device_type_id: fixtures.deviceTypeId, post_office_id: fixtures.postOfficeId, hostname: 'PC-LIFECYCLE' })
  });
  assert.equal(createRes.status, 201);
  const { id: eqId } = await createRes.json();
  assert.equal(logCountFor(eqId), 1, 'sau create phải có đúng 1 log (CREATE)');

  // 2. PUT status sai enum -> 400, không phát sinh log rác
  const beforeInvalidPut = logCountFor(eqId);
  const invalidPutRes = await fetch(`${ctx.baseUrl}/api/equipments/${eqId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ status: 'KHONG_HOP_LE' })
  });
  assert.equal(invalidPutRes.status, 400);
  assert.equal(logCountFor(eqId), beforeInvalidPut, 'status sai enum bị chặn trước transaction -> log không tăng');

  // 3. PUT status hợp lệ -> 200, log tăng thêm 1 (UPDATE)
  const validPutRes = await fetch(`${ctx.baseUrl}/api/equipments/${eqId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ status: 'MAINTENANCE' })
  });
  assert.equal(validPutRes.status, 200);
  assert.equal(logCountFor(eqId), beforeInvalidPut + 1);

  // Xác nhận status đã đổi qua GET detail
  const detailAfterPut = await (await fetch(`${ctx.baseUrl}/api/equipments/${eqId}`)).json();
  assert.equal(detailAfterPut.status, 'MAINTENANCE');

  // 4. DELETE (soft-delete) -> 200
  const beforeDeleteLogs = logCountFor(eqId);
  const deleteRes = await fetch(`${ctx.baseUrl}/api/equipments/${eqId}`, { method: 'DELETE', headers: authHeaders() });
  assert.equal(deleteRes.status, 200);
  assert.equal(logCountFor(eqId), beforeDeleteLogs + 1, 'delete thành công phải thêm đúng 1 log (DELETE)');

  // 5. GET list -> không còn thấy thiết bị đã xoá
  const listRes = await fetch(`${ctx.baseUrl}/api/equipments?limit=200`);
  const listBody = await listRes.json();
  assert.equal(listBody.items.some((it) => it.id === eqId), false, 'thiết bị đã soft-delete không được xuất hiện trong list');

  // 6. GET detail -> 404
  const detailRes = await fetch(`${ctx.baseUrl}/api/equipments/${eqId}`);
  assert.equal(detailRes.status, 404);

  // 7. DELETE lần 2 -> 404, không phát sinh thêm log DELETE (không có log rác)
  const beforeSecondDelete = logCountFor(eqId);
  const secondDeleteRes = await fetch(`${ctx.baseUrl}/api/equipments/${eqId}`, { method: 'DELETE', headers: authHeaders() });
  assert.equal(secondDeleteRes.status, 404);
  assert.equal(logCountFor(eqId), beforeSecondDelete, 'xoá thiết bị đã xoá trước đó không được ghi thêm log');

  // 8. PUT sau khi đã xoá -> 404 (route PUT cũng loại trừ thiết bị soft-delete)
  const putAfterDeleteRes = await fetch(`${ctx.baseUrl}/api/equipments/${eqId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ status: 'IN_STOCK' })
  });
  assert.equal(putAfterDeleteRes.status, 404);
});

test('DELETE thiết bị không tồn tại (id ngẫu nhiên) -> 404', async () => {
  const res = await fetch(`${ctx.baseUrl}/api/equipments/khong-bao-gio-ton-tai`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  assert.equal(res.status, 404);
});

// ==========================================
// Lược đồ mã CCDC mới: <PREFIX>-<YY>-<seq 3 chữ số>, tăng riêng theo (prefix, năm).
// (feat/asset-tag-scheme)
// ==========================================
async function createEq(body) {
  const res = await fetch(`${ctx.baseUrl}/api/equipments`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body)
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* no body */ }
  return { status: res.status, body: data };
}

test('asset_tag mới: sinh đúng <PREFIX>-<YY>-001, 002 tăng dần theo cùng (prefix, năm)', async () => {
  const yy = String(2024).slice(-2); // dùng năm cố định để test số thứ tự ổn định
  const a = await createEq({ device_type_id: fixtures.deviceTypeId, post_office_id: fixtures.postOfficeId, purchase_year: 2024 });
  assert.equal(a.status, 201);
  assert.equal(a.body.asset_tag, `${fixtures.assetPrefix}-${yy}-001`);

  const b = await createEq({ device_type_id: fixtures.deviceTypeId, post_office_id: fixtures.postOfficeId, purchase_year: 2024 });
  assert.equal(b.status, 201);
  assert.equal(b.body.asset_tag, `${fixtures.assetPrefix}-${yy}-002`);
});

test('asset_tag mới: năm mua KHÁC thì số thứ tự bắt đầu lại từ 001 (không cộng dồn chung)', async () => {
  const yy25 = String(2025).slice(-2);
  const c = await createEq({ device_type_id: fixtures.deviceTypeId, post_office_id: fixtures.postOfficeId, purchase_year: 2025 });
  assert.equal(c.status, 201);
  assert.equal(c.body.asset_tag, `${fixtures.assetPrefix}-${yy25}-001`, 'năm khác phải bắt đầu lại từ 001');
});

test('asset_tag mới: không nhập purchase_year -> dùng năm hiện tại', async () => {
  const yyNow = String(new Date().getFullYear()).slice(-2);
  const d = await createEq({ device_type_id: fixtures.deviceTypeId, post_office_id: fixtures.postOfficeId });
  assert.equal(d.status, 201);
  assert.ok(
    d.body.asset_tag.startsWith(`${fixtures.assetPrefix}-${yyNow}-`),
    `asset_tag phải bắt đầu bằng ${fixtures.assetPrefix}-${yyNow}- khi không nhập năm, nhận: ${d.body.asset_tag}`
  );
});

test('POST equipments với danh mục CHƯA có asset_prefix -> 400 thông báo rõ ràng', async () => {
  // Tạo 1 device_type không có asset_prefix (chèn thẳng DB, mô phỏng danh mục chưa cấu hình).
  const { uid } = require('./helpers/fixtures');
  const noPrefixTypeId = uid();
  ctx.db.prepare("INSERT INTO device_types (id, code, name, asset_prefix) VALUES (?, ?, ?, NULL)")
    .run(noPrefixTypeId, 'NOPREFIX_TYPE', 'Danh Mục Chưa Cấu Hình');

  const res = await createEq({ device_type_id: noPrefixTypeId, post_office_id: fixtures.postOfficeId });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /tiền tố mã CCDC/i);
});

test('PUT equipments: đổi device_type_id KHÔNG đổi lại asset_tag đã có', async () => {
  const created = await createEq({ device_type_id: fixtures.deviceTypeId, post_office_id: fixtures.postOfficeId, purchase_year: 2024 });
  assert.equal(created.status, 201);
  const originalTag = created.body.asset_tag;

  // Tạo device_type thứ 2 (có prefix khác) để đổi sang.
  const { uid } = require('./helpers/fixtures');
  const otherTypeId = uid();
  ctx.db.prepare("INSERT INTO device_types (id, code, name, asset_prefix) VALUES (?, ?, ?, ?)")
    .run(otherTypeId, 'OTHER_TYPE', 'Loại Khác', 'OTH');

  const putRes = await fetch(`${ctx.baseUrl}/api/equipments/${created.body.id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ device_type_id: otherTypeId, model: 'Model Moi', purchase_year: 2027 })
  });
  assert.equal(putRes.status, 200);

  const row = ctx.db.prepare('SELECT asset_tag, device_type_id, model, purchase_year FROM equipments WHERE id = ?').get(created.body.id);
  assert.equal(row.asset_tag, originalTag, 'asset_tag KHÔNG được đổi khi đổi loại thiết bị');
  assert.equal(row.device_type_id, otherTypeId, 'device_type_id phải được cập nhật');
  assert.equal(row.model, 'Model Moi', 'model phải được cập nhật');
  assert.equal(row.purchase_year, 2027, 'purchase_year phải được cập nhật');
});
