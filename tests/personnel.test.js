// ==========================================
// Test: Personnel API (server/index.js — PERSONNEL API section)
// Evidence: GET/POST /api/personnel, PUT /api/personnel/:id,
// POST /api/personnel/import, GET /api/personnel/search.
// Thay thế tests/hrm.test.js (đã xoá cùng route POST /api/hrm/upload-and-map).
// Cũng phủ 2 thay đổi liên quan: GET /api/users chỉ trả tài khoản có
// password_hash; POST/PUT /api/equipments nhận assigned_user_id.
// ==========================================
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, waitForServer, cleanupDbFiles, closeServer } = require('./helpers/serverHarness');
const { seedMinimalOrg, seedUser } = require('./helpers/fixtures');

const PORT = 5903;
const MGR_HRM = 'PERSONNEL_MGR';
const MGR_PASS = 'Manager@123';
const STAFF_HRM = 'PERSONNEL_STAFF';
const STAFF_PASS = 'Staff@123';

let ctx;
let fixtures;
let mgrToken;
let staffToken;

before(async () => {
  ctx = startTestServer({ port: PORT, dbFileName: `ccdc-test-personnel-${Date.now()}.db` });
  await waitForServer(ctx.baseUrl);
  fixtures = seedMinimalOrg(ctx.db);
  seedUser(ctx.db, { hrmCode: MGR_HRM, fullName: 'Personnel Manager', role: 'ADMIN', password: MGR_PASS });
  seedUser(ctx.db, { hrmCode: STAFF_HRM, fullName: 'Personnel Staff', role: 'STAFF', password: STAFF_PASS });

  mgrToken = (await login(MGR_HRM, MGR_PASS)).body.token;
  staffToken = (await login(STAFF_HRM, STAFF_PASS)).body.token;
});

after(async () => {
  await closeServer(ctx.server);
  cleanupDbFiles(ctx.testDbPath, ctx.db);
});

