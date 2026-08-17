// ==========================================
// Test: Quản Lý Mạng Lưới (Network Management) API
// (server/index.js — NETWORK MANAGEMENT section, feat/network-management-backend)
// Evidence: GET /api/network, POST /api/network/import,
// GET /api/network/export-data, PUT /api/network/post-offices/:id,
// DELETE /api/network/post-offices/:id.
// Phủ: import tạo mới toàn bộ chuỗi tổ chức + 9 cột mới, update bưu cục qua
// import (postOfficesUpdated), fail-fast thiếu maMbc, sửa bưu cục, xoá bưu cục
// bị chặn khi có thiết bị liên kết vs xoá được khi không tham chiếu gì, RBAC.
// ==========================================
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, waitForServer, cleanupDbFiles, closeServer } = require('./helpers/serverHarness');
const { seedMinimalOrg, seedUser } = require('./helpers/fixtures');

const PORT = 5906;
const MGR_HRM = 'NET_MGR';
const MGR_PASS = 'Manager@123';
const STAFF_HRM = 'NET_STAFF';
const STAFF_PASS = 'Staff@123';

let ctx;
let fixtures;
let mgrToken;
let staffToken;

before(async () => {
  ctx = startTestServer({ port: PORT, dbFileName: `ccdc-test-network-${Date.now()}.db` });
  await waitForServer(ctx.baseUrl);
  fixtures = seedMinimalOrg(ctx.db);
  seedUser(ctx.db, { hrmCode: MGR_HRM, fullName: 'Network Manager', role: 'ADMIN', password: MGR_PASS });
  seedUser(ctx.db, { hrmCode: STAFF_HRM, fullName: 'Network Staff', role: 'STAFF', password: STAFF_PASS });

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

function poCount() {
  return ctx.db.prepare('SELECT COUNT(*) c FROM post_offices').get().c;
}

// ==========================================
// GET /api/network — RBAC + list + search + pagination
// ==========================================

test('GET /api/network không có token -> 401', async () => {
  const res = await fetch(`${ctx.baseUrl}/api/network`);
  assert.equal(res.status, 401);
});

test('GET /api/network role STAFF -> 403', async () => {
  const { status } = await call('GET', '/api/network', { token: staffToken });
  assert.equal(status, 403);
});

test('GET /api/network role quản lý -> 200, trả items + pagination, có bưu cục seed', async () => {
  const { status, body } = await call('GET', '/api/network', { token: mgrToken });
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.items));
  assert.ok(body.pagination);
  const seedPo = body.items.find((p) => p.code === fixtures.postOfficeCode);
  assert.ok(seedPo, 'phải thấy bưu cục seed');
  assert.equal(seedPo.commune_name, 'BĐX Test');
  assert.equal(seedPo.province_name, 'Tỉnh Test');
});

// ==========================================
// POST /api/network/import — tạo mới toàn bộ chuỗi tổ chức + 9 cột mới
// ==========================================

test('POST /api/network/import role STAFF -> 403', async () => {
  const { status } = await call('POST', '/api/network/import', {
    token: staffToken,
    body: { rows: [{ maMbc: 'X', tenBuuCuc: 'Y' }] }
  });
  assert.equal(status, 403);
});

test('POST /api/network/import rows rỗng -> 400', async () => {
  const { status } = await call('POST', '/api/network/import', { token: mgrToken, body: { rows: [] } });
  assert.equal(status, 400);
});

test('POST /api/network/import thiếu maMbc -> 400 fail-fast, không ghi dòng nào', async () => {
  const before_ = poCount();
  const { status, body } = await call('POST', '/api/network/import', {
    token: mgrToken,
    body: {
      rows: [
        { maBdtTp: '53', maBdx: 'NETC1', maMbc: 'NETPO_OK_BEFORE', tenBuuCuc: 'Hợp lệ trước' },
        { tenBuuCuc: 'Thiếu mã' } // thiếu maMbc
      ]
    }
  });
  assert.equal(status, 400);
  assert.ok(Array.isArray(body.errors));
  assert.ok(body.errors.some((e) => e.row === 2));
  assert.equal(poCount(), before_, 'fail-fast: không ghi dòng nào kể cả dòng hợp lệ đứng trước');
});

