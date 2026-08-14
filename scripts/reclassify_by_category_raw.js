// scripts/reclassify_by_category_raw.js
//
// Hạng mục: phân loại lại device_type_id của thiết bị hiện có dựa trên
// specs.category_raw (cột "Loại máy" gốc trong Excel import ban đầu), vốn
// trước đây bị gán CỨNG toàn bộ vào danh mục "Máy tính & POS" (COMPUTER) bởi
// scripts/seed.py, dù giá trị gốc có thể phân biệt Desktop/Laptop/POS/khác.
//
// Script này ĐỘC LẬP với scripts/seed.py — KHÔNG import, KHÔNG gọi seed.py.
// Chỉ chạm field `device_type_id` của các dòng equipments ĐÃ CÓ SẴN.
//
// An toàn dữ liệu:
//   - Bước đầu tiên: backup nguyên vẹn file DB đích sang
//     `<dbPath>.backup-<timestamp>` trước khi làm bất kỳ điều gì khác. Nếu
//     backup thất bại, script dừng ngay, KHÔNG mở kết nối ghi.
//   - Toàn bộ UPDATE bọc trong 1 db.transaction() (cùng pattern với
//     server/index.js) — tất cả cùng thành công hoặc cùng rollback.
//   - Idempotent: chạy lại lần 2 không đổi gì thêm (so khớp category_raw
//     dựa trên trạng thái thực tế, không dựa vào "đã chạy chưa").
//
// Cách dùng:
//   node scripts/reclassify_by_category_raw.js [duong-dan-db]
//   Mặc định nhắm vào data/ccdc.db (tương đối với thư mục gốc repo).
//   Truyền đường dẫn khác để chạy thử trên bản sao (khuyến nghị làm TRƯỚC).

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const repoRoot = path.join(__dirname, '..');
const dbPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(repoRoot, 'data', 'ccdc.db');

if (!fs.existsSync(dbPath)) {
  console.error(`[LỖI] Không tìm thấy file DB: ${dbPath}`);
  process.exit(1);
}

// ==========================================================
// Bước (a): BACKUP BẮT BUỘC trước khi làm bất kỳ điều gì khác.
// Dừng ngay và báo lỗi nếu backup thất bại.
// ==========================================================
function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

const backupPath = `${dbPath}.backup-${timestamp()}`;
try {
  fs.copyFileSync(dbPath, backupPath);
  // Verify: file backup thực sự tồn tại và có cùng kích thước với bản gốc.
  const origSize = fs.statSync(dbPath).size;
  const backupSize = fs.statSync(backupPath).size;
  if (backupSize !== origSize) {
    throw new Error(`Kích thước backup (${backupSize}) khác bản gốc (${origSize})`);
  }
  console.log(`[OK] Đã backup DB gốc sang: ${backupPath} (${backupSize} bytes)`);
} catch (err) {
  console.error(`[LỖI NGHIÊM TRỌNG] Backup thất bại, DỪNG SCRIPT — không chạm vào DB thật.`);
  console.error(err.message);
  process.exit(1);
}

// ==========================================================
// Từ đây trở đi mới được phép mở kết nối và ghi.
// ==========================================================
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const DIACRITICS_RE = new RegExp('[\\u0300-\\u036f]', 'g');
function normalizeStr(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS_RE, '')
    .trim();
}

// ==========================================================
// Bước (b)+(c): đọc TẤT CẢ thiết bị, parse specs, khảo sát phân bố category_raw.
// ==========================================================
const allEquipments = db.prepare(`
  SELECT id, asset_tag, hostname, status, device_type_id, specs
  FROM equipments
`).all();

console.log(`\n[Khảo sát] Tổng số thiết bị trong DB: ${allEquipments.length}`);

const distribution = new Map(); // category_raw (nguyên văn) -> count
const parsedRows = []; // { id, categoryRaw, normalized, device_type_id }

for (const row of allEquipments) {
  let specs = {};
  try {
    specs = row.specs ? JSON.parse(row.specs) : {};
  } catch (e) {
    specs = {};
  }
  const categoryRaw = specs.category_raw || '';
  distribution.set(categoryRaw, (distribution.get(categoryRaw) || 0) + 1);
  parsedRows.push({
    id: row.id,
    asset_tag: row.asset_tag,
    device_type_id: row.device_type_id,
    categoryRaw,
    normalized: normalizeStr(categoryRaw),
  });
}

