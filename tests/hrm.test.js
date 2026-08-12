// ==========================================
// Test: HRM Auto-Mapping (POST /api/hrm/upload-and-map)
// Evidence: server/index.js:605-714
// ==========================================
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, waitForServer, cleanupDbFiles, closeServer } = require('./helpers/serverHarness');
const { seedMinimalOrg, seedUser } = require('./helpers/fixtures');

const PORT = 5903;
const MGR_HRM = 'HRM_MGR';
const MGR_PASS = 'Manager@123';

let ctx;
let fixtures;
let mgrToken;

before(async () => {
  ctx = startTestServer({ port: PORT, dbFileName: `ccdc-test-hrm-${Date.now()}.db` });
  await waitForServer(ctx.baseUrl);
  fixtures = seedMinimalOrg(ctx.db);
  seedUser(ctx.db, { hrmCode: MGR_HRM, fullName: 'HRM Manager', role: 'ADMIN', password: MGR_PASS });

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

async function importHrm(payload) {
  const res = await fetch(`${ctx.baseUrl}/api/hrm/upload-and-map`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function userCount() {
  return ctx.db.prepare('SELECT COUNT(*) c FROM users').get().c;
}

test('hrmEmployees = [] (rỗng) -> 400', async () => {
  const { status } = await importHrm({ hrmEmployees: [] });
  assert.equal(status, 400);
});

test('hrmEmployees không phải array (object) -> 400', async () => {
  const { status } = await importHrm({ hrmEmployees: { foo: 'bar' } });
  assert.equal(status, 400);
});

test('hrmEmployees không phải array (string) -> 400', async () => {
  const { status } = await importHrm({ hrmEmployees: 'not-an-array' });
  assert.equal(status, 400);
});

test('thiếu hẳn field hrmEmployees -> 400', async () => {
  const { status } = await importHrm({});
  assert.equal(status, 400);
});

test('fullName sai kiểu (number) -> 400, chặn fail-fast TRƯỚC khi ghi DB (không tạo user nào trong cả batch, kể cả entry hợp lệ đứng trước)', async () => {
  const before_ = userCount();
  const { status } = await importHrm({
    hrmEmployees: [
      { hrmCode: 'OK1', fullName: 'Người Hợp Lệ Đứng Trước' }, // hợp lệ, nhưng đứng TRƯỚC entry lỗi
      { hrmCode: 'BAD1', fullName: 12345 } // sai kiểu -> phải chặn cả batch
    ]
  });
  assert.equal(status, 400);
  assert.equal(userCount(), before_, 'validate chạy trước transaction -> kể cả entry hợp lệ cũng không được ghi khi có 1 entry lỗi trong batch');
});

test('fullName quá dài (> 200 ký tự) -> 400', async () => {
  const { status } = await importHrm({
    hrmEmployees: [{ hrmCode: 'LONGX', fullName: 'A'.repeat(201) }]
  });
  assert.equal(status, 400);
});

test('hrmCode sai kiểu (number) -> 400', async () => {
  const { status } = await importHrm({
    hrmEmployees: [{ hrmCode: 12345, fullName: 'Tên Hợp Lệ' }]
  });
  assert.equal(status, 400);
});

test('import hợp lệ: tạo mới user + mapping đúng thiết bị theo tên đã chuẩn hoá (bỏ dấu, không phân biệt hoa/thường)', async () => {
  // Tạo sẵn 1 thiết bị có raw_user_name viết KHÔNG dấu, chưa gán assigned_user_id
  const createRes = await fetch(`${ctx.baseUrl}/api/equipments`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      device_type_id: fixtures.deviceTypeId,
      post_office_id: fixtures.postOfficeId,
      hostname: 'PC-HRM-01',
      raw_user_name: 'NGUYEN VAN TEST'
    })
  });
  assert.equal(createRes.status, 201);
  const eq = await createRes.json();

  const { status, body } = await importHrm({
    hrmEmployees: [
      {
        hrmCode: 'HRM-NVT',
        fullName: 'Nguyễn Văn Test' // có dấu -> chuẩn hoá phải khớp "nguyen van test"
      }
    ]
  });

  assert.equal(status, 200);
  assert.equal(body.stats.usersCreated, 1);
  assert.equal(body.stats.usersUpdated, 0);
  assert.equal(body.stats.assetsAutoMapped, 1);
  assert.ok(body.mappingDetails.some((m) => m.equipmentId === eq.id));

  // Verify qua GET detail (API công khai, không đọc thẳng DB) -> thiết bị đã được gán đúng user
  const detail = await (await fetch(`${ctx.baseUrl}/api/equipments/${eq.id}`)).json();
  assert.equal(detail.assigned_user_hrm, 'HRM-NVT');
  assert.equal(detail.assigned_user_name, 'Nguyễn Văn Test');
});

test('import lần 2 cùng hrmCode -> cập nhật user hiện có (usersUpdated), không tạo trùng user', async () => {
  const before_ = ctx.db.prepare("SELECT COUNT(*) c FROM users WHERE hrm_code = 'HRM-NVT'").get().c;
  assert.equal(before_, 1, 'tiền điều kiện: user HRM-NVT phải đã tồn tại từ test trước');

  const { status, body } = await importHrm({
    hrmEmployees: [{ hrmCode: 'HRM-NVT', fullName: 'Nguyễn Văn Test (Cập Nhật)' }]
  });
  assert.equal(status, 200);
  assert.equal(body.stats.usersCreated, 0);
  assert.equal(body.stats.usersUpdated, 1);

  const after_ = ctx.db.prepare("SELECT COUNT(*) c, full_name FROM users WHERE hrm_code = 'HRM-NVT'").get();
  assert.equal(after_.c, 1, 'không được tạo user trùng, phải update user cũ');
  assert.equal(after_.full_name, 'Nguyễn Văn Test (Cập Nhật)');
});

test('import HRM STAFF (không phải quản lý) -> 403', async () => {
  const staffHrmCode = 'HRM_STAFF_ONLY';
  seedUser(ctx.db, { hrmCode: staffHrmCode, fullName: 'HRM Staff', role: 'STAFF', password: 'Staff@123' });
  const loginRes = await fetch(`${ctx.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hrm_code: staffHrmCode, password: 'Staff@123' })
  });
  const staffToken = (await loginRes.json()).token;

  const res = await fetch(`${ctx.baseUrl}/api/hrm/upload-and-map`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
    body: JSON.stringify({ hrmEmployees: [{ hrmCode: 'X', fullName: 'Ai Đó' }] })
  });
  assert.equal(res.status, 403);
});