test('POST /api/network/import bưu cục hoàn toàn mới -> tạo đúng province/commune/post_office + 9 cột mới', async () => {
  const rows = [{
    maBdtTp: 'NETP', tenBdtTp: 'Tỉnh Mạng Lưới',
    maBdx: 'NETC', tenBuuDienXa: 'BĐX Mạng Lưới', buuDienXaTrungTam: 'NETC-TT',
    maMbc: 'NETPO', tenBuuCuc: 'Bưu Cục Mạng Lưới', loai: 'GD2',
    diaChiChiTiet: '456 Đường Mạng', maBdkv: 'KVNET', tenBdkv: 'Khu Vực Mạng',
    maPhuongXaCu: 'PXC01', tenPhuongXaCu: 'Phường Cũ 1', tenQuanHuyen: 'Quận Test',
    maPhuongXaMoi: 'PXM01', tenPhuongXaMoi: 'Phường Mới 1', soDienThoai: '0234567890',
    tinhTrangHoatDong: 'ACTIVE', viDo: '16.4637', kinhDo: '107.5909'
  }];

  const { status, body } = await call('POST', '/api/network/import', { token: mgrToken, body: { rows } });
  assert.equal(status, 200);
  assert.equal(body.provincesCreated, 1);
  assert.equal(body.communesCreated, 1);
  assert.equal(body.postOfficesCreated, 1);
  assert.equal(body.postOfficesUpdated, 0);
  assert.equal(body.errors.length, 0);

  const province = ctx.db.prepare("SELECT * FROM province_post_offices WHERE code = 'NETP'").get();
  assert.ok(province);
  const commune = ctx.db.prepare("SELECT * FROM commune_post_offices WHERE code = 'NETC'").get();
  assert.ok(commune);
  assert.equal(commune.province_id, province.id);
  assert.equal(commune.central_commune_code, 'NETC-TT');

  const po = ctx.db.prepare("SELECT * FROM post_offices WHERE code = 'NETPO'").get();
  assert.ok(po);
  assert.equal(po.commune_id, commune.id);
  assert.equal(po.type, 'GD2');
  assert.equal(po.bdkv_code, 'KVNET');
  // 9 cột mới:
  assert.equal(po.old_ward_code, 'PXC01');
  assert.equal(po.old_ward_name, 'Phường Cũ 1');
  assert.equal(po.district_name, 'Quận Test');
  assert.equal(po.new_ward_code, 'PXM01');
  assert.equal(po.new_ward_name, 'Phường Mới 1');
  assert.equal(po.phone, '0234567890');
  assert.equal(po.operational_status, 'ACTIVE');
  assert.equal(po.latitude, 16.4637);
  assert.equal(po.longitude, 107.5909);
});

test('POST /api/network/import lại cùng maMbc với field mới -> UPDATE (postOfficesUpdated), không tạo trùng', async () => {
  const beforePoTotal = poCount();
  const rows = [{
    maMbc: 'NETPO', // đã tồn tại từ test trước
    soDienThoai: '0999888777', tinhTrangHoatDong: 'INACTIVE'
  }];
  const { status, body } = await call('POST', '/api/network/import', { token: mgrToken, body: { rows } });
  assert.equal(status, 200);
  assert.equal(body.postOfficesCreated, 0);
  assert.equal(body.postOfficesUpdated, 1);
  assert.equal(poCount(), beforePoTotal, 'không tạo trùng bưu cục');

  const po = ctx.db.prepare("SELECT * FROM post_offices WHERE code = 'NETPO'").get();
  assert.equal(po.phone, '0999888777', 'field có gửi được ghi đè');
  assert.equal(po.operational_status, 'INACTIVE');
  assert.equal(po.old_ward_code, 'PXC01', 'field không gửi phải giữ nguyên');
  assert.equal(po.district_name, 'Quận Test', 'field không gửi phải giữ nguyên');
  assert.equal(po.latitude, 16.4637, 'toạ độ không gửi phải giữ nguyên');
});

// ==========================================
// GET /api/network/export-data — 20 field đúng key
// ==========================================

test('GET /api/network/export-data -> 200, export bưu cục NETPO đủ 20 field đúng key', async () => {
  const { status, body } = await call('GET', '/api/network/export-data', { token: mgrToken });
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.items));

  const row = body.items.find((it) => it.maMbc === 'NETPO');
  assert.ok(row, 'phải thấy NETPO trong export');
  assert.equal(row.maBdtTp, 'NETP');
  assert.equal(row.tenBdtTp, 'Tỉnh Mạng Lưới');
  assert.equal(row.maBdx, 'NETC');
  assert.equal(row.buuDienXaTrungTam, 'NETC-TT');
  assert.equal(row.tenBuuCuc, 'Bưu Cục Mạng Lưới');
  assert.equal(row.loai, 'GD2');
  assert.equal(row.maPhuongXaCu, 'PXC01');
  assert.equal(row.tenQuanHuyen, 'Quận Test');
  assert.equal(row.maPhuongXaMoi, 'PXM01');
  assert.equal(row.soDienThoai, '0999888777');
  assert.equal(row.tinhTrangHoatDong, 'INACTIVE');
  assert.equal(row.viDo, 16.4637);
  assert.equal(row.kinhDo, 107.5909);
});

test('GET /api/network/export-data -> import lại đúng dữ liệu vừa export (idempotent, không tạo trùng)', async () => {
  const { body: exp } = await call('GET', '/api/network/export-data', { token: mgrToken });
  const beforeTotal = poCount();

  const { status, body } = await call('POST', '/api/network/import', { token: mgrToken, body: { rows: exp.items } });
  assert.equal(status, 200);
  assert.equal(body.postOfficesCreated, 0, 'mọi bưu cục đã tồn tại -> chỉ UPDATE');
  assert.equal(body.postOfficesUpdated, exp.items.length);
  assert.equal(poCount(), beforeTotal, 'không tạo trùng bưu cục');
});

