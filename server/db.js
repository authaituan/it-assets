const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'ccdc.db');
const dataDir = path.join(__dirname, '..', 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Initialize database schema tables
db.exec(`
  -- Province table (BĐT/TP)
  CREATE TABLE IF NOT EXISTS province_post_offices (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Commune table (BĐX - Bưu điện Xã)
  CREATE TABLE IF NOT EXISTS commune_post_offices (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    central_commune_code TEXT,
    province_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(province_id) REFERENCES province_post_offices(id)
  );

  -- Post Office table (MBC - Bưu cục)
  CREATE TABLE IF NOT EXISTS post_offices (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'GD3',
    address TEXT,
    commune_id TEXT NOT NULL,
    bdkv_code TEXT,
    bdkv_name TEXT,
    has_computer INTEGER DEFAULT 1,
    old_ward_code TEXT,          -- Mã Phường/Xã CŨ (trước sáp nhập)
    old_ward_name TEXT,          -- Tên Phường/Xã CŨ
    district_name TEXT,          -- Tên Quận/Huyện
    new_ward_code TEXT,          -- Mã Phường/Xã MỚI (sau sáp nhập)
    new_ward_name TEXT,          -- Tên Phường/Xã MỚI
    phone TEXT,                  -- Số điện thoại bưu cục
    operational_status TEXT DEFAULT 'ACTIVE', -- Tình trạng hoạt động
    latitude REAL,               -- Vĩ độ (toạ độ bản đồ)
    longitude REAL,              -- Kinh độ
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(commune_id) REFERENCES commune_post_offices(id)
  );

  -- User / Employee table (Nhân sự chuẩn HRM)
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    hrm_code TEXT UNIQUE,
    full_name TEXT NOT NULL,
    raw_name TEXT,
    post_office_code TEXT,
    commune_code TEXT,
    post_office_id TEXT,
    role TEXT DEFAULT 'STAFF',
    password_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deactivated_at DATETIME DEFAULT NULL, -- vô hiệu hoá: NULL = còn hoạt động, có giá trị = đã bị khoá
    FOREIGN KEY(post_office_id) REFERENCES post_offices(id)
  );

  -- Device Types table (Loại thiết bị: Máy tính, Máy in, Máy quét, Thiết bị mạng, UPS, Camera...)
  CREATE TABLE IF NOT EXISTS device_types (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    icon TEXT,
    description TEXT,
    asset_prefix TEXT -- tiền tố sinh mã CCDC (vd 'LAP', 'PC'); NULL = chưa cấu hình
  );

  -- Brands table
  CREATE TABLE IF NOT EXISTS brands (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
  );

  -- Equipment table (CCDC Thiết bị CNTT)
  CREATE TABLE IF NOT EXISTS equipments (
    id TEXT PRIMARY KEY,
    asset_tag TEXT UNIQUE,
    hostname TEXT,
    ip_address TEXT,
    mac_address TEXT,
    serial_number TEXT,
    device_type_id TEXT NOT NULL,
    brand_id TEXT,
    model TEXT,
    specs TEXT, -- JSON string for flexible hardware specs
    status TEXT DEFAULT 'IN_USE', -- IN_USE, IN_STOCK, MAINTENANCE, BROKEN, LIQUIDATED
    assigned_date TEXT,
    post_office_id TEXT NOT NULL,
    assigned_user_id TEXT,
    raw_user_name TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL, -- soft-delete: NULL = còn hoạt động, có giá trị = đã "xoá"
    purchase_year INTEGER, -- năm mua (phục vụ sinh mã CCDC <PREFIX>-<YY>-<seq>); NULL = chưa nhập
    FOREIGN KEY(device_type_id) REFERENCES device_types(id),
    FOREIGN KEY(brand_id) REFERENCES brands(id),
    FOREIGN KEY(post_office_id) REFERENCES post_offices(id),
    FOREIGN KEY(assigned_user_id) REFERENCES users(id)
  );

  -- Transfer & Action History Logs
  CREATE TABLE IF NOT EXISTS asset_transfer_logs (
    id TEXT PRIMARY KEY,
    equipment_id TEXT NOT NULL,
    action TEXT NOT NULL, -- CREATE, UPDATE, TRANSFER, ASSIGN, RECLAIM, MAINTENANCE, HRM_SYNC
    from_post_office_id TEXT,
    to_post_office_id TEXT,
    from_user_id TEXT,
    to_user_id TEXT,
    reason TEXT,
    transferred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(equipment_id) REFERENCES equipments(id)
  );
`);

// ==========================================
// Migration an toàn cho DB đã tồn tại:
// Thêm cột password_hash vào bảng users nếu chưa có (idempotent).
// ==========================================
try {
  const userCols = db.prepare("PRAGMA table_info(users)").all();
  const hasPasswordHash = userCols.some((col) => col.name === 'password_hash');
  if (!hasPasswordHash) {
    db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT");
    console.log('[db] Migration: đã thêm cột users.password_hash');
  }
} catch (err) {
  console.error('[db] Lỗi migration password_hash:', err.message);
}

// ==========================================
// Migration an toàn cho DB đã tồn tại:
// Thêm cột deleted_at vào bảng equipments nếu chưa có (idempotent, phục vụ soft-delete).
// ==========================================
try {
  const equipmentCols = db.prepare("PRAGMA table_info(equipments)").all();
  const hasDeletedAt = equipmentCols.some((col) => col.name === 'deleted_at');
  if (!hasDeletedAt) {
    db.exec("ALTER TABLE equipments ADD COLUMN deleted_at DATETIME DEFAULT NULL");
    console.log('[db] Migration: đã thêm cột equipments.deleted_at (soft-delete)');
  }
} catch (err) {
  console.error('[db] Lỗi migration deleted_at:', err.message);
}

// ==========================================
// Migration an toàn cho DB đã tồn tại:
// Thêm cột deactivated_at vào bảng users nếu chưa có (idempotent, phục vụ
// vô hiệu hoá tài khoản — cùng pattern với equipments.deleted_at ở trên).
// ==========================================
try {
  const userCols2 = db.prepare("PRAGMA table_info(users)").all();
  const hasDeactivatedAt = userCols2.some((col) => col.name === 'deactivated_at');
  if (!hasDeactivatedAt) {
    db.exec("ALTER TABLE users ADD COLUMN deactivated_at DATETIME DEFAULT NULL");
    console.log('[db] Migration: đã thêm cột users.deactivated_at (vô hiệu hoá tài khoản)');
  }
} catch (err) {
  console.error('[db] Lỗi migration deactivated_at:', err.message);
}

// ==========================================
// Migration an toàn cho DB đã tồn tại:
// Thêm cột device_types.asset_prefix (tiền tố sinh mã CCDC). Khi cột được
// thêm LẦN ĐẦU, seed 1 lần giá trị mặc định cho các danh mục ĐANG CÓ tại
// thời điểm đó (chỉ chạy đúng 1 lần, guard bởi !hasAssetPrefix) — dựa theo
// `code` hiện có. Danh mục tạo MỚI sau này (asset_prefix NULL) sẽ KHÔNG bị
// seed lại, cố tình để trống buộc quản lý tự đặt tiền tố (nếu không, POST
// /api/equipments sẽ chặn tạo thiết bị với thông báo rõ ràng).
// Bảng quy ước tiền tố PO cung cấp: LAP/PC/MNT/PRN/PTO/PRO/SW/RTR/AP/PHN.
// Danh mục không khớp rõ ràng -> tạm dùng 3 ký tự đầu của code (viết hoa),
// LIỆT KÊ trong báo cáo để PO chỉnh lại qua UI Quản Lý Danh Mục.
// ==========================================
try {
  const dtCols = db.prepare("PRAGMA table_info(device_types)").all();
  const hasAssetPrefix = dtCols.some((col) => col.name === 'asset_prefix');
  if (!hasAssetPrefix) {
    db.exec("ALTER TABLE device_types ADD COLUMN asset_prefix TEXT");

    // Map keyed theo `code` thật đang có trong DB (đã đọc trực tiếp, không đoán).
    const PREFIX_BY_CODE = {
      COMPUTER: 'PC',            // Máy tính & POS (mixed desktop+laptop+POS) — PO cân nhắc tách PC/LAP
      PRINTER: 'PRN',           // Máy in Bưu chính
      M_Y_CHI_U___KIOSK: 'PRO', // Máy Chiếu & Kiosk (mixed projector+kiosk)
      NETWORK: 'NET',           // Thiết bị Mạng (mixed switch/router/AP) — tạm, 3 ký tự code
      SCANNER: 'SCA',           // Máy quét mã vạch — tạm, trùng SCALE (PO chỉnh lại)
      UPS: 'UPS',               // Bộ lưu điện — tạm, 3 ký tự code
      CAMERA: 'CAM',            // Camera an ninh — tạm, 3 ký tự code
      SCALE: 'SCA'              // Cân điện tử — tạm, trùng SCANNER (PO chỉnh lại)
    };
    const existingTypes = db.prepare("SELECT id, code FROM device_types").all();
    const updPrefix = db.prepare("UPDATE device_types SET asset_prefix = ? WHERE id = ?");
    for (const dt of existingTypes) {
      const fallback = (dt.code || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'GEN';
      const prefix = PREFIX_BY_CODE[dt.code] || fallback;
      updPrefix.run(prefix, dt.id);
    }
    console.log(`[db] Migration: đã thêm cột device_types.asset_prefix + seed prefix cho ${existingTypes.length} danh mục hiện có`);
  }
} catch (err) {
  console.error('[db] Lỗi migration asset_prefix:', err.message);
}

// ==========================================
// Migration an toàn cho DB đã tồn tại:
// Thêm cột equipments.purchase_year (năm mua, phục vụ sinh mã CCDC). NULL
// với các thiết bị cũ (chấp nhận được — mã cũ CCDC-... giữ nguyên, không đổi).
// ==========================================
try {
  const eqCols2 = db.prepare("PRAGMA table_info(equipments)").all();
  const hasPurchaseYear = eqCols2.some((col) => col.name === 'purchase_year');
  if (!hasPurchaseYear) {
    db.exec("ALTER TABLE equipments ADD COLUMN purchase_year INTEGER");
    console.log('[db] Migration: đã thêm cột equipments.purchase_year');
  }
} catch (err) {
  console.error('[db] Lỗi migration purchase_year:', err.message);
}

// ==========================================
// Migration an toàn cho DB đã tồn tại (idempotent, cùng pattern các migration
// ở trên): thêm 9 cột mới vào bảng post_offices phục vụ module "Quản Lý Mạng
// Lưới" (feat/network-management-backend). Các cột này ánh xạ 1-1 với file
// Excel mạng lưới PO cung cấp. Bưu cục cũ (353 bưu cục seed ban đầu) sẽ có
// giá trị NULL ở các cột mới — chấp nhận được, PO cập nhật dần qua Import
// Mạng Lưới hoặc sửa từng bưu cục. Cột operational_status mặc định 'ACTIVE'.
// ==========================================
try {
  const poCols = db.prepare("PRAGMA table_info(post_offices)").all();
  const poColSet = new Set(poCols.map((col) => col.name));
  const newPoColumns = [
    ['old_ward_code', 'TEXT'],
    ['old_ward_name', 'TEXT'],
    ['district_name', 'TEXT'],
    ['new_ward_code', 'TEXT'],
    ['new_ward_name', 'TEXT'],
    ['phone', 'TEXT'],
    ['operational_status', "TEXT DEFAULT 'ACTIVE'"],
    ['latitude', 'REAL'],
    ['longitude', 'REAL']
  ];
  const added = [];
  for (const [colName, colType] of newPoColumns) {
    if (!poColSet.has(colName)) {
      db.exec(`ALTER TABLE post_offices ADD COLUMN ${colName} ${colType}`);
      added.push(colName);
    }
  }
  if (added.length > 0) {
    console.log(`[db] Migration: đã thêm ${added.length} cột mới vào post_offices (Quản Lý Mạng Lưới): ${added.join(', ')}`);
  }
} catch (err) {
  console.error('[db] Lỗi migration post_offices network columns:', err.message);
}

module.exports = db;