async function login(hrm_code, password) {
  const res = await fetch(`${ctx.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hrm_code, password })
  });
  return { status: res.status, body: await res.json() };
}

async function call(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${ctx.baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* no body */ }
  return { status: res.status, body: data };
}

function userCount() {
  return ctx.db.prepare('SELECT COUNT(*) c FROM users').get().c;
}

// ==========================================
// GET /api/personnel
// ==========================================

test('GET /api/personnel không có token -> 401', async () => {
  const res = await fetch(`${ctx.baseUrl}/api/personnel`);
  assert.equal(res.status, 401);
});

test('GET /api/personnel role STAFF -> 403', async () => {
  const { status } = await call('GET', '/api/personnel', { token: staffToken });
  assert.equal(status, 403);
});

test('GET /api/personnel role quản lý -> 200, trả pagination + items', async () => {
  const { status, body } = await call('GET', '/api/personnel', { token: mgrToken });
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.items));
  assert.ok(body.pagination);
  assert.equal(body.pagination.page, 1);
});

// ==========================================
// POST /api/personnel
// ==========================================

test('POST /api/personnel role STAFF -> 403', async () => {
  const { status } = await call('POST', '/api/personnel', {
    token: staffToken,
    body: { hrm_code: 'SHOULD_FAIL', full_name: 'X' }
  });
  assert.equal(status, 403);
});

test('POST /api/personnel thiếu hrm_code -> 400', async () => {
  const { status } = await call('POST', '/api/personnel', {
    token: mgrToken,
    body: { full_name: 'Không có mã' }
  });
  assert.equal(status, 400);
});

test('POST /api/personnel thiếu full_name -> 400', async () => {
  const { status } = await call('POST', '/api/personnel', {
    token: mgrToken,
    body: { hrm_code: 'NO_NAME' }
  });
  assert.equal(status, 400);
});

test('POST /api/personnel hợp lệ -> 201, KHÔNG set role/password_hash', async () => {
  const { status, body } = await call('POST', '/api/personnel', {
    token: mgrToken,
    body: { hrm_code: 'PER_001', full_name: 'Nhan Su Moi', post_office_code: fixtures.postOfficeCode, commune_code: fixtures.communeCode }
  });
  assert.equal(status, 201);
  assert.ok(body.id);

  const row = ctx.db.prepare('SELECT role, password_hash FROM users WHERE id = ?').get(body.id);
  assert.equal(row.password_hash, null, 'nhân sự thêm qua /api/personnel không được có password_hash');
  assert.equal(row.role, 'STAFF', 'role mặc định của schema (không được route personnel gán riêng)');
});

test('POST /api/personnel trùng hrm_code -> 400', async () => {
  const { status } = await call('POST', '/api/personnel', {
    token: mgrToken,
    body: { hrm_code: 'PER_001', full_name: 'Trung Ma HRM' }
  });
  assert.equal(status, 400);
});

// ==========================================
// PUT /api/personnel/:id
// ==========================================

test('PUT /api/personnel/:id role STAFF -> 403', async () => {
  const { body: created } = await call('POST', '/api/personnel', {
    token: mgrToken,
    body: { hrm_code: 'PUT_TARGET_01', full_name: 'Se Bi Sua' }
  });
  const { status } = await call('PUT', `/api/personnel/${created.id}`, {
    token: staffToken,
    body: { full_name: 'Sua Boi Staff' }
  });
  assert.equal(status, 403);
});

test('PUT /api/personnel/:id không tồn tại -> 404', async () => {
  const { status } = await call('PUT', '/api/personnel/khong-ton-tai', {
    token: mgrToken,
    body: { full_name: 'X' }
  });
  assert.equal(status, 404);
});

test('PUT /api/personnel/:id hợp lệ -> 200, cập nhật đúng 4 field', async () => {
  const { body: created } = await call('POST', '/api/personnel', {
    token: mgrToken,
    body: { hrm_code: 'PUT_TARGET_02', full_name: 'Ten Cu' }
  });

  const { status } = await call('PUT', `/api/personnel/${created.id}`, {
    token: mgrToken,
    body: { full_name: 'Ten Moi', post_office_code: fixtures.postOfficeCode, commune_code: fixtures.communeCode }
  });
  assert.equal(status, 200);

  const row = ctx.db.prepare('SELECT full_name, post_office_code, commune_code FROM users WHERE id = ?').get(created.id);
  assert.equal(row.full_name, 'Ten Moi');
  assert.equal(row.post_office_code, fixtures.postOfficeCode);
  assert.equal(row.commune_code, fixtures.communeCode);
});

test('PUT /api/personnel/:id đổi hrm_code trùng người khác -> 400', async () => {
  const { body: a } = await call('POST', '/api/personnel', { token: mgrToken, body: { hrm_code: 'DUP_A', full_name: 'A' } });
  await call('POST', '/api/personnel', { token: mgrToken, body: { hrm_code: 'DUP_B', full_name: 'B' } });

  const { status } = await call('PUT', `/api/personnel/${a.id}`, {
    token: mgrToken,
    body: { hrm_code: 'DUP_B' }
  });
  assert.equal(status, 400);
});

// ==========================================
// POST /api/personnel/import
// ==========================================

test('POST /api/personnel/import personnel rỗng -> 400', async () => {
  const { status } = await call('POST', '/api/personnel/import', { token: mgrToken, body: { personnel: [] } });
  assert.equal(status, 400);
});

test('POST /api/personnel/import thiếu field personnel -> 400', async () => {
  const { status } = await call('POST', '/api/personnel/import', { token: mgrToken, body: {} });
  assert.equal(status, 400);
});

test('POST /api/personnel/import 1 dòng thiếu fullName -> 400, KHÔNG ghi dòng nào (kể cả dòng hợp lệ đứng trước)', async () => {
  const before_ = userCount();
  const { status } = await call('POST', '/api/personnel/import', {
    token: mgrToken,
    body: {
      personnel: [
        { hrmCode: 'IMP_OK_1', fullName: 'Hop Le Dung Truoc' },
        { hrmCode: 'IMP_BAD_1' } // thiếu fullName
      ]
    }
  });
  assert.equal(status, 400);
  assert.equal(userCount(), before_, 'fail-fast: không ghi dòng nào kể cả dòng hợp lệ đứng trước dòng lỗi');
});

test('POST /api/personnel/import fullName quá 200 ký tự -> 400', async () => {
  const { status } = await call('POST', '/api/personnel/import', {
    token: mgrToken,
    body: { personnel: [{ hrmCode: 'IMP_LONG', fullName: 'A'.repeat(201) }] }
  });
  assert.equal(status, 400);
});

test('POST /api/personnel/import hợp lệ -> 200, {created, updated} đúng, UPSERT theo hrm_code', async () => {
  const { status, body } = await call('POST', '/api/personnel/import', {
    token: mgrToken,
    body: {
      personnel: [
        { hrmCode: 'IMP_NEW_1', fullName: 'Nguoi Moi 1', postOfficeCode: fixtures.postOfficeCode, communeCode: fixtures.communeCode },
        { hrmCode: 'IMP_NEW_2', fullName: 'Nguoi Moi 2' }
      ]
    }
  });
  assert.equal(status, 200);
  assert.equal(body.created, 2);
  assert.equal(body.updated, 0);

  const row = ctx.db.prepare("SELECT full_name, post_office_code FROM users WHERE hrm_code = 'IMP_NEW_1'").get();
  assert.equal(row.full_name, 'Nguoi Moi 1');
  assert.equal(row.post_office_code, fixtures.postOfficeCode);
});

test('POST /api/personnel/import lần 2 cùng hrm_code -> UPDATE (updated), không tạo trùng', async () => {
  const beforeCount = ctx.db.prepare("SELECT COUNT(*) c FROM users WHERE hrm_code = 'IMP_NEW_1'").get().c;
  assert.equal(beforeCount, 1);

  const { status, body } = await call('POST', '/api/personnel/import', {
    token: mgrToken,
    body: { personnel: [{ hrmCode: 'IMP_NEW_1', fullName: 'Nguoi Moi 1 (Cap Nhat)' }] }
  });
  assert.equal(status, 200);
  assert.equal(body.created, 0);
  assert.equal(body.updated, 1);

  const after_ = ctx.db.prepare("SELECT COUNT(*) c, full_name FROM users WHERE hrm_code = 'IMP_NEW_1'").get();
  assert.equal(after_.c, 1, 'không được tạo trùng, phải update bản ghi cũ');
  assert.equal(after_.full_name, 'Nguoi Moi 1 (Cap Nhat)');
});

test('POST /api/personnel/import role STAFF -> 403', async () => {
  const { status } = await call('POST', '/api/personnel/import', {
    token: staffToken,
    body: { personnel: [{ hrmCode: 'X', fullName: 'Ai Do' }] }
  });
  assert.equal(status, 403);
});

// ==========================================
// GET /api/personnel/search
// ==========================================

test('GET /api/personnel/search không có token -> 401', async () => {
  const res = await fetch(`${ctx.baseUrl}/api/personnel/search?q=test`);
  assert.equal(res.status, 401);
});

test('GET /api/personnel/search khớp tên có dấu, không phân biệt hoa thường -> tối đa 10 kết quả', async () => {
  await call('POST', '/api/personnel', {
    token: mgrToken,
    body: { hrm_code: 'SEARCH_01', full_name: 'Nguyễn Văn Search' }
  });

  const { status, body } = await call('GET', '/api/personnel/search?q=nguyen van search', { token: mgrToken });
  assert.equal(status, 200);
  assert.ok(Array.isArray(body));
  assert.ok(body.some((p) => p.hrm_code === 'SEARCH_01'));
  assert.ok(body.length <= 10);
});

test('GET /api/personnel/search q rỗng -> trả mảng rỗng', async () => {
  const { status, body } = await call('GET', '/api/personnel/search?q=', { token: mgrToken });
  assert.equal(status, 200);
  assert.deepEqual(body, []);
});

// ==========================================
// GET /api/users chỉ trả tài khoản có password_hash (không lẫn nhân sự thuần)
// ==========================================

test('GET /api/users KHÔNG trả nhân sự thêm qua /api/personnel (không có password_hash)', async () => {
  const { body: personnel } = await call('POST', '/api/personnel', {
    token: mgrToken,
    body: { hrm_code: 'NOT_IN_USERS_LIST', full_name: 'Nhan Su Khong Co Tai Khoan' }
  });

  const { status, body } = await call('GET', '/api/users', { token: mgrToken });
  assert.equal(status, 200);
  assert.ok(Array.isArray(body));
  assert.ok(!body.some((u) => u.id === personnel.id), 'nhân sự không có password_hash không được xuất hiện trong GET /api/users');
  assert.ok(body.some((u) => u.hrm_code === MGR_HRM), 'tài khoản đăng nhập thật vẫn phải xuất hiện');
});

// ==========================================
// POST/PUT /api/equipments nhận assigned_user_id
// ==========================================

test('POST /api/equipments assigned_user_id không tồn tại -> 400', async () => {
  const res = await fetch(`${ctx.baseUrl}/api/equipments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mgrToken}` },
    body: JSON.stringify({
      device_type_id: fixtures.deviceTypeId,
      post_office_id: fixtures.postOfficeId,
      hostname: 'PC-ASSIGN-BAD',
      assigned_user_id: 'khong-ton-tai'
    })
  });
  assert.equal(res.status, 400);
});

test('POST /api/equipments assigned_user_id hợp lệ -> 201, lưu đúng assigned_user_id', async () => {
  const { body: personnel } = await call('POST', '/api/personnel', {
    token: mgrToken,
    body: { hrm_code: 'ASSIGN_TARGET_01', full_name: 'Nguoi Duoc Gan May' }
  });

  const res = await fetch(`${ctx.baseUrl}/api/equipments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mgrToken}` },
    body: JSON.stringify({
      device_type_id: fixtures.deviceTypeId,
      post_office_id: fixtures.postOfficeId,
      hostname: 'PC-ASSIGN-OK',
      assigned_user_id: personnel.id
    })
  });
  assert.equal(res.status, 201);
  const eq = await res.json();

  const row = ctx.db.prepare('SELECT assigned_user_id FROM equipments WHERE id = ?').get(eq.id);
  assert.equal(row.assigned_user_id, personnel.id);

  // Verify qua API công khai (GET detail) -> hiển thị đúng tên nhân sự đã gán.
  const detail = await (await fetch(`${ctx.baseUrl}/api/equipments/${eq.id}`)).json();
  assert.equal(detail.assigned_user_name, 'Nguoi Duoc Gan May');
});

test('PUT /api/equipments/:id đổi assigned_user_id hợp lệ -> 200, cập nhật đúng', async () => {
  const createRes = await fetch(`${ctx.baseUrl}/api/equipments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mgrToken}` },
    body: JSON.stringify({
      device_type_id: fixtures.deviceTypeId,
      post_office_id: fixtures.postOfficeId,
      hostname: 'PC-ASSIGN-PUT'
    })
  });
  const eq = await createRes.json();

  const { body: personnel } = await call('POST', '/api/personnel', {
    token: mgrToken,
    body: { hrm_code: 'ASSIGN_TARGET_02', full_name: 'Nguoi Duoc Gan Sau' }
  });

  const putRes = await fetch(`${ctx.baseUrl}/api/equipments/${eq.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mgrToken}` },
    body: JSON.stringify({ assigned_user_id: personnel.id })
  });
  assert.equal(putRes.status, 200);

  const row = ctx.db.prepare('SELECT assigned_user_id FROM equipments WHERE id = ?').get(eq.id);
  assert.equal(row.assigned_user_id, personnel.id);
});

test('PUT /api/equipments/:id assigned_user_id không tồn tại -> 400', async () => {
  const createRes = await fetch(`${ctx.baseUrl}/api/equipments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mgrToken}` },
    body: JSON.stringify({
      device_type_id: fixtures.deviceTypeId,
      post_office_id: fixtures.postOfficeId,
      hostname: 'PC-ASSIGN-PUT-BAD'
    })
  });
  const eq = await createRes.json();

  const putRes = await fetch(`${ctx.baseUrl}/api/equipments/${eq.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mgrToken}` },
    body: JSON.stringify({ assigned_user_id: 'khong-ton-tai' })
  });
  assert.equal(putRes.status, 400);
});

test('PUT /api/equipments/:id assigned_user_id = null -> gỡ gán (về NULL)', async () => {
  const { body: personnel } = await call('POST', '/api/personnel', {
    token: mgrToken,
    body: { hrm_code: 'ASSIGN_TARGET_03', full_name: 'Nguoi Se Bi Go Gan' }
  });

  const createRes = await fetch(`${ctx.baseUrl}/api/equipments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mgrToken}` },
    body: JSON.stringify({
      device_type_id: fixtures.deviceTypeId,
      post_office_id: fixtures.postOfficeId,
      hostname: 'PC-ASSIGN-UNSET',
      assigned_user_id: personnel.id
    })
  });
  const eq = await createRes.json();
  assert.equal(ctx.db.prepare('SELECT assigned_user_id FROM equipments WHERE id = ?').get(eq.id).assigned_user_id, personnel.id);

  const putRes = await fetch(`${ctx.baseUrl}/api/equipments/${eq.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mgrToken}` },
    body: JSON.stringify({ assigned_user_id: null })
  });
  assert.equal(putRes.status, 200);

  const row = ctx.db.prepare('SELECT assigned_user_id FROM equipments WHERE id = ?').get(eq.id);
  assert.equal(row.assigned_user_id, null);
});

test('raw_user_name vẫn hoạt động như cũ, độc lập với assigned_user_id', async () => {
  const res = await fetch(`${ctx.baseUrl}/api/equipments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mgrToken}` },
    body: JSON.stringify({
      device_type_id: fixtures.deviceTypeId,
      post_office_id: fixtures.postOfficeId,
      hostname: 'PC-RAWNAME',
      raw_user_name: 'TEN THO KHONG CAN KHOP USER'
    })
  });
  assert.equal(res.status, 201);
  const eq = await res.json();
  const row = ctx.db.prepare('SELECT raw_user_name, assigned_user_id FROM equipments WHERE id = ?').get(eq.id);
  assert.equal(row.raw_user_name, 'TEN THO KHONG CAN KHOP USER');
  assert.equal(row.assigned_user_id, null);
});
