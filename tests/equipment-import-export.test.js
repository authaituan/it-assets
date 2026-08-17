// ==========================================
// Test: Equipment Import/Export API (server/index.js — EQUIPMENTS CRUD section)
// Evidence: GET /api/equipments/export-data, POST /api/equipments/import.
// Phủ: export đúng field (24 field gốc A-X + 7 field mới), import tạo mới
// toàn bộ chuỗi tổ chức từ đầu, import CẬP NHẬT thiết bị qua maCcdc không
// làm mất field không có trong dòng import, import danh mục mới thiếu tiền
// tố -> lỗi rõ ràng, import thiếu maMbc -> lỗi fail-fast không ghi dòng nào.
// ==========================================
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, waitForServer, cleanupDbFiles, closeServer } = require('./helpers/serverHarness');
const { seedMinimalOrg, seedUser } = require('./helpers/fixtures');

const PORT = 5905;
const MGR_HRM = 'IMPEXP_MGR';
const MGR_PASS = 'Manager@123';
const STAFF_HRM = 'IMPEXP_STAFF';
const STAFF_PASS = 'Staff@123';

let ctx;
let fixtures;
let mgrToken;
let staffToken;

before(async () => {
  ctx = startTestServer({ port: PORT, dbFileName: `ccdc-test-impexp-${Date.now()}.db` });
  await waitForServer(ctx.baseUrl);
  fixtures = seedMinimalOrg(ctx.db);
  seedUser(ctx.db, { hrmCode: MGR_HRM, fullName: 'ImpExp Manager', role: 'ADMIN', password: MGR_PASS });
  seedUser(ctx.db, { hrmCode: STAFF_HRM, fullName: 'ImpExp Staff', role: 'STAFF', password: STAFF_PASS });

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

function equipmentCount() {
  return ctx.db.prepare('SELECT COUNT(*) c FROM equipments').get().c;
}

// ==========================================
// GET /api/equipments/export-data
// ==========================================

test('GET /api/equipments/export-data không có token -> 401', async () => {
  const res = await fetch(`${ctx.baseUrl}/api/equipments/export-data`);
  assert.equal(res.status, 401);
});

test('GET /api/equipments/export-data role STAFF -> 403', async () => {
  const { status } = await call('GET', '/api/equipments/export-data', { token: staffToken });
  assert.equal(status, 403);
});

test('GET /api/equipments/export-data role quản lý -> 200, trả đủ 31 field đúng key', async () => {
  const { body: personnel } = await call('POST', '/api/personnel', {
    token: mgrToken,
    body: { hrm_code: 'EXPORT_USER_01', full_name: 'Nguoi Dung Export' }
  });

  const createRes = await fetch(`${ctx.baseUrl}/api/equipments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mgrToken}` },
    body: JSON.stringify({
      device_type_id: fixtures.deviceTypeId,
      post_office_id: fixtures.postOfficeId,
      hostname: 'PC-EXPORT-01',
      ip_address: '10.0.0.5',
      mac_address: 'AA:BB:CC:DD:EE:FF',
      serial_number: 'SN-EXP-01',
      model: 'OptiPlex 7010',
      brand_name: 'Dell',
      category_raw: 'PC Desktop',
      specs: { os: 'Windows 10', cpu: 'i5-3470', ram: '8GB', storage: 'SSD 256GB' },
      raw_user_name: 'Ten Tho',
      assigned_user_id: personnel.id,
      notes: 'Ghi chu test export',
      purchase_year: 2024
    })
  });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();

  const { status, body } = await call('GET', '/api/equipments/export-data', { token: mgrToken });
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.items));

  const row = body.items.find((it) => it.maCcdc === created.asset_tag);
  assert.ok(row, 'phải tìm thấy dòng vừa tạo trong export');

  // 24 field gốc A-X
  assert.equal(row.maBdtTp, fixtures.provinceCode);
  assert.equal(row.maMbc, fixtures.postOfficeCode);
  assert.equal(row.maBdx, fixtures.communeCode);
  assert.equal(row.tenMay, 'PC-EXPORT-01');
  assert.equal(row.ip, '10.0.0.5');
  assert.equal(row.diaChiMac, 'AA:BB:CC:DD:EE:FF');
  assert.equal(row.loaiMay, 'PC Desktop');
  assert.equal(row.hang, 'Dell');
  assert.equal(row.model, 'OptiPlex 7010');
  assert.equal(row.serialNumber, 'SN-EXP-01');
  assert.equal(row.heDieuHanh, 'Windows 10');
  assert.equal(row.cpu, 'i5-3470');
  assert.equal(row.ram, '8GB');
  assert.equal(row.oCung, 'SSD 256GB');
  assert.equal(row.nguoiSuDung, 'Ten Tho');

  // 7 field mới
  assert.equal(row.maCcdc, created.asset_tag);
  assert.equal(row.danhMucCcdc, 'Máy Test');
  assert.equal(row.tienToDanhMucMoi, '', 'luôn rỗng lúc export');
  assert.equal(row.namMua, 2024);
  assert.equal(row.maHrmNguoiSuDung, 'EXPORT_USER_01');
  assert.equal(row.trangThai, 'IN_USE');
  assert.equal(row.ghiChu, 'Ghi chu test export');
});