console.log('\n[Khảo sát] Phân bố category_raw thực tế (DISTINCT ... GROUP BY):');
const sortedDist = [...distribution.entries()].sort((a, b) => b[1] - a[1]);
for (const [val, count] of sortedDist) {
  console.log(`  ${count.toString().padStart(4)}  x  "${val}"`);
}

// ==========================================================
// Bước (d)+(e): thiết kế quy tắc phân loại dựa trên khảo sát trên, tạo danh
// mục mới nếu cần.
// ==========================================================

// Danh mục "Máy tính & POS" hiện có — giữ nguyên, KHÔNG đụng nếu vẫn có
// thiết bị Desktop dùng nó (mặc định của toàn bộ đợt seed cũ).
const pcType = db.prepare(`SELECT id, code, name, asset_prefix FROM device_types WHERE code = 'COMPUTER'`).get();
if (!pcType) {
  console.error('[LỖI] Không tìm thấy device_types.code = COMPUTER (danh mục "Máy tính & POS"). Dừng lại để tránh giả định sai.');
  process.exit(1);
}

function getOrCreateDeviceType({ code, name, iconName, description, assetPrefix }) {
  const existing = db.prepare('SELECT id FROM device_types WHERE code = ?').get(code);
  if (existing) return existing.id;
  const { randomUUID } = require('crypto');
  const id = randomUUID();
  db.prepare(`
    INSERT INTO device_types (id, code, name, icon, description, asset_prefix)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, code, name, iconName, description, assetPrefix);
  console.log(`[Tạo danh mục mới] code=${code} name="${name}" asset_prefix=${assetPrefix}`);
  return id;
}

// Ngưỡng tối thiểu để tách riêng 1 danh mục POS có ý nghĩa.
const POS_MIN_COUNT = 3;

// Đếm số thiết bị khớp từng quy tắc dựa trên khảo sát thực tế TRƯỚC khi
// quyết định tạo danh mục POS hay không.
let posCandidateCount = 0;
for (const [val, count] of distribution.entries()) {
  const norm = normalizeStr(val);
  // "pos" đứng riêng như 1 từ (ranh giới từ), tránh khớp nhầm chữ khác chứa "pos".
  if (/\bpos\b/.test(norm)) posCandidateCount += count;
}

let laptopTypeId = null; // tạo lười (lazy) — chỉ tạo nếu thực sự có thiết bị khớp
let posTypeId = null;
const createPosCategory = posCandidateCount >= POS_MIN_COUNT;

console.log(`\n[Quy tắc] Số thiết bị khớp "pos" (từ riêng biệt): ${posCandidateCount} → ${createPosCategory ? `TÁCH RIÊNG danh mục POS (>= ${POS_MIN_COUNT})` : `GỘP CHUNG vào "Máy tính & POS" (< ${POS_MIN_COUNT})`}`);

function classify(normalized) {
  if (!normalized) return { action: 'KEEP', reason: 'category_raw rỗng' };

  const hasLaptop = normalized.includes('laptop');
  const hasDesktop = normalized.includes('de ban') || normalized.includes('desktop');
  const hasPos = /\bpos\b/.test(normalized);

  if (hasLaptop) {
    return { action: 'LAPTOP' };
  }
  if (hasPos) {
    return createPosCategory ? { action: 'POS' } : { action: 'PC', reason: 'pos nhưng số lượng < ngưỡng, gộp PC' };
  }
  if (hasDesktop) {
    return { action: 'PC' };
  }
  return { action: 'KEEP', reason: 'không khớp quy tắc nào (laptop/desktop/pos)' };
}

// ==========================================================
// Bước (f): tính danh sách UPDATE cần làm, KHÔNG ghi gì trước khi có đủ danh sách.
// ==========================================================
const updates = []; // { id, asset_tag, fromTypeId, toTypeId, categoryRaw }
const unmatched = new Map(); // categoryRaw -> count (không khớp quy tắc nào)
let laptopNeeded = false;
let posNeeded = false;

for (const row of parsedRows) {
  const { action, reason } = classify(row.normalized);

  if (action === 'KEEP') {
    if (row.categoryRaw) {
      unmatched.set(row.categoryRaw, (unmatched.get(row.categoryRaw) || 0) + 1);
    }
    continue;
  }

  if (action === 'LAPTOP') laptopNeeded = true;
  if (action === 'POS') posNeeded = true;

  updates.push({ id: row.id, asset_tag: row.asset_tag, fromTypeId: row.device_type_id, categoryRaw: row.categoryRaw, targetAction: action });
}

if (laptopNeeded) {
  laptopTypeId = getOrCreateDeviceType({
    code: 'LAPTOP',
    name: 'Laptop',
    iconName: 'laptop',
    description: 'Máy tính xách tay (Laptop) — tách riêng từ "Máy tính & POS" theo category_raw gốc',
    assetPrefix: 'LAP',
  });
}
if (posNeeded) {
  posTypeId = getOrCreateDeviceType({
    code: 'POS',
    name: 'Máy POS',
    iconName: 'credit-card',
    description: 'Máy POS giao dịch — tách riêng từ "Máy tính & POS" theo category_raw gốc',
    assetPrefix: 'POS',
  });
}

// Map action -> target device_type_id, resolve sau khi danh mục đã chắc chắn tồn tại.
function resolveTargetId(action) {
  if (action === 'LAPTOP') return laptopTypeId;
  if (action === 'POS') return posTypeId;
  if (action === 'PC') return pcType.id;
  return null;
}

// Lọc bỏ những dòng mà target trùng với device_type_id hiện tại (đã đúng từ
// trước — đây chính là điều kiện giúp script idempotent ở lần chạy thứ 2).
const realUpdates = [];
for (const u of updates) {
  const targetId = resolveTargetId(u.targetAction);
  if (!targetId) continue; // an toàn: không rõ target thì bỏ qua, không đoán
  if (targetId === u.fromTypeId) continue; // đã đúng rồi, không cần update
  realUpdates.push({ ...u, targetId });
}

// ==========================================================
// Bước (f) tiếp: thực thi UPDATE trong 1 transaction duy nhất.
// ==========================================================
const reclassifyTxn = db.transaction((items) => {
  const stmt = db.prepare(`UPDATE equipments SET device_type_id = ? WHERE id = ?`);
  for (const item of items) {
    stmt.run(item.targetId, item.id);
  }
});

if (realUpdates.length > 0) {
  reclassifyTxn(realUpdates);
}

// ==========================================================
// Bước (h): báo cáo cuối script.
// ==========================================================
console.log('\n========== BÁO CÁO ==========');
console.log(`Tổng thiết bị: ${allEquipments.length}`);
console.log(`Số thiết bị được đổi danh mục lần này: ${realUpdates.length}`);

if (realUpdates.length > 0) {
  const typeNames = new Map(
    db.prepare('SELECT id, name FROM device_types').all().map((t) => [t.id, t.name])
  );
  const byTarget = new Map();
  for (const u of realUpdates) {
    const key = `${typeNames.get(u.fromTypeId) || u.fromTypeId} -> ${typeNames.get(u.targetId) || u.targetId}`;
    byTarget.set(key, (byTarget.get(key) || 0) + 1);
  }
  console.log('Chi tiết đổi (từ -> sang, số lượng):');
  for (const [key, count] of byTarget.entries()) {
    console.log(`  ${count.toString().padStart(4)}  x  ${key}`);
  }
}

console.log(`\nDanh mục mới đã tạo trong lần chạy này: ${[laptopNeeded ? 'Laptop (LAP)' : null, posNeeded ? 'Máy POS (POS)' : null].filter(Boolean).join(', ') || '(không có — đã tồn tại từ trước hoặc không cần)'}`);

if (unmatched.size > 0) {
  console.log(`\ncategory_raw KHÔNG khớp quy tắc nào (giữ nguyên device_type_id, cần PO xem lại):`);
  for (const [val, count] of [...unmatched.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count.toString().padStart(4)}  x  "${val}"`);
  }
} else {
  console.log('\nKhông có category_raw nào không khớp quy tắc.');
}

console.log(`\nBackup gốc: ${backupPath}`);
console.log('========== HẾT BÁO CÁO ==========\n');

db.close();
