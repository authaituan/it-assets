import sys
import openpyxl
import sqlite3
import uuid
import os
import re

sys.stdout.reconfigure(encoding='utf-8')


db_dir = os.path.join(os.path.dirname(__file__), '..', 'data')
os.makedirs(db_dir, exist_ok=True)
db_path = os.path.join(db_dir, 'ccdc.db')

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Initialize tables
cursor.executescript("""
  CREATE TABLE IF NOT EXISTS province_post_offices (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS commune_post_offices (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    central_commune_code TEXT,
    province_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(province_id) REFERENCES province_post_offices(id)
  );

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

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    hrm_code TEXT UNIQUE,
    full_name TEXT NOT NULL,
    raw_name TEXT,
    post_office_code TEXT,
    commune_code TEXT,
    post_office_id TEXT,
    role TEXT DEFAULT 'STAFF',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(post_office_id) REFERENCES post_offices(id)
  );

  CREATE TABLE IF NOT EXISTS device_types (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    icon TEXT,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS brands (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
  );

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
    specs TEXT,
    status TEXT DEFAULT 'IN_USE',
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

  CREATE TABLE IF NOT EXISTS asset_transfer_logs (
    id TEXT PRIMARY KEY,
    equipment_id TEXT NOT NULL,
    action TEXT NOT NULL,
    from_post_office_id TEXT,
    to_post_office_id TEXT,
    from_user_id TEXT,
    to_user_id TEXT,
    reason TEXT,
    transferred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(equipment_id) REFERENCES equipments(id)
  );

  DELETE FROM asset_transfer_logs;
  DELETE FROM equipments;
  DELETE FROM users;
  DELETE FROM post_offices;
  DELETE FROM commune_post_offices;
  DELETE FROM province_post_offices;
  DELETE FROM device_types;
  DELETE FROM brands;
""")


excel_path = os.path.join(os.path.dirname(__file__), '..', 'dulieu.xlsx')
wb = openpyxl.load_workbook(excel_path, data_only=True)
sheet = wb.active

rows = list(sheet.iter_rows(values_only=True))
headers = [str(cell or '').strip().replace('\n', ' ') for cell in rows[0]]

# Helper function to generate clean UUIDs
def gen_id():
    return str(uuid.uuid4())

# 1. Seed Province (BĐT/TP)
province_code = "53"
province_name = "BĐTP Huế"
province_id = gen_id()

cursor.execute("INSERT OR IGNORE INTO province_post_offices (id, code, name) VALUES (?, ?, ?)", 
               (province_id, province_code, province_name))
cursor.execute("SELECT id FROM province_post_offices WHERE code = ?", (province_code,))
province_id = cursor.fetchone()[0]

# 2. Seed Default Device Types (Máy tính, Máy in, Máy quét, Thiết bị mạng, UPS, Camera, Cân)
default_device_types = [
    ("COMPUTER", "Máy tính & POS", "monitor", "Máy tính để bàn, Laptop, Máy POS giao dịch"),
    ("PRINTER", "Máy in Bưu chính", "printer", "Máy in laser, Máy in tem nhãn, Máy in kim"),
    ("SCANNER", "Máy quét mã vạch", "qr-code", "Barcode scanner 1D/2D cầm tay / để bàn"),
    ("NETWORK", "Thiết bị Mạng", "wifi", "Router, Switch 24-Port, Access Point Wi-Fi"),
    ("UPS", "Bộ lưu điện (UPS)", "zap", "Bộ lưu điện APC, Santak bảo vệ dữ liệu"),
    ("CAMERA", "Camera an ninh", "camera", "CCTV giám sát bưu cục"),
    ("SCALE", "Cân điện tử", "scale", "Cân điện tử bưu gửi")
]

device_type_map = {}
for code, name, icon, desc in default_device_types:
    dt_id = gen_id()
    cursor.execute("INSERT OR IGNORE INTO device_types (id, code, name, icon, description) VALUES (?, ?, ?, ?, ?)",
                   (dt_id, code, name, icon, desc))
    cursor.execute("SELECT id FROM device_types WHERE code = ?", (code,))
    device_type_map[code] = cursor.fetchone()[0]

computer_type_id = device_type_map["COMPUTER"]

# Dictionaries for tracking created records
commune_map = {} # code -> id
post_office_map = {} # code -> id
brand_map = {} # name -> id

rows_data = rows[1:]
print(f"Processing {len(rows_data)} rows from Excel...")

total_communes = 0
total_post_offices = 0
total_equipments = 0