test('GET /api/equipments/export-data tôn trọng filter status (tái sử dụng WHERE của GET /api/equipments)', async () => {
  const { status, body } = await call('GET', '/api/equipments/export-data?status=BROKEN', { token: mgrToken });
  assert.equal(status, 200);
  assert.ok(body.items.every((it) => it.trangThai === 'BROKEN'));
});

// ==========================================
// POST /api/equipments/import — validate fail-fast
// ==========================================

test('POST /api/equipments/import rows rỗng -> 400', async () => {
  const { status } = await call('POST', '/api/equipments/import', { token: mgrToken, body: { rows: [] } });
  assert.equal(status, 400);
});

test('POST /api/equipments/import thiếu maMbc -> 400, KHÔNG ghi dòng nào (kể cả dòng hợp lệ đứng trước)', async () => {
  const before_ = equipmentCount();
  const { status, body } = await call('POST', '/api/equipments/import', {
    token: mgrToken,
    body: {
      rows: [
        { maMbc: fixtures.postOfficeCode, tenMay: 'HOP-LE-DUNG-TRUOC', danhMucCcdc: 'Máy Test' },
        { tenMay: 'THIEU-MA-MBC' } // thiếu maMbc
      ]
    }
  });
  assert.equal(status, 400);
  assert.ok(Array.isArray(body.errors));
  assert.ok(body.errors.some((e) => e.row === 2));
  assert.equal(equipmentCount(), before_, 'fail-fast: không ghi dòng nào kể cả dòng hợp lệ đứng trước dòng lỗi');
});

test('POST /api/equipments/import thiếu cả tenMay lẫn maCcdc -> 400', async () => {
  const { status, body } = await call('POST', '/api/equipments/import', {
    token: mgrToken,
    body: { rows: [{ maMbc: fixtures.postOfficeCode }] }
  });
  assert.equal(status, 400);
  assert.ok(body.errors.some((e) => e.row === 1));
});

test('POST /api/equipments/import role STAFF -> 403', async () => {
  const { status } = await call('POST', '/api/equipments/import', {
    token: staffToken,
    body: { rows: [{ maMbc: fixtures.postOfficeCode, tenMay: 'X' }] }
  });
  assert.equal(status, 403);
});

// ==========================================
// POST /api/equipments/import — PHƯƠNG ÁN B: KHÔNG còn tự tạo tổ chức mới.
// Mã bưu cục chưa tồn tại -> CHẶN 400, không ghi dòng nào (fail-fast).
// (Test này thay thế test "tạo mới toàn bộ chuỗi tổ chức từ đầu" cũ — hành vi
// tự tạo tổ chức đã chuyển hẳn sang route Quản Lý Mạng Lưới.)
// ==========================================

test('POST /api/equipments/import mã bưu cục CHƯA tồn tại -> 400, KHÔNG tự tạo tổ chức, không ghi dòng nào', async () => {
  const beforeEq = equipmentCount();
  const beforeProvince = ctx.db.prepare('SELECT COUNT(*) c FROM province_post_offices').get().c;
  const beforeCommune = ctx.db.prepare('SELECT COUNT(*) c FROM commune_post_offices').get().c;
  const beforePo = ctx.db.prepare('SELECT COUNT(*) c FROM post_offices').get().c;

  const rows = [{
    maBdtTp: 'NEWP', tenBdtTp: 'Tỉnh Mới',
    maBdx: 'NEWC', tenBuuDienXa: 'BĐX Mới', buuDienXaTrungTam: 'NEWC-TT',
    maMbc: 'MBC-KHONG-TON-TAI', tenBuuCuc: 'Bưu Cục Mới', loai: 'GD1',
    tenMay: 'PC-NEW-ORG-01',
    danhMucCcdc: 'Máy Test'
  }];

  const { status, body } = await call('POST', '/api/equipments/import', { token: mgrToken, body: { rows } });
  assert.equal(status, 400);
  assert.match(body.error, /Quản Lý Mạng Lưới/, 'thông báo phải chỉ dẫn thêm bưu cục qua Quản Lý Mạng Lưới');

  // Rollback toàn bộ: KHÔNG tạo tổ chức mới, KHÔNG ghi thiết bị nào.
  assert.equal(equipmentCount(), beforeEq, 'không được tạo thiết bị');
  assert.equal(ctx.db.prepare('SELECT COUNT(*) c FROM province_post_offices').get().c, beforeProvince, 'không được tự tạo tỉnh');
  assert.equal(ctx.db.prepare('SELECT COUNT(*) c FROM commune_post_offices').get().c, beforeCommune, 'không được tự tạo BĐX');
  assert.equal(ctx.db.prepare('SELECT COUNT(*) c FROM post_offices').get().c, beforePo, 'không được tự tạo bưu cục');
  assert.equal(ctx.db.prepare("SELECT COUNT(*) c FROM province_post_offices WHERE code = 'NEWP'").get().c, 0);
});

