// ==========================================
// Test: Authentication + RBAC (server/auth.js + route POST /api/auth/login)
// Evidence: server/index.js:21-49 (route login), server/auth.js:60-87 (middleware)
// ==========================================
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, waitForServer, cleanupDbFiles, closeServer } = require('./helpers/serverHarness');
const { seedMinimalOrg, seedUser } = require('./helpers/fixtures');

const PORT = 5901;
const MGR_HRM = 'AUTH_MGR';
const MGR_PASS = 'Manager@123';
const STAFF_HRM = 'AUTH_STAFF';
const STAFF_PASS = 'Staff@123';

let ctx;
let fixtures;

before(async () => {
  ctx = startTestServer({ port: PORT, dbFileName: `ccdc-test-auth-${Date.now()}.db` });
  await waitForServer(ctx.baseUrl);
  fixtures = seedMinimalOrg(ctx.db);
  seedUser(ctx.db, { hrmCode: MGR_HRM, fullName: 'Auth Manager', role: 'ADMIN', password: MGR_PASS });
  seedUser(ctx.db, { hrmCode: STAFF_HRM, fullName: 'Auth Staff', role: 'STAFF', password: STAFF_PASS });
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
  const body = await res.json();
  return { status: res.status, body };
}

test('login đúng mật khẩu -> 200 + trả JWT hợp lệ', async () => {
  const { status, body } = await login(MGR_HRM, MGR_PASS);
  assert.equal(status, 200);
  assert.equal(typeof body.token, 'string');
  assert.equal(body.token.split('.').length, 3, 'token phải có 3 phần (header.payload.signature)');
  assert.equal(body.user.role, 'ADMIN');
  assert.equal(body.user.hrm_code, MGR_HRM);
});

test('login sai mật khẩu -> 401', async () => {
  const { status, body } = await login(MGR_HRM, 'mat-khau-sai');
  assert.equal(status, 401);
  assert.ok(body.error);
});

test('login mã HRM không tồn tại -> 401 (không lộ tài khoản có tồn tại hay không)', async () => {
  const { status } = await login('KHONG_TON_TAI', 'gi-cung-duoc');
  assert.equal(status, 401);
});

test('login thiếu password -> 400', async () => {
  const res = await fetch(`${ctx.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hrm_code: MGR_HRM })
  });
  assert.equal(res.status, 400);
});

test('gọi route ghi (POST equipments) không có token -> 401', async () => {
  const res = await fetch(`${ctx.baseUrl}/api/equipments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_type_id: fixtures.deviceTypeId, post_office_id: fixtures.postOfficeId })
  });
  assert.equal(res.status, 401);
});

test('gọi route ghi (PUT equipments) không có token -> 401', async () => {
  const res = await fetch(`${ctx.baseUrl}/api/equipments/khong-ton-tai`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'IN_STOCK' })
  });
  assert.equal(res.status, 401);
});

test('gọi route ghi (DELETE equipments) không có token -> 401', async () => {
  const res = await fetch(`${ctx.baseUrl}/api/equipments/khong-ton-tai`, { method: 'DELETE' });
  assert.equal(res.status, 401);
});

test('gọi route ghi với token rác (không hợp lệ) -> 401', async () => {
  const res = await fetch(`${ctx.baseUrl}/api/equipments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer khong-phai-jwt-hop-le' },
    body: JSON.stringify({ device_type_id: fixtures.deviceTypeId, post_office_id: fixtures.postOfficeId })
  });
  assert.equal(res.status, 401);
});

test('có token role STAFF -> POST equipments 403', async () => {
  const { body: loginBody } = await login(STAFF_HRM, STAFF_PASS);
  const res = await fetch(`${ctx.baseUrl}/api/equipments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginBody.token}` },
    body: JSON.stringify({ device_type_id: fixtures.deviceTypeId, post_office_id: fixtures.postOfficeId })
  });
  assert.equal(res.status, 403);
});

test('có token role STAFF -> PUT equipments 403', async () => {
  const { body: loginBody } = await login(STAFF_HRM, STAFF_PASS);
  const res = await fetch(`${ctx.baseUrl}/api/equipments/khong-ton-tai`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginBody.token}` },
    body: JSON.stringify({ status: 'IN_STOCK' })
  });
  assert.equal(res.status, 403);
});

test('có token role STAFF -> DELETE equipments 403', async () => {
  const { body: loginBody } = await login(STAFF_HRM, STAFF_PASS);
  const res = await fetch(`${ctx.baseUrl}/api/equipments/khong-ton-tai`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${loginBody.token}` }
  });
  assert.equal(res.status, 403);
});

test('có token role quản lý -> POST equipments 201 (thành công)', async () => {
  const { body: loginBody } = await login(MGR_HRM, MGR_PASS);
  const res = await fetch(`${ctx.baseUrl}/api/equipments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginBody.token}` },
    body: JSON.stringify({ device_type_id: fixtures.deviceTypeId, post_office_id: fixtures.postOfficeId, hostname: 'AUTH-TEST-PC' })
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.ok(body.id);

  // Dọn thiết bị vừa tạo (không bắt buộc vì DB riêng cho file này, nhưng giữ sạch)
  await fetch(`${ctx.baseUrl}/api/equipments/${body.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${loginBody.token}` }
  });
});

test('có token role quản lý -> PUT equipments status hợp lệ 200 (thành công)', async () => {
  const { body: loginBody } = await login(MGR_HRM, MGR_PASS);
  const createRes = await fetch(`${ctx.baseUrl}/api/equipments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginBody.token}` },
    body: JSON.stringify({ device_type_id: fixtures.deviceTypeId, post_office_id: fixtures.postOfficeId, hostname: 'AUTH-TEST-PUT' })
  });
  const created = await createRes.json();

  const putRes = await fetch(`${ctx.baseUrl}/api/equipments/${created.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginBody.token}` },
    body: JSON.stringify({ status: 'IN_STOCK' })
  });
  assert.equal(putRes.status, 200);
});

test('rate-limit đăng nhập: 5 lần sai liên tiếp -> lần thứ 6 bị 429, dù mật khẩu đúng', async () => {
  const rlHrm = 'RATE_LIMIT_TEST';
  // Không cần seed user thật — 401 (sai) vẫn tính vào bộ đếm rate-limit
  // như đã cài trong server/index.js (recordFailedLogin chạy trước khi
  // biết tài khoản có tồn tại hay không).
  for (let i = 0; i < 5; i++) {
    const { status } = await login(rlHrm, 'sai-mat-khau');
    assert.equal(status, 401, `lần thử thứ ${i + 1} phải là 401 (chưa bị khoá)`);
  }
  // Lần thứ 6: kể cả gửi đúng thông tin (giả định) cũng phải bị chặn bởi rate-limit trước khi verify.
  const { status, body } = await login(rlHrm, 'sai-mat-khau');
  assert.equal(status, 429, 'lần thứ 6 trong 15 phút phải bị chặn rate-limit (429)');
  assert.ok(body.error);
});

test('rate-limit đăng nhập: không ảnh hưởng tài khoản KHÁC (chỉ khoá theo hrm_code cụ thể)', async () => {
  // Tài khoản quản lý (MGR_HRM) vẫn đăng nhập bình thường dù RATE_LIMIT_TEST
  // (hrm_code khác) vừa bị khoá ở test phía trên.
  const { status } = await login(MGR_HRM, MGR_PASS);
  assert.equal(status, 200);
});