for row in rows_data:
    if not any(row):
        continue
    
    # Extract columns
    bdtp_code = str(row[0] or '').strip()
    bdtp_name = str(row[1] or '').strip()
    mbc_code = str(row[2] or '').strip()
    mbc_name = str(row[3] or '').strip()
    bdx_code = str(row[4] or '').strip()
    bdx_name = str(row[5] or '').strip()
    unit_type = str(row[6] or '').strip()
    ip_addr = str(row[7] or '').strip()
    issued_date = str(row[8] or '').strip() if row[8] else None
    hostname = str(row[9] or '').strip()
    mac_addr = str(row[10] or '').strip()
    device_category = str(row[11] or '').strip()
    brand_name = str(row[12] or '').strip()
    model = str(row[13] or '').strip()
    serial_tag = str(row[14] or '').strip()
    os_name = str(row[15] or '').strip()
    cpu = str(row[16] or '').strip()
    ram = str(row[17] or '').strip()
    storage = str(row[18] or '').strip()
    raw_user_name = str(row[19] or '').strip()
    bdkv_code = str(row[20] or '').strip()
    bdkv_name = str(row[21] or '').strip()
    central_commune_code = str(row[22] or '').strip()
    address = str(row[23] or '').strip()

    if not mbc_code and not mbc_name:
        continue

    # 1. Commune Post Office (BĐX)
    if bdx_code and bdx_code not in commune_map:
        commune_id = gen_id()
        c_name = bdx_name if bdx_name and bdx_name != '0' else f"BĐX {bdx_code}"
        cursor.execute("INSERT OR IGNORE INTO commune_post_offices (id, code, name, central_commune_code, province_id) VALUES (?, ?, ?, ?, ?)",
                       (commune_id, bdx_code, c_name, central_commune_code, province_id))
        cursor.execute("SELECT id FROM commune_post_offices WHERE code = ?", (bdx_code,))
        commune_map[bdx_code] = cursor.fetchone()[0]
        total_communes += 1

    commune_id = commune_map.get(bdx_code)

    # If no BĐX code exists in row, attach to default BĐX '5300' or create general one
    if not commune_id:
        default_bdx = "5300"
        if default_bdx not in commune_map:
            commune_id = gen_id()
            cursor.execute("INSERT OR IGNORE INTO commune_post_offices (id, code, name, province_id) VALUES (?, ?, ?, ?)",
                           (commune_id, default_bdx, "Bưu điện phường Thuận An", province_id))
            cursor.execute("SELECT id FROM commune_post_offices WHERE code = ?", (default_bdx,))
            commune_map[default_bdx] = cursor.fetchone()[0]
        commune_id = commune_map[default_bdx]

    # 2. Post Office (MBC)
    if mbc_code not in post_office_map:
        po_id = gen_id()
        has_comp = 0 if device_category == "Không có máy tính" else 1
        cursor.execute("""
            INSERT OR IGNORE INTO post_offices 
            (id, code, name, type, address, commune_id, bdkv_code, bdkv_name, has_computer)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (po_id, mbc_code, mbc_name, unit_type or 'GD3', address, commune_id, bdkv_code, bdkv_name, has_comp))
        cursor.execute("SELECT id FROM post_offices WHERE code = ?", (mbc_code,))
        post_office_map[mbc_code] = cursor.fetchone()[0]
        total_post_offices += 1

    po_id = post_office_map[mbc_code]

    # Skip equipment insertion if explicitly "Không có máy tính" or empty specs
    if device_category == "Không có máy tính":
        continue

    # 3. Brand
    clean_brand = brand_name
    if brand_name in ["Dell Inc.", "Dell"]:
        clean_brand = "Dell"
    elif brand_name in ["HP", "Hewlett-Packard"]:
        clean_brand = "HP"
    elif brand_name in ["ASUS", "Asus", "ASUSTeK COMPUTER INC."]:
        clean_brand = "ASUS"
    elif brand_name in ["Micro-Star International Co., Ltd.", "MSI"]:
        clean_brand = "MSI"

    brand_id = None
    if clean_brand:
        if clean_brand not in brand_map:
            b_id = gen_id()
            cursor.execute("INSERT OR IGNORE INTO brands (id, name) VALUES (?, ?)", (b_id, clean_brand))
            cursor.execute("SELECT id FROM brands WHERE name = ?", (clean_brand,))
            brand_map[clean_brand] = cursor.fetchone()[0]
        brand_id = brand_map[clean_brand]

    # 4. Equipment
    eq_id = gen_id()
    asset_tag = f"CCDC-{mbc_code}-{total_equipments+1:04d}"
    
    # Store dynamic specs in JSON string
    import json
    specs_json = json.dumps({
        "cpu": cpu if cpu != '0' else '',
        "ram": ram if ram != '0' else '',
        "storage": storage if storage != '0' else '',
        "os": os_name if os_name != '0' else '',
        "category_raw": device_category
    }, ensure_ascii=False)

    cursor.execute("""
        INSERT INTO equipments 
        (id, asset_tag, hostname, ip_address, mac_address, serial_number, device_type_id, brand_id, model, specs, status, assigned_date, post_office_id, raw_user_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        eq_id,
        asset_tag,
        hostname if hostname else None,
        ip_addr if ip_addr else None,
        mac_addr if mac_addr else None,
        serial_tag if serial_tag else None,
        computer_type_id,
        brand_id,
        model if model else None,
        specs_json,
        "IN_USE",
        issued_date,
        po_id,
        raw_user_name if raw_user_name else None
    ))

    # Add initial transfer log
    log_id = gen_id()
    cursor.execute("""
        INSERT INTO asset_transfer_logs (id, equipment_id, action, to_post_office_id, reason)
        VALUES (?, ?, ?, ?, ?)
    """, (log_id, eq_id, "CREATE", po_id, "Khởi tạo dữ liệu từ dulieu.xlsx"))

    total_equipments += 1

conn.commit()
conn.close()

print(f"Successfully seeded database 'ccdc.db':")
print(f" - Communes (BĐX): {total_communes}")
print(f" - Post Offices (MBC): {total_post_offices}")
print(f" - Equipments (CCDC): {total_equipments}")