test('POST /api/equipments/import mã bưu cục ĐÃ tồn tại (seed) -> tạo thiết bị bình thường, provincesCreated/communesCreated/postOfficesCreated luôn = 0', async () => {
  const rows = [{
    maMbc: fixtures.postOfficeCode, // bưu cục seed sẵn (TESTPO)
    tenMay: 'PC-EXISTING-PO-01',
    danhMucCcdc: 'Máy Test'
  }];

  const { status, body } = await call('POST', '/api/equipments/import', { token: mgrToken, body: { rows } });
  assert.equal(status, 200);
  assert.equal(body.equipmentsCreated, 1);
  assert.equal(body.provincesCreated, 0, 'route Equipment Import không còn tạo tỉnh');
  assert.equal(body.communesCreated, 0, 'route Equipment Import không còn tạo BĐX');
  assert.equal(body.postOfficesCreated, 0, 'route Equipment Import không còn tạo bưu cục');

  const eq = ctx.db.prepare("SELECT * FROM equipments WHERE hostname = 'PC-EXISTING-PO-01'").get();
  assert.ok(eq);
  assert.equal(eq.post_office_id, fixtures.postOfficeId);
});

// ==========================================
// POST /api/equipments/import — CẬP NHẬT qua maCcdc, không mất field vắng mặt
// ==========================================

test('POST /api/equipments/import cập nhật qua maCcdc CHỈ ghi đè field có giá trị, giữ nguyên field không gửi', async () => {
  const createRes = await fetch(`${ctx.baseUrl}/api/equipments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mgrToken}` },
    body: JSON.stringify({
      device_type_id: fixtures.deviceTypeId,
      post_office_id: fixtures.postOfficeId,
      hostname: 'PC-UPDATE-ORIGINAL',
      ip_address: '10.0.0.99',
      mac_address: 'FF:FF:FF:FF:FF:FF',
      serial_number: 'SN-ORIGINAL',
      model: 'Model Goc',
      notes: 'Ghi chu goc',
      specs: { cpu: 'i7-Goc', ram: '16GB' }
    })
  });
  const created = await createRes.json();
  const assetTag = created.asset_tag;

  // Import chỉ gửi maMbc + maCcdc + 1 field cần sửa (hostname) -> các field khác PHẢI giữ nguyên.
  const { status, body } = await call('POST', '/api/equipments/import', {
    token: mgrToken,
    body: {
      rows: [{
        maMbc: fixtures.postOfficeCode,
        maCcdc: assetTag,
        tenMay: 'PC-UPDATE-CHANGED'
      }]
    }
  });
  assert.equal(status, 200);
  assert.equal(body.equipmentsUpdated, 1);
  assert.equal(body.equipmentsCreated, 0);

  const row = ctx.db.prepare('SELECT * FROM equipments WHERE id = ?').get(created.id);
  assert.equal(row.hostname, 'PC-UPDATE-CHANGED', 'field có gửi phải được ghi đè');
  assert.equal(row.ip_address, '10.0.0.99', 'field không gửi phải giữ nguyên');
  assert.equal(row.mac_address, 'FF:FF:FF:FF:FF:FF', 'field không gửi phải giữ nguyên');
  assert.equal(row.serial_number, 'SN-ORIGINAL', 'field không gửi phải giữ nguyên');
  assert.equal(row.model, 'Model Goc', 'field không gửi phải giữ nguyên');
  assert.equal(row.notes, 'Ghi chu goc', 'field không gửi phải giữ nguyên');
  assert.equal(row.asset_tag, assetTag, 'asset_tag KHÔNG được đổi dù cập nhật');

  const specs = JSON.parse(row.specs);
  assert.equal(specs.cpu, 'i7-Goc', 'specs sub-field không gửi phải giữ nguyên');
  assert.equal(specs.ram, '16GB', 'specs sub-field không gửi phải giữ nguyên');
});

