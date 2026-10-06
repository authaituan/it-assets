// ==========================================
// Test: Emails API (server/routes/emails.js) — module Quản lý email.
// CRUD, định dạng email, UNIT/PERSONAL, revoke/reactivate, phân quyền (STAFF chỉ GET),
// import (kiểm tra toàn bộ trước, tạo/giữ nhân sự, không bao giờ tạo tổ chức, rollback).
// ==========================================
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, waitForServer, cleanupDbFiles, closeServer } = require('./helpers/serverHarness');
const { seedMinimalOrg, seedUser, uid } = require('./helpers/fixtures');

const PORT = 5908;
const MGR = { hrm: 'EMAIL_MGR', pass: 'Manager@123' };
const STAFF = { hrm: 'EMAIL_STAFF', pass: 'Staff@123' };

let ctx;
let org;
let org2; // BĐX + bưu cục thứ hai (để test lệch BĐX–bưu cục)
let mgrToken;
let staffToken;

async function login(hrm_code, password) {
  const res = await fetch(`${ctx.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hrm_code, password })
  });
  return (await res.json()).token;
}

async function call(method, path, token, body) {
  const res = await fetch(`${ctx.baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let json = null;
  try { json = await res.json(); } catch (e) { /* không có body */ }
  return { status: res.status, body: json };
}
const mgr = (m, p, b) => call(m, p, mgrToken, b);
const staff = (m, p, b) => call(m, p, staffToken, b);
const count = (table) => ctx.db.prepare(`SELECT COUNT(*) c FROM ${table}`).get().c;

before(async () => {
  ctx = startTestServer({ port: PORT, dbFileName: `ccdc-test-emails-${Date.now()}.db` });
  await waitForServer(ctx.baseUrl);
  org = seedMinimalOrg(ctx.db);
  // BĐX thứ hai + 1 bưu cục thuộc BĐX thứ hai
  const c2 = uid();
  const p2 = uid();
  ctx.db.prepare('INSERT INTO commune_post_offices (id, code, name, province_id) VALUES (?, ?, ?, ?)').run(c2, 'TESTC2', 'BĐX Test 2', org.provinceId);
  ctx.db.prepare('INSERT INTO post_offices (id, code, name, commune_id) VALUES (?, ?, ?, ?)').run(p2, 'TESTPO2', 'Bưu cục Test 2', c2);
  org2 = { communeId: c2, postOfficeId: p2, communeCode: 'TESTC2', postOfficeCode: 'TESTPO2' };

  seedUser(ctx.db, { hrmCode: MGR.hrm, fullName: 'Email Manager', role: 'ADMIN', password: MGR.pass });
  seedUser(ctx.db, { hrmCode: STAFF.hrm, fullName: 'Email Staff', role: 'STAFF', password: STAFF.pass });
  mgrToken = await login(MGR.hrm, MGR.pass);
  staffToken = await login(STAFF.hrm, STAFF.pass);
});

after(async () => {
  await closeServer(ctx.server);
  cleanupDbFiles(ctx.testDbPath, ctx.db);
});

const unitEmail = (over = {}) => ({ email: 'bc.hue@test.vn', kind: 'UNIT', full_name: 'Bưu cục Huế', post_office_id: org.postOfficeId, ...over });

test('phải có token; STAFF đọc được (GET) nhưng ghi/import/export -> 403', async () => {
  assert.equal((await call('GET', '/api/emails', null)).status, 401);
  const created = await mgr('POST', '/api/emails', unitEmail({ email: 'perm@test.vn' }));
  assert.equal(created.status, 201);
  const id = created.body.item.id;

  assert.equal((await staff('GET', '/api/emails')).status, 200);
  assert.equal((await staff('POST', '/api/emails', unitEmail({ email: 'x@test.vn' }))).status, 403);
  assert.equal((await staff('PUT', `/api/emails/${id}`, { phone: '1' })).status, 403);
  assert.equal((await staff('PUT', `/api/emails/${id}/revoke`, {})).status, 403);
  assert.equal((await staff('PUT', `/api/emails/${id}/reactivate`)).status, 403);
  assert.equal((await staff('POST', '/api/emails/import', { rows: [{ email: 'a@b.vn' }] })).status, 403);
  assert.equal((await staff('GET', '/api/emails/export-data')).status, 403);
});

test('POST: tạo email đơn vị, chuẩn hoá lowercase, suy BĐX từ bưu cục, status ACTIVE', async () => {
  const r = await mgr('POST', '/api/emails', unitEmail({ email: '  BC.Hue@Test.VN ', phone: '0234', created_date: '05/03/2024' }));
  assert.equal(r.status, 201);
  const it = r.body.item;
  assert.equal(it.email, 'bc.hue@test.vn');
  assert.equal(it.status, 'ACTIVE');
  assert.equal(it.created_date, '2024-03-05');
  assert.equal(it.commune_code, org.communeCode);
  assert.equal(it.post_office_code, org.postOfficeCode);
  assert.equal(r.body.personnelCreated, false);
});

test('POST: email trùng (không phân biệt hoa thường) / sai định dạng / thiếu tên -> 400', async () => {
  assert.equal((await mgr('POST', '/api/emails', unitEmail({ email: 'BC.HUE@test.vn' }))).status, 400);
  for (const bad of ['khong-co-a-cong', 'a@b', 'a b@test.vn', '@test.vn', '']) {
    const r = await mgr('POST', '/api/emails', unitEmail({ email: bad }));
    assert.equal(r.status, 400, bad);
  }
  assert.equal((await mgr('POST', '/api/emails', unitEmail({ email: 'noname@test.vn', full_name: '  ' }))).status, 400);
});

test('quy tắc UNIT/PERSONAL: UNIT không HRM, PERSONAL bắt buộc HRM, kind sai', async () => {
  assert.equal((await mgr('POST', '/api/emails', unitEmail({ email: 'u1@test.vn', hrm_code: 'H1' }))).status, 400);
  assert.equal((await mgr('POST', '/api/emails', { email: 'p1@test.vn', kind: 'PERSONAL', full_name: 'A' })).status, 400);
  assert.equal((await mgr('POST', '/api/emails', { email: 'p1@test.vn', kind: 'OTHER', full_name: 'A' })).status, 400);
});

test('ngày: sai định dạng / ngày không có thật / thu hồi trước khởi tạo -> 400', async () => {
  for (const d of ['31/02/2024', '2024-13-01', '2024/03/05', 'abc']) {
    assert.equal((await mgr('POST', '/api/emails', unitEmail({ email: 'd@test.vn', created_date: d }))).status, 400, d);
  }
  const ok = await mgr('POST', '/api/emails', unitEmail({ email: 'dd@test.vn', created_date: '2024-05-10' }));
  assert.equal(ok.status, 201);
  const id = ok.body.item.id;
  assert.equal((await mgr('PUT', `/api/emails/${id}/revoke`, { revoked_date: '2024-05-09' })).status, 400);
  assert.equal((await mgr('PUT', `/api/emails/${id}/revoke`, { revoked_date: '30/02/2024' })).status, 400);
  assert.equal((await mgr('PUT', `/api/emails/${id}/revoke`, { revoked_date: '2024-05-10' })).status, 200);
});

test('POST: email cá nhân đang dùng tự tạo nhân sự; HRM đã có thì giữ nguyên + cảnh báo', async () => {
  const usersBefore = count('users');
  const r = await mgr('POST', '/api/emails', {
    email: 'nv.a@test.vn', kind: 'PERSONAL', hrm_code: 'HRM_A', full_name: 'Nguyễn Văn A', post_office_id: org.postOfficeId
  });
  assert.equal(r.status, 201);
  assert.equal(r.body.personnelCreated, true);
  assert.equal(count('users'), usersBefore + 1);
  const u = ctx.db.prepare("SELECT * FROM users WHERE hrm_code = 'HRM_A'").get();
  assert.equal(u.full_name, 'Nguyễn Văn A');
  assert.equal(u.post_office_code, org.postOfficeCode);
  assert.equal(u.commune_code, org.communeCode);
  assert.equal(u.password_hash, null);

  // HRM đã có (tên khác) -> giữ nguyên, có cảnh báo, không tạo thêm
  const r2 = await mgr('POST', '/api/emails', { email: 'nv.a2@test.vn', kind: 'PERSONAL', hrm_code: 'HRM_A', full_name: 'Tên Khác' });
  assert.equal(r2.status, 201);
  assert.equal(r2.body.personnelCreated, false);
  assert.equal(r2.body.warnings.length, 1);
  assert.equal(ctx.db.prepare("SELECT full_name FROM users WHERE hrm_code = 'HRM_A'").get().full_name, 'Nguyễn Văn A');
});

test('POST: đơn vị sai -> 400 (bưu cục không tồn tại, lệch BĐX, BĐX không tồn tại)', async () => {
  assert.equal((await mgr('POST', '/api/emails', unitEmail({ email: 'o1@test.vn', post_office_id: 'khong-co' }))).status, 400);
  assert.equal((await mgr('POST', '/api/emails', unitEmail({ email: 'o2@test.vn', commune_id: org2.communeId }))).status, 400);
  assert.equal((await mgr('POST', '/api/emails', { email: 'o3@test.vn', kind: 'UNIT', full_name: 'X', commune_id: 'khong-co' })).status, 400);
  const ok = await mgr('POST', '/api/emails', { email: 'o4@test.vn', kind: 'UNIT', full_name: 'Chỉ BĐX', commune_id: org2.communeId });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.item.commune_code, org2.communeCode);
  assert.equal(ok.body.item.post_office_code, null);
});

test('PUT: sửa trường, đổi email trùng -> 400, kind UNIT mà còn HRM -> 400, 404', async () => {
  const a = (await mgr('POST', '/api/emails', unitEmail({ email: 'put.a@test.vn' }))).body.item;
  const b = (await mgr('POST', '/api/emails', unitEmail({ email: 'put.b@test.vn' }))).body.item;
  const r = await mgr('PUT', `/api/emails/${a.id}`, { phone: '0999', job_title: 'Trưởng', created_date: '2024-01-02', commune_id: org2.communeId });
  assert.equal(r.status, 200);
  assert.equal(r.body.item.phone, '0999');
  assert.equal(r.body.item.job_title, 'Trưởng');
  assert.equal(r.body.item.created_date, '2024-01-02');
  assert.equal(r.body.item.commune_code, org2.communeCode);
  assert.equal(r.body.item.post_office_code, null, 'đổi BĐX thì bỏ bưu cục cũ');
  assert.equal((await mgr('PUT', `/api/emails/${a.id}`, { email: 'PUT.B@test.vn' })).status, 400);
  assert.equal((await mgr('PUT', `/api/emails/${b.id}`, { hrm_code: 'H9' })).status, 400);
  assert.equal((await mgr('PUT', '/api/emails/khong-co', { phone: '1' })).status, 404);
});

test('revoke mặc định hôm nay, không thu hồi 2 lần; reactivate xoá ngày, không tạo nhân sự', async () => {
  const p = await mgr('POST', '/api/emails', { email: 'rv@test.vn', kind: 'PERSONAL', hrm_code: 'HRM_RV', full_name: 'RV' });
  const id = p.body.item.id;
  const rv = await mgr('PUT', `/api/emails/${id}/revoke`, {});
  assert.equal(rv.status, 200);
  assert.equal(rv.body.item.status, 'REVOKED');
  assert.match(rv.body.item.revoked_date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal((await mgr('PUT', `/api/emails/${id}/revoke`, {})).status, 400);

  ctx.db.prepare("DELETE FROM users WHERE hrm_code = 'HRM_RV'").run();
  const usersBefore = count('users');
  const ra = await mgr('PUT', `/api/emails/${id}/reactivate`);
  assert.equal(ra.status, 200);
  assert.equal(ra.body.item.status, 'ACTIVE');
  assert.equal(ra.body.item.revoked_date, null);
  assert.equal(count('users'), usersBefore, 'kích hoạt lại KHÔNG tự tạo nhân sự');
  assert.equal((await mgr('PUT', `/api/emails/${id}/reactivate`)).status, 400);
});

test('không có route xoá cứng', async () => {
  const id = (await mgr('POST', '/api/emails', unitEmail({ email: 'nodel@test.vn' }))).body.item.id;
  assert.equal((await mgr('DELETE', `/api/emails/${id}`)).status, 404);
});

test('GET: lọc kind/status/search chuẩn hoá/commune/postOffice + phân trang', async () => {
  ctx.db.prepare('DELETE FROM emails').run();
  await mgr('POST', '/api/emails', unitEmail({ email: 'l1@test.vn', full_name: 'Bưu cục Đông Hà', phone: '0911' }));
  await mgr('POST', '/api/emails', { email: 'l2@test.vn', kind: 'PERSONAL', hrm_code: 'HL2', full_name: 'Trần Thị Bé', commune_id: org2.communeId });
  const l3 = await mgr('POST', '/api/emails', { email: 'l3@test.vn', kind: 'PERSONAL', hrm_code: 'HL3', full_name: 'Lê Văn C' });
  await mgr('PUT', `/api/emails/${l3.body.item.id}/revoke`, {});

  const all = await mgr('GET', '/api/emails');
  assert.equal(all.body.pagination.total, 3);
  assert.equal((await mgr('GET', '/api/emails?kind=UNIT')).body.pagination.total, 1);
  assert.equal((await mgr('GET', '/api/emails?status=REVOKED')).body.items[0].email, 'l3@test.vn');
  assert.equal((await mgr('GET', '/api/emails?status=ACTIVE')).body.pagination.total, 2);
  assert.equal((await mgr('GET', '/api/emails?search=dong ha')).body.items[0].email, 'l1@test.vn');
  assert.equal((await mgr('GET', '/api/emails?search=tran thi be')).body.items[0].email, 'l2@test.vn');
  assert.equal((await mgr('GET', '/api/emails?search=HL3')).body.items[0].email, 'l3@test.vn');
  assert.equal((await mgr('GET', '/api/emails?search=0911')).body.items[0].email, 'l1@test.vn');
  assert.equal((await mgr('GET', `/api/emails?communeId=${org2.communeId}`)).body.items[0].email, 'l2@test.vn');
  assert.equal((await mgr('GET', `/api/emails?postOfficeId=${org.postOfficeId}`)).body.items[0].email, 'l1@test.vn');
  const pg = await mgr('GET', '/api/emails?page=2&limit=2');
  assert.equal(pg.body.items.length, 1);
  assert.equal(pg.body.pagination.totalPages, 2);
});

test('export-data: key Excel, cùng bộ lọc', async () => {
  const r = await mgr('GET', '/api/emails/export-data?status=REVOKED');
  assert.equal(r.status, 200);
  assert.equal(r.body.total, 1);
  const row = r.body.items[0];
  assert.deepEqual(Object.keys(row), ['email', 'loai', 'maHrm', 'hoTen', 'soDienThoai', 'maBdx', 'maBuuCuc', 'chucDanh', 'trangThai', 'ngayKhoiTao', 'ngayThuHoi']);
  assert.equal(row.trangThai, 'Đã thu hồi');
  assert.equal(row.loai, 'Cá nhân');
  assert.match(row.ngayThuHoi, /^\d{2}\/\d{2}\/\d{4}$/);
});

// ------------------ IMPORT ------------------
const imp = (rows) => mgr('POST', '/api/emails/import', { rows });

test('import: rỗng / không phải mảng -> 400', async () => {
  assert.equal((await imp([])).status, 400);
  assert.equal((await mgr('POST', '/api/emails/import', {})).status, 400);
});

test('import: lỗi gom theo dòng, có lỗi thì KHÔNG ghi gì (rollback toàn bộ)', async () => {
  ctx.db.prepare('DELETE FROM emails').run();
  const users = count('users');
  const r = await imp([
    { email: 'ok1@test.vn', loai: 'Đơn vị', hoTen: 'Hợp lệ', maBuuCuc: org.postOfficeCode },
    { email: 'sai-dinh-dang', loai: 'Đơn vị', hoTen: 'X' },
    { email: 'lalo@test.vn', loai: 'Đơn vị', hoTen: 'Mã lạ', maBuuCuc: 'KHONGCO' },
    { email: 'lalo2@test.vn', loai: 'Đơn vị', hoTen: 'BĐX lạ', maBdx: 'KHONGCO' },
    { email: 'lech@test.vn', loai: 'Đơn vị', hoTen: 'Lệch', maBdx: org2.communeCode, maBuuCuc: org.postOfficeCode },
    { email: 'thuhoi@test.vn', loai: 'Cá nhân', maHrm: 'HX', hoTen: 'Thiếu ngày', trangThai: 'Đã thu hồi' },
    { email: 'unit-hrm@test.vn', loai: 'Đơn vị', maHrm: 'H1', hoTen: 'Đơn vị có HRM' },
    { email: 'ngay@test.vn', loai: 'Đơn vị', hoTen: 'Ngày sai', ngayKhoiTao: '31/02/2024' },
    { email: 'ca-nhan@test.vn', loai: 'Cá nhân', hoTen: 'Thiếu HRM' },
    { loai: 'Đơn vị', hoTen: 'Thiếu email' }
  ]);
  assert.equal(r.status, 400);
  const rowsWithErr = new Set(r.body.errors.map((e) => e.row));
  assert.deepEqual([...rowsWithErr].sort((a, b) => a - b), [2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.match(r.body.errors.find((e) => e.row === 3).message, /KHONGCO/);
  assert.match(r.body.errors.find((e) => e.row === 5).message, /không khớp/);
  assert.equal(count('emails'), 0, 'dòng 1 hợp lệ cũng không được ghi');
  assert.equal(count('users'), users);
});

test('import: tối đa 100 lỗi được liệt kê', async () => {
  const rows = Array.from({ length: 150 }, (_, i) => ({ email: `bad${i}`, loai: 'Đơn vị', hoTen: 'X' }));
  const r = await imp(rows);
  assert.equal(r.status, 400);
  assert.equal(r.body.errors.length, 100);
  assert.equal(r.body.totalErrors, 150);
  assert.equal(r.body.truncated, true);
});

test('import: không BAO GIỜ tạo tỉnh/BĐX/bưu cục dù mã lạ', async () => {
  const before = [count('province_post_offices'), count('commune_post_offices'), count('post_offices')];
  await imp([{ email: 'moi@test.vn', loai: 'Đơn vị', hoTen: 'X', maBdx: 'MOI', maBuuCuc: 'MOI' }]);
  assert.deepEqual([count('province_post_offices'), count('commune_post_offices'), count('post_offices')], before);
});

test('import: tạo mới + suy BĐX từ bưu cục + tạo nhân sự đúng; thu hồi KHÔNG tạo nhân sự', async () => {
  ctx.db.prepare('DELETE FROM emails').run();
  const users = count('users');
  const r = await imp([
    { email: 'IMP1@test.vn', loai: 'Đơn vị', hoTen: 'Đơn vị Một', maBuuCuc: org.postOfficeCode, ngayKhoiTao: '01/02/2024' },
    { email: 'imp2@test.vn', loai: 'Cá nhân', maHrm: 'IMP_H2', hoTen: 'Cá Nhân Hai', maBdx: org2.communeCode, trangThai: 'Đang sử dụng', soDienThoai: '0905', chucDanh: 'NV' },
    { email: 'imp3@test.vn', loai: 'Cá nhân', maHrm: 'IMP_H3', hoTen: 'Cá Nhân Ba', trangThai: 'Đã thu hồi', ngayThuHoi: '2024-06-30' },
    { email: 'imp4@test.vn', loai: 'Cá nhân', maHrm: 'IMP_H4', hoTen: 'Cá Nhân Bốn', ngayThuHoi: '15/07/2024' }
  ]);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.created, 4);
  assert.equal(r.body.updated, 0);
  assert.equal(r.body.personnelCreated, 1);
  assert.equal(count('users'), users + 1);

  const e1 = ctx.db.prepare("SELECT * FROM emails WHERE email = 'imp1@test.vn'").get();
  assert.equal(e1.commune_id, org.communeId, 'suy BĐX từ bưu cục');
  assert.equal(e1.post_office_id, org.postOfficeId);
  assert.equal(e1.created_date, '2024-02-01');
  const u = ctx.db.prepare("SELECT * FROM users WHERE hrm_code = 'IMP_H2'").get();
  assert.equal(u.full_name, 'Cá Nhân Hai');
  assert.equal(u.commune_code, org2.communeCode);
  assert.equal(u.post_office_code, null);
  assert.equal(ctx.db.prepare("SELECT * FROM users WHERE hrm_code = 'IMP_H3'").get(), undefined);
  assert.equal(ctx.db.prepare("SELECT * FROM users WHERE hrm_code = 'IMP_H4'").get(), undefined);
  assert.equal(ctx.db.prepare("SELECT revoked_date FROM emails WHERE email = 'imp4@test.vn'").get().revoked_date, '2024-07-15', 'trangThai trống -> suy từ ngayThuHoi');
});

test('import: HRM đã có KHÔNG bị ghi đè, lệch tên/đơn vị -> warnings', async () => {
  ctx.db.prepare("INSERT INTO users (id, hrm_code, full_name, post_office_code, commune_code) VALUES (?, 'EXIST_H', 'Tên Gốc', ?, ?)")
    .run(uid(), org.postOfficeCode, org.communeCode);
  const r = await imp([
    { email: 'exist1@test.vn', loai: 'Cá nhân', maHrm: 'EXIST_H', hoTen: 'Tên Khác Hẳn', maBdx: org2.communeCode },
    { email: 'exist2@test.vn', loai: 'Cá nhân', maHrm: 'EXIST_H', hoTen: 'Tên Gốc', maBuuCuc: org.postOfficeCode }
  ]);
  assert.equal(r.status, 200);
  assert.equal(r.body.personnelCreated, 0);
  assert.equal(r.body.warnings.length, 1);
  assert.match(r.body.warnings[0], /^Dòng 1:/);
  const u = ctx.db.prepare("SELECT * FROM users WHERE hrm_code = 'EXIST_H'").get();
  assert.equal(u.full_name, 'Tên Gốc');
  assert.equal(u.commune_code, org.communeCode);
});

test('import: cập nhật theo email — ô trống giữ giá trị cũ; Đang sử dụng xoá ngày thu hồi', async () => {
  ctx.db.prepare('DELETE FROM emails').run();
  await imp([{ email: 'upd@test.vn', loai: 'Cá nhân', maHrm: 'UPD_H', hoTen: 'Tên Cũ', soDienThoai: '111', chucDanh: 'CD cũ', maBuuCuc: org.postOfficeCode, ngayKhoiTao: '2024-01-01', ngayThuHoi: '2024-02-02' }]);

  const r1 = await imp([{ email: 'UPD@test.vn', hoTen: 'Tên Mới' }]);
  assert.equal(r1.status, 200);
  assert.equal(r1.body.created, 0);
  assert.equal(r1.body.updated, 1);
  const row = ctx.db.prepare("SELECT * FROM emails WHERE email = 'upd@test.vn'").get();
  assert.equal(row.full_name, 'Tên Mới');
  assert.equal(row.phone, '111');
  assert.equal(row.job_title, 'CD cũ');
  assert.equal(row.hrm_code, 'UPD_H');
  assert.equal(row.post_office_id, org.postOfficeId);
  assert.equal(row.created_date, '2024-01-01');
  assert.equal(row.revoked_date, '2024-02-02', 'ô trống giữ ngày thu hồi cũ');

  const r2 = await imp([{ email: 'upd@test.vn', trangThai: 'Đang sử dụng' }]);
  assert.equal(r2.status, 200);
  assert.equal(ctx.db.prepare("SELECT revoked_date FROM emails WHERE email = 'upd@test.vn'").get().revoked_date, null);
  assert.equal(r2.body.personnelCreated, 1, 'dùng lại + HRM chưa có nhân sự -> tạo');

  // ngày thu hồi trước ngày khởi tạo -> lỗi
  const r4 = await imp([{ email: 'upd@test.vn', ngayThuHoi: '31/12/2023' }]);
  assert.equal(r4.status, 400);
  // Đã thu hồi + thiếu ngày (email đang dùng, chưa có ngày) -> lỗi dòng
  const r3 = await imp([{ email: 'upd@test.vn', trangThai: 'Đã thu hồi' }]);
  assert.equal(r3.status, 400);
});

test('import: email mới thiếu loai / họ tên -> lỗi; email trùng trong file được gộp tuần tự', async () => {
  ctx.db.prepare('DELETE FROM emails').run();
  assert.equal((await imp([{ email: 'nl@test.vn', hoTen: 'X' }])).status, 400);
  assert.equal((await imp([{ email: 'nt@test.vn', loai: 'Đơn vị' }])).status, 400);
  const r = await imp([
    { email: 'dup@test.vn', loai: 'Đơn vị', hoTen: 'Lần 1' },
    { email: 'DUP@test.vn', soDienThoai: '777' }
  ]);
  assert.equal(r.status, 200);
  assert.equal(r.body.created, 1);
  assert.equal(r.body.updated, 1);
  const row = ctx.db.prepare("SELECT * FROM emails WHERE email = 'dup@test.vn'").get();
  assert.equal(row.full_name, 'Lần 1');
  assert.equal(row.phone, '777');
});

test('import: kết quả export nhập lại được không lỗi (round-trip)', async () => {
  const ex = await mgr('GET', '/api/emails/export-data');
  assert.ok(ex.body.items.length > 0);
  const r = await imp(ex.body.items);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.created, 0);
});
