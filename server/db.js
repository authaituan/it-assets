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
    FOREIGN KEY(post_office_id) REFERENCES post_offices(id)
  );

  -- Device Types table (Loại thiết bị: Máy tính, Máy in, Máy quét, Thiết bị mạng, UPS, Camera...)
  CREATE TABLE IF NOT EXISTS device_types (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    icon TEXT,
    description TEXT
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

module.exports = db;