test('POST /api/equipments/import maCcdc không tồn tại -> 400 rõ ràng', async () => {
  const before_ = equipmentCount();
  const { status, body } = await call('POST', '/api/equipments/import', {
    token: mgrToken,
    body: { rows: [{ maMbc: fixtures.postOfficeCode, maCcdc: 'KHONG-TON-TAI-999' }] }
  });
  assert.equal(status, 400);
  assert.match(body.error, /không tồn tại/);
  assert.equal(equipmentCount(), before_);
});

// ==========================================
// POST /api/equipments/import — danh mục mới thiếu tiền tố -> lỗi rõ ràng
// ==========================================

test('POST /api/equipments/import danh mục CCDC mới KHÔNG kèm tienToDanhMucMoi -> 400 rõ ràng, không ghi gì', async () => {
  const beforeEq = equipmentCount();
  const beforeDt = ctx.db.prepare('SELECT COUNT(*) c FROM device_types').get().c;

  const { status, body } = await call('POST', '/api/equipments/import', {
    token: mgrToken,
    body: {
      rows: [{
        maMbc: fixtures.postOfficeCode,
        tenMay: 'PC-DANHMUC-MOI-KHONG-PREFIX',
        danhMucCcdc: 'Danh Muc Hoan Toan Moi Chua Co Prefix'
      }]
    }
  });
  assert.equal(status, 400);
  assert.match(body.error, /tienToDanhMucMoi/);

  assert.equal(equipmentCount(), beforeEq, 'không được tạo thiết bị khi lỗi');
  assert.equal(ctx.db.prepare('SELECT COUNT(*) c FROM device_types').get().c, beforeDt, 'không được tạo device_type khi lỗi (rollback)');
});

test('POST /api/equipments/import danh mục CCDC mới CÓ tienToDanhMucMoi hợp lệ -> tạo được device_type + thiết bị', async () => {
  const { status, body } = await call('POST', '/api/equipments/import', {
    token: mgrToken,
    body: {
      rows: [{
        maMbc: fixtures.postOfficeCode,
        tenMay: 'PC-DANHMUC-MOI-CO-PREFIX',
        danhMucCcdc: 'Danh Muc Moi Co Prefix',
        tienToDanhMucMoi: 'DM1'
      }]
    }
  });
  assert.equal(status, 200);
  assert.equal(body.deviceTypesCreated, 1);
  assert.equal(body.equipmentsCreated, 1);

  const dt = ctx.db.prepare("SELECT * FROM device_types WHERE name = 'Danh Muc Moi Co Prefix'").get();
  assert.ok(dt);
  assert.equal(dt.asset_prefix, 'DM1');

  const eq = ctx.db.prepare("SELECT * FROM equipments WHERE hostname = 'PC-DANHMUC-MOI-CO-PREFIX'").get();
  assert.ok(eq.asset_tag.startsWith('DM1-'));
});

// ==========================================
// Export -> Import lại chính dữ liệu đó -> idempotent (không tạo trùng)
// ==========================================

test('Export rồi import lại chính dữ liệu -> không tạo trùng lặp gì (idempotent)', async () => {
  const { body: exportBody } = await call('GET', '/api/equipments/export-data', { token: mgrToken });
  const eqCountBefore = equipmentCount();
  const provinceCountBefore = ctx.db.prepare('SELECT COUNT(*) c FROM province_post_offices').get().c;
  const communeCountBefore = ctx.db.prepare('SELECT COUNT(*) c FROM commune_post_offices').get().c;
  const poCountBefore = ctx.db.prepare('SELECT COUNT(*) c FROM post_offices').get().c;

  // Re-import nguyên vẹn dữ liệu vừa export (đã có maCcdc cho mọi dòng -> toàn bộ là UPDATE).
  const { status, body } = await call('POST', '/api/equipments/import', {
    token: mgrToken,
    body: { rows: exportBody.items }
  });
  assert.equal(status, 200);
  assert.equal(body.equipmentsCreated, 0, 'mọi dòng đã có maCcdc -> chỉ UPDATE, không CREATE');
  assert.equal(body.equipmentsUpdated, exportBody.items.length);
  assert.equal(body.provincesCreated, 0);
  assert.equal(body.communesCreated, 0);
  assert.equal(body.postOfficesCreated, 0);

  assert.equal(equipmentCount(), eqCountBefore, 'không tạo trùng thiết bị');
  assert.equal(ctx.db.prepare('SELECT COUNT(*) c FROM province_post_offices').get().c, provinceCountBefore);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) c FROM commune_post_offices').get().c, communeCountBefore);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) c FROM post_offices').get().c, poCountBefore);
});