// ==========================================
// PUT /api/network/post-offices/:id — sửa bưu cục (gồm 9 cột mới)
// ==========================================

test('PUT /api/network/post-offices/:id không tồn tại -> 404', async () => {
  const { status } = await call('PUT', '/api/network/post-offices/khong-ton-tai', {
    token: mgrToken, body: { name: 'X' }
  });
  assert.equal(status, 404);
});

test('PUT /api/network/post-offices/:id role STAFF -> 403', async () => {
  const po = ctx.db.prepare("SELECT id FROM post_offices WHERE code = 'NETPO'").get();
  const { status } = await call('PUT', `/api/network/post-offices/${po.id}`, {
    token: staffToken, body: { name: 'Đổi bởi staff' }
  });
  assert.equal(status, 403);
});

test('PUT /api/network/post-offices/:id hợp lệ -> 200, sửa đúng field mới + giữ field không gửi', async () => {
  const po = ctx.db.prepare("SELECT * FROM post_offices WHERE code = 'NETPO'").get();
  const { status } = await call('PUT', `/api/network/post-offices/${po.id}`, {
    token: mgrToken,
    body: { district_name: 'Quận Đã Sửa', phone: '0111222333' }
  });
  assert.equal(status, 200);

  const after_ = ctx.db.prepare("SELECT * FROM post_offices WHERE id = ?").get(po.id);
  assert.equal(after_.district_name, 'Quận Đã Sửa', 'field có gửi được ghi đè');
  assert.equal(after_.phone, '0111222333');
  assert.equal(after_.old_ward_code, 'PXC01', 'field không gửi giữ nguyên');
  assert.equal(after_.name, po.name, 'name không gửi giữ nguyên');
});

test('PUT /api/network/post-offices/:id name rỗng -> 400', async () => {
  const po = ctx.db.prepare("SELECT id FROM post_offices WHERE code = 'NETPO'").get();
  const { status } = await call('PUT', `/api/network/post-offices/${po.id}`, {
    token: mgrToken, body: { name: '   ' }
  });
  assert.equal(status, 400);
});

// ==========================================
// DELETE /api/network/post-offices/:id — chặn khi có FK, xoá được khi không
// ==========================================

test('DELETE /api/network/post-offices/:id đang có thiết bị liên kết -> 400 chặn rõ ràng', async () => {
  // Tạo 1 bưu cục riêng có thiết bị tham chiếu.
  await call('POST', '/api/network/import', {
    token: mgrToken,
    body: { rows: [{ maBdtTp: 'NETP', maBdx: 'NETC', maMbc: 'NETPO_WITHEQ', tenBuuCuc: 'Bưu cục có thiết bị' }] }
  });
  const po = ctx.db.prepare("SELECT id FROM post_offices WHERE code = 'NETPO_WITHEQ'").get();

  // Gắn 1 thiết bị vào bưu cục này (FK equipments.post_office_id -> post_offices.id).
  const createRes = await fetch(`${ctx.baseUrl}/api/equipments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mgrToken}` },
    body: JSON.stringify({
      device_type_id: fixtures.deviceTypeId,
      post_office_id: po.id,
      hostname: 'PC-NETPO-WITHEQ'
    })
  });
  assert.equal(createRes.status, 201);

  const { status, body } = await call('DELETE', `/api/network/post-offices/${po.id}`, { token: mgrToken });
  assert.equal(status, 400);
  assert.match(body.error, /không thể xoá/i);

  // Bưu cục vẫn còn (không bị xoá).
  assert.ok(ctx.db.prepare("SELECT id FROM post_offices WHERE id = ?").get(po.id), 'bưu cục có FK không được xoá');
});

test('DELETE /api/network/post-offices/:id không có gì tham chiếu -> 200 xoá được', async () => {
  await call('POST', '/api/network/import', {
    token: mgrToken,
    body: { rows: [{ maBdtTp: 'NETP', maBdx: 'NETC', maMbc: 'NETPO_EMPTY', tenBuuCuc: 'Bưu cục trống' }] }
  });
  const po = ctx.db.prepare("SELECT id FROM post_offices WHERE code = 'NETPO_EMPTY'").get();
  assert.ok(po);

  const { status } = await call('DELETE', `/api/network/post-offices/${po.id}`, { token: mgrToken });
  assert.equal(status, 200);
  assert.equal(ctx.db.prepare("SELECT COUNT(*) c FROM post_offices WHERE id = ?").get(po.id).c, 0, 'đã xoá cứng khỏi DB');
});

test('DELETE /api/network/post-offices/:id role STAFF -> 403', async () => {
  const po = ctx.db.prepare("SELECT id FROM post_offices WHERE code = 'NETPO'").get();
  const { status } = await call('DELETE', `/api/network/post-offices/${po.id}`, { token: staffToken });
  assert.equal(status, 403);
});
