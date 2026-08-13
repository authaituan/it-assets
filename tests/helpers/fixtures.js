// ==========================================
// Seed dữ liệu tối thiểu cần thiết cho test (org tree tối giản + user).
// Dùng chính schema thật (đi qua db handle được trả về từ serverHarness,
// tức là CÙNG connection mà server/index.js đang dùng).
// ==========================================
'use strict';
const path = require('path');
const crypto = require('crypto');
const { SERVER_DIR } = require('./serverHarness');
const { hashPassword } = require(path.join(SERVER_DIR, 'auth.js'));

function uid() {
  return crypto.randomUUID();
}

// Seed 1 nhánh tổ chức tối thiểu: 1 tỉnh -> 1 BĐX -> 1 bưu cục, + 1 device_type.
// Đủ để test route equipments (cần device_type_id + post_office_id hợp lệ).
function seedMinimalOrg(db) {
  const provinceId = uid();
  const communeId = uid();
  const postOfficeId = uid();
  const deviceTypeId = uid();
  const provinceCode = 'TESTP';
  const communeCode = 'TESTC';
  const postOfficeCode = 'TESTPO';
  const deviceTypeCode = 'TEST_DEVICE';
  const assetPrefix = 'TST'; // cần có prefix, nếu không POST /api/equipments sẽ chặn (400)

  db.prepare(`INSERT INTO province_post_offices (id, code, name) VALUES (?, ?, ?)`)
    .run(provinceId, provinceCode, 'Tỉnh Test');
  db.prepare(`INSERT INTO commune_post_offices (id, code, name, province_id) VALUES (?, ?, ?, ?)`)
    .run(communeId, communeCode, 'BĐX Test', provinceId);
  db.prepare(`INSERT INTO post_offices (id, code, name, commune_id) VALUES (?, ?, ?, ?)`)
    .run(postOfficeId, postOfficeCode, 'Bưu cục Test', communeId);
  db.prepare(`INSERT INTO device_types (id, code, name, asset_prefix) VALUES (?, ?, ?, ?)`)
    .run(deviceTypeId, deviceTypeCode, 'Máy Test', assetPrefix);

  return { provinceId, communeId, postOfficeId, deviceTypeId, provinceCode, communeCode, postOfficeCode, deviceTypeCode, assetPrefix };
}

// Seed 1 user với password_hash thật (dùng hashPassword thật từ server/auth.js)
// để login qua route /api/auth/login thật lấy JWT thật.
function seedUser(db, { hrmCode, fullName, role, password }) {
  const id = uid();
  db.prepare(`INSERT INTO users (id, hrm_code, full_name, role, password_hash) VALUES (?, ?, ?, ?, ?)`)
    .run(id, hrmCode, fullName, role, hashPassword(password));
  return id;
}

module.exports = { seedMinimalOrg, seedUser, uid };
