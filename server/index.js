// Nạp file .env (nếu có) TRƯỚC khi require các module đọc process.env (auth, security).
// Biến môi trường đã có sẵn luôn thắng giá trị trong .env. Không dùng dotenv.
try { process.loadEnvFile(); } catch (e) { /* không có .env: dùng biến môi trường hệ thống */ }

const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const { v4: uuidv4 } = require('uuid');
const { authRequired, requireManager } = require('./auth');
const { createSecurity } = require('./security');
const { parseFloatOrNull, normalizeStr, ASSET_PREFIX_REGEX } = require('./lib/helpers');
const { resolveOrCreateOrgChain } = require('./lib/orgImport');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const equipmentsRoutes = require('./routes/equipments');
const usersRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// Lớp bảo mật (server/security.js) — chạy TRƯỚC mọi thứ khác:
//   1. Lọc IP theo CMS_ALLOWED_IPS: IP không được phép nhận trang 404 (không
//      lộ là có hệ thống ở đây), API nhận 404 JSON; ghi data/security.log.
//   2. Header bảo mật cho mọi phản hồi.
//   3. Mọi /api/* (trừ đăng nhập) đều bắt buộc token — kể cả route đọc, và cả
//      route thêm sau này nếu quên gắn authRequired (mặc định là chặn).
// Không bật CORS: frontend chạy cùng địa chỉ với backend (bản build trong
// dist/ do chính server này phục vụ, hoặc qua proxy của Vite khi dev).
// ==========================================
const security = createSecurity();
app.locals.security = security; // routes/auth.js ghi nhật ký bảo mật qua req.app.locals.security
app.disable('x-powered-by');
app.use(security.ipFilter);
app.use(security.securityHeaders);
// Đăng nhập là route duy nhất chưa có token -> body chỉ cho 10kb (chống gửi payload khổng lồ
// khi chưa xác thực). express.json 50mb (import Excel) chỉ áp SAU lớp bắt buộc token.
app.use('/api/auth/login', express.json({ limit: '10kb' }));
app.use('/api', (req, res, next) => {
  if (req.path === '/auth/login') return next();
  return authRequired(req, res, next);
});
app.use(express.json({ limit: '50mb' }));

// Router tách module (server/routes/*), mount đúng vị trí cũ để giữ thứ tự route.
app.use('/api', authRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', equipmentsRoutes);

// ==========================================
// QUẢN LÝ MẠNG LƯỚI (Network Management) — feat/network-management-backend
// ------------------------------------------------------------------
// Danh mục chuẩn BẮT BUỘC (Phương án B, PO chốt 2026-08-17). CHỈ các route dưới
// đây (cùng resolveOrCreateOrgChain) mới được tạo/sửa/xoá Tỉnh/BĐX/Bưu cục.
// post_offices có thêm 9 cột mới (old_ward_*, district_name, new_ward_*, phone,
// operational_status, latitude, longitude).
// Bảng 20 field JSON (import ⇄ export dùng CHUNG key): xem 03_ARCHITECTURE_MAP.md.
// ==========================================

// GET /api/network — danh sách bưu cục đầy đủ (join commune/province), hỗ trợ
// search (mã HOẶC tên bưu cục), lọc communeId, phân trang. Theo pattern
// GET /api/equipments / GET /api/personnel.
app.get('/api/network', authRequired, requireManager, (req, res) => {
  try {
    const { search, communeId, page = 1, limit = 20 } = req.query;

    let whereClause = ["1=1"];
    let params = [];

    if (search && search.trim()) {
      // Mở rộng (feat/network-submenu-restructure): khớp thêm cả Loại hình (p.type)
      // và Tình trạng hoạt động (p.operational_status), không chỉ mã/tên như trước.
      whereClause.push("(p.code LIKE ? OR p.name LIKE ? OR p.type LIKE ? OR p.operational_status LIKE ?)");
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }
    if (communeId) {
      whereClause.push("p.commune_id = ?");
      params.push(communeId);
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;

    const countSql = `SELECT COUNT(*) as total FROM post_offices p WHERE ${whereClause.join(' AND ')}`;
    const total = db.prepare(countSql).get(...params).total;

    const items = db.prepare(`
      SELECT
        p.*,
        c.code as commune_code, c.name as commune_name,
        pv.code as province_code, pv.name as province_name,
        (SELECT COUNT(*) FROM equipments e WHERE e.post_office_id = p.id AND e.deleted_at IS NULL) as equipment_count,
        ur.full_name as responsible_user_name, ur.hrm_code as responsible_user_hrm
      FROM post_offices p
      JOIN commune_post_offices c ON p.commune_id = c.id
      JOIN province_post_offices pv ON c.province_id = pv.id
      LEFT JOIN users ur ON p.responsible_user_id = ur.id
      WHERE ${whereClause.join(' AND ')}
      ORDER BY p.code ASC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset);

    res.json({
      items,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    console.error("Get network error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/network/import — import mạng lưới từ Excel (20 cột). Được phép tạo
// mới Tỉnh/BĐX/Bưu cục qua resolveOrCreateOrgChain(). Validate fail-fast (thiếu
// maMbc -> lỗi ngay, không ghi gì). Bọc db.transaction().
app.post('/api/network/import', authRequired, requireManager, (req, res) => {
  try {
    const { rows } = req.body || {};
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Danh sách dữ liệu import không hợp lệ hoặc rỗng' });
    }

    // Validate fail-fast TRƯỚC khi mở transaction: mỗi dòng phải có maMbc.
    const validationErrors = [];
    rows.forEach((r, idx) => {
      if (!r || typeof r.maMbc !== 'string' || !r.maMbc.trim()) {
        validationErrors.push({ row: idx + 1, message: 'Thiếu maMbc (mã bưu cục)' });
      }
    });
    if (validationErrors.length > 0) {
      return res.status(400).json({ error: 'Dữ liệu import có dòng không hợp lệ', errors: validationErrors });
    }

    const report = {
      provincesCreated: 0,
      communesCreated: 0,
      postOfficesCreated: 0,
      postOfficesUpdated: 0,
      errors: []
    };

    const importTxn = db.transaction((items) => {
      items.forEach((r, idx) => {
        resolveOrCreateOrgChain(r, report, idx + 1);
      });
    });

    try {
      importTxn(rows);
    } catch (txnError) {
      return res.status(400).json({ error: txnError.message });
    }

    res.json(report);
  } catch (error) {
    console.error("Import network error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/network/export-data — xuất toàn bộ bưu cục theo 20 field (cùng key
// với import), không phân trang. Theo pattern GET /api/equipments/export-data.
app.get('/api/network/export-data', authRequired, requireManager, (req, res) => {
  try {
    const { search, communeId } = req.query;
    let whereClause = ["1=1"];
    let params = [];
    if (search && search.trim()) {
      whereClause.push("(p.code LIKE ? OR p.name LIKE ?)");
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }
    if (communeId) {
      whereClause.push("p.commune_id = ?");
      params.push(communeId);
    }

    const rows = db.prepare(`
      SELECT
        p.*,
        c.code as commune_code, c.name as commune_name, c.central_commune_code as commune_central_code,
        pv.code as province_code, pv.name as province_name,
        ur.hrm_code as responsible_user_hrm
      FROM post_offices p
      JOIN commune_post_offices c ON p.commune_id = c.id
      JOIN province_post_offices pv ON c.province_id = pv.id
      LEFT JOIN users ur ON p.responsible_user_id = ur.id
      WHERE ${whereClause.join(' AND ')}
      ORDER BY p.code ASC
    `).all(...params);

    const items = rows.map((r) => ({
      maBdtTp: r.province_code,
      tenBdtTp: r.province_name,
      maBdx: r.commune_code,
      tenBuuDienXa: r.commune_name,
      buuDienXaTrungTam: r.commune_central_code || '',
      maMbc: r.code,
      tenBuuCuc: r.name,
      loai: r.type || '',
      diaChiChiTiet: r.address || '',
      maBdkv: r.bdkv_code || '',
      tenBdkv: r.bdkv_name || '',
      maPhuongXaCu: r.old_ward_code || '',
      tenPhuongXaCu: r.old_ward_name || '',
      tenQuanHuyen: r.district_name || '',
      maPhuongXaMoi: r.new_ward_code || '',
      tenPhuongXaMoi: r.new_ward_name || '',
      soDienThoai: r.phone || '',
      tinhTrangHoatDong: r.operational_status || '',
      viDo: (r.latitude !== null && r.latitude !== undefined) ? r.latitude : '',
      kinhDo: (r.longitude !== null && r.longitude !== undefined) ? r.longitude : '',
      maHrmNguoiPhuTrach: r.responsible_user_hrm || ''
    }));

    res.json({ items, total: items.length });
  } catch (error) {
    console.error("Export network error:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/network/post-offices/:id — sửa 1 bưu cục (gồm 9 cột mới). Chỉ ghi đè
// field CÓ GỬI trong body (undefined = giữ nguyên; '' = set null, trừ name/
// communeId có validate riêng).
app.put('/api/network/post-offices/:id', authRequired, requireManager, (req, res) => {
  try {
    const existing = db.prepare("SELECT * FROM post_offices WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy bưu cục' });

    const b = req.body || {};
    // undefined -> giữ nguyên; '' -> null; giá trị khác -> dùng.
    const pick = (key, cur) => (b[key] !== undefined ? (String(b[key]).trim() === '' ? null : b[key]) : cur);

    // name: nếu gửi, không được rỗng.
    let finalName = existing.name;
    if (b.name !== undefined) {
      if (typeof b.name !== 'string' || !b.name.trim()) {
        return res.status(400).json({ error: 'Tên bưu cục không được để trống' });
      }
      finalName = b.name.trim();
    }

    // communeId: nếu gửi (khác rỗng), validate tồn tại.
    let finalCommuneId = existing.commune_id;
    if (b.communeId !== undefined && b.communeId !== null && b.communeId !== '') {
      const c = db.prepare("SELECT id FROM commune_post_offices WHERE id = ?").get(b.communeId);
      if (!c) return res.status(400).json({ error: 'BĐX (communeId) không tồn tại trong hệ thống' });
      finalCommuneId = b.communeId;
    }

    const finalLat = b.latitude !== undefined ? parseFloatOrNull(b.latitude) : existing.latitude;
    const finalLong = b.longitude !== undefined ? parseFloatOrNull(b.longitude) : existing.longitude;

    // responsible_user_id: nullable — undefined -> giữ nguyên; null/'' -> gỡ
    // gán (bỏ người phụ trách); giá trị khác -> validate tồn tại trong users.
    // Copy đúng cách PUT /api/equipments/:id validate assigned_user_id.
    let finalResponsibleUserId = existing.responsible_user_id;
    if (b.responsible_user_id !== undefined) {
      if (b.responsible_user_id === null || b.responsible_user_id === '') {
        finalResponsibleUserId = null;
      } else {
        const userExists = db.prepare("SELECT 1 FROM users WHERE id = ?").get(b.responsible_user_id);
        if (!userExists) return res.status(400).json({ error: 'Người phụ trách (responsible_user_id) không tồn tại trong hệ thống' });
        finalResponsibleUserId = b.responsible_user_id;
      }
    }

    db.prepare(`
      UPDATE post_offices SET
        name = ?, type = ?, address = ?, commune_id = ?, bdkv_code = ?, bdkv_name = ?,
        old_ward_code = ?, old_ward_name = ?, district_name = ?, new_ward_code = ?,
        new_ward_name = ?, phone = ?, operational_status = ?, latitude = ?, longitude = ?,
        responsible_user_id = ?
      WHERE id = ?
    `).run(
      finalName,
      pick('type', existing.type),
      pick('address', existing.address),
      finalCommuneId,
      pick('bdkv_code', existing.bdkv_code),
      pick('bdkv_name', existing.bdkv_name),
      pick('old_ward_code', existing.old_ward_code),
      pick('old_ward_name', existing.old_ward_name),
      pick('district_name', existing.district_name),
      pick('new_ward_code', existing.new_ward_code),
      pick('new_ward_name', existing.new_ward_name),
      pick('phone', existing.phone),
      pick('operational_status', existing.operational_status),
      finalLat,
      finalLong,
      finalResponsibleUserId,
      req.params.id
    );

    res.json({ message: 'Cập nhật bưu cục thành công' });
  } catch (error) {
    console.error("Update post office error:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/network/post-offices/:id — thử XOÁ CỨNG. FK enforcement bật sẵn
// (better-sqlite3 mặc định foreign_keys = ON): nếu còn equipments/users tham
// chiếu -> SQLITE_CONSTRAINT_FOREIGNKEY -> bắt lỗi, trả 400 rõ ràng. KHÔNG thêm
// cột soft-delete mới cho post_offices.
app.delete('/api/network/post-offices/:id', authRequired, requireManager, (req, res) => {
  try {
    const existing = db.prepare("SELECT * FROM post_offices WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy bưu cục' });

    try {
      db.prepare("DELETE FROM post_offices WHERE id = ?").run(req.params.id);
    } catch (fkErr) {
      if (fkErr.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || /FOREIGN KEY/i.test(fkErr.message || '')) {
        return res.status(400).json({ error: 'Bưu cục này đang có thiết bị/nhân sự liên kết, không thể xoá.' });
      }
      throw fkErr;
    }

    res.json({ message: 'Đã xoá bưu cục thành công' });
  } catch (error) {
    console.error("Delete post office error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 3. ORGANIZATIONAL TREE & UNITS API
// ==========================================
app.get('/api/organization/tree', (req, res) => {
  try {
    const province = db.prepare("SELECT * FROM province_post_offices LIMIT 1").get();
    const communes = db.prepare("SELECT * FROM commune_post_offices ORDER BY code ASC").all();
    const postOffices = db.prepare(`
      SELECT p.*, COUNT(e.id) as asset_count
      FROM post_offices p
      LEFT JOIN equipments e ON e.post_office_id = p.id
      GROUP BY p.id
      ORDER BY p.code ASC
    `).all();

    // Map Post Offices under Communes (BĐX)
    const tree = {
      id: province.id,
      code: province.code,
      name: province.name,
      communes: communes.map(commune => {
        const units = postOffices.filter(po => po.commune_id === commune.id);
        const communeAssetsCount = units.reduce((sum, u) => sum + u.asset_count, 0);
        return {
          ...commune,
          total_assets: communeAssetsCount,
          units
        };
      })
    };

    res.json(tree);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/organization/communes', (req, res) => {
  try {
    const communes = db.prepare(`
      SELECT c.*, COUNT(p.id) as unit_count
      FROM commune_post_offices c
      LEFT JOIN post_offices p ON p.commune_id = c.id
      GROUP BY c.id
      ORDER BY c.code ASC
    `).all();
    res.json(communes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/organization/post-offices', (req, res) => {
  try {
    const { communeId } = req.query;
    let sql = `
      SELECT p.*, c.name as commune_name
      FROM post_offices p
      JOIN commune_post_offices c ON p.commune_id = c.id
    `;
    let params = [];
    if (communeId) {
      sql += " WHERE p.commune_id = ?";
      params.push(communeId);
    }
    sql += " ORDER BY p.code ASC";
    const postOffices = db.prepare(sql).all(...params);
    res.json(postOffices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/device-types', (req, res) => {
  try {
    const types = db.prepare("SELECT * FROM device_types ORDER BY name ASC").all();
    res.json(types);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/device-types', authRequired, requireManager, (req, res) => {
  try {
    const { name, code, icon, description, asset_prefix } = req.body;
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Tên danh mục không được để trống' });
    if (name.length < 1 || name.length > 100) return res.status(400).json({ error: 'Tên danh mục phải từ 1 đến 100 ký tự' });

    const nameRegex = /^[\p{L}\p{N}\s-]+$/u;
    if (!nameRegex.test(name)) {
      return res.status(400).json({ error: 'Tên danh mục không được chứa ký tự đặc biệt' });
    }

    // asset_prefix OPTIONAL lúc tạo. Nếu có gửi -> validate. Nếu bỏ trống -> lưu NULL,
    // sau này tạo thiết bị thuộc danh mục này sẽ bị POST /api/equipments chặn cho tới
    // khi quản lý bổ sung tiền tố qua Quản Lý Danh Mục.
    let finalPrefix = null;
    if (asset_prefix !== undefined && asset_prefix !== null && String(asset_prefix).trim() !== '') {
      const p = String(asset_prefix).trim().toUpperCase();
      if (!ASSET_PREFIX_REGEX.test(p)) {
        return res.status(400).json({ error: 'Tiền tố mã CCDC phải gồm 2-5 ký tự IN HOA hoặc số (A-Z, 0-9)' });
      }
      finalPrefix = p;
    }

    const finalCode = (code || name).toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const existing = db.prepare("SELECT id FROM device_types WHERE code = ? OR name = ?").get(finalCode, name);
    if (existing) {
      return res.status(400).json({ error: 'Danh mục này đã tồn tại' });
    }

    const id = uuidv4();
    db.prepare("INSERT INTO device_types (id, code, name, icon, description, asset_prefix) VALUES (?, ?, ?, ?, ?, ?)").run(
      id, finalCode, name, icon || 'monitor', description || null, finalPrefix
    );

    res.status(201).json({ message: 'Tạo danh mục thành công', id, code: finalCode, name, asset_prefix: finalPrefix });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sửa danh mục thiết bị đã có: name, asset_prefix, description.
// asset_prefix BẮT BUỘC khi sửa (đây là mục đích chính của route — cấu hình tiền tố).
app.put('/api/device-types/:id', authRequired, requireManager, (req, res) => {
  try {
    const { name, asset_prefix, description } = req.body || {};

    const existing = db.prepare("SELECT * FROM device_types WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy danh mục thiết bị' });

    if (!asset_prefix || typeof asset_prefix !== 'string') {
      return res.status(400).json({ error: 'Vui lòng nhập Tiền tố mã CCDC' });
    }
    const finalPrefix = asset_prefix.trim().toUpperCase();
    if (!ASSET_PREFIX_REGEX.test(finalPrefix)) {
      return res.status(400).json({ error: 'Tiền tố mã CCDC phải gồm 2-5 ký tự IN HOA hoặc số (A-Z, 0-9)' });
    }

    // name: giữ nguyên nếu không gửi; nếu gửi -> validate + chống trùng với danh mục khác.
    let finalName = existing.name;
    if (name !== undefined && name !== null && String(name).trim() !== '') {
      const trimmedName = String(name).trim();
      if (trimmedName.length > 100) return res.status(400).json({ error: 'Tên danh mục phải từ 1 đến 100 ký tự' });
      const nameRegex = /^[\p{L}\p{N}\s-]+$/u;
      if (!nameRegex.test(trimmedName)) {
        return res.status(400).json({ error: 'Tên danh mục không được chứa ký tự đặc biệt' });
      }
      const dup = db.prepare("SELECT id FROM device_types WHERE name = ? AND id != ?").get(trimmedName, req.params.id);
      if (dup) return res.status(400).json({ error: 'Tên danh mục này đã tồn tại ở danh mục khác' });
      finalName = trimmedName;
    }

    const finalDescription = (description !== undefined) ? (description || null) : existing.description;

    db.prepare("UPDATE device_types SET name = ?, asset_prefix = ?, description = ? WHERE id = ?").run(
      finalName, finalPrefix, finalDescription, req.params.id
    );

    res.json({ message: 'Cập nhật danh mục thành công', id: req.params.id, name: finalName, asset_prefix: finalPrefix });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ==========================================
// 4. HRM AUTO-MAPPING API
// ==========================================
// ==========================================
// 4b. PERSONNEL API (nhân sự — bảng `users`, KHÔNG liên quan tài khoản đăng
// nhập). Thay thế route HRM cũ `POST /api/hrm/upload-and-map` (đã xoá).
// Bảng `users` dùng chung cho 2 mục đích: tài khoản đăng nhập (role,
// password_hash) VÀ nguồn gán "Người Sử Dụng" cho thiết bị
// (equipments.assigned_user_id). Route personnel CHỈ thao tác 4 field
// hrm_code/full_name/post_office_code/commune_code, KHÔNG bao giờ đụng
// role/password_hash.
// ==========================================

// Autocomplete: tối đa 10 kết quả khớp hrm_code HOẶC full_name (chuẩn hoá).
// Đặt TRƯỚC /api/personnel/import và GET /api/personnel để route tĩnh
// không bị route khác "nuốt" nhầm (dù ở đây không có route :id nên không
// bắt buộc, vẫn giữ thói quen route tĩnh đứng trước cho rõ ràng).
app.get('/api/personnel/search', authRequired, requireManager, (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);

    const normQ = normalizeStr(q);
    const all = db.prepare(`
      SELECT id, hrm_code, full_name, post_office_code, commune_code
      FROM users
      WHERE deactivated_at IS NULL
      ORDER BY created_at DESC
    `).all();

    const results = all.filter((u) => {
      const normHrm = normalizeStr(u.hrm_code);
      const normName = normalizeStr(u.full_name);
      return normHrm.includes(normQ) || normName.includes(normQ);
    }).slice(0, 10);

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Danh sách nhân sự, hỗ trợ search (hrm_code HOẶC full_name, đã chuẩn hoá),
// lọc theo postOfficeCode/communeCode, phân trang (cùng pattern GET /api/equipments).
app.get('/api/personnel', authRequired, requireManager, (req, res) => {
  try {
    const { search, postOfficeCode, communeCode, page = 1, limit = 20 } = req.query;

    let whereClause = ["1=1", "deactivated_at IS NULL"];
    let params = [];

    if (postOfficeCode) {
      whereClause.push("post_office_code = ?");
      params.push(postOfficeCode);
    }
    if (communeCode) {
      whereClause.push("commune_code = ?");
      params.push(communeCode);
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;

    // search: khớp hrm_code HOẶC full_name, chuẩn hoá bỏ dấu/không phân biệt
    // hoa thường. SQLite không có hàm bỏ dấu sẵn -> lấy tập đã lọc theo
    // postOfficeCode/communeCode trước, rồi lọc chính xác lại bằng
    // normalizeStr() ở tầng ứng dụng, cuối cùng mới phân trang thủ công.
    if (search && search.trim()) {
      const normSearch = normalizeStr(search);
      const all = db.prepare(`
        SELECT id, hrm_code, full_name, post_office_code, commune_code, post_office_id, created_at
        FROM users
        WHERE ${whereClause.join(' AND ')}
        ORDER BY created_at DESC
      `).all(...params);

      const filtered = all.filter((u) => {
        const normHrm = normalizeStr(u.hrm_code);
        const normName = normalizeStr(u.full_name);
        return normHrm.includes(normSearch) || normName.includes(normSearch);
      });

      const total = filtered.length;
      const offset = (pageNum - 1) * limitNum;
      const items = filtered.slice(offset, offset + limitNum);

      return res.json({
        items,
        pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) }
      });
    }

    const countSql = `SELECT COUNT(*) as total FROM users WHERE ${whereClause.join(' AND ')}`;
    const total = db.prepare(countSql).get(...params).total;

    const offset = (pageNum - 1) * limitNum;
    const items = db.prepare(`
      SELECT id, hrm_code, full_name, post_office_code, commune_code, post_office_id, created_at
      FROM users
      WHERE ${whereClause.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset);

    res.json({
      items,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    console.error("Get personnel error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Thêm 1 nhân sự thủ công. hrm_code bắt buộc + unique, full_name bắt buộc.
// KHÔNG nhận/set role hay password_hash (khác POST /api/users).
app.post('/api/personnel', authRequired, requireManager, (req, res) => {
  try {
    const { hrm_code, full_name, post_office_code, commune_code } = req.body || {};

    if (!hrm_code || typeof hrm_code !== 'string' || !hrm_code.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập Mã HRM' });
    }
    if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập Họ và Tên' });
    }

    const trimmedHrmCode = hrm_code.trim();
    const existing = db.prepare("SELECT id FROM users WHERE hrm_code = ?").get(trimmedHrmCode);
    if (existing) {
      return res.status(400).json({ error: 'Mã HRM này đã tồn tại trong hệ thống' });
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO users (id, hrm_code, full_name, post_office_code, commune_code)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, trimmedHrmCode, full_name.trim(), post_office_code || null, commune_code || null);

    res.status(201).json({
      message: 'Thêm nhân sự thành công',
      id,
      hrm_code: trimmedHrmCode,
      full_name: full_name.trim(),
      post_office_code: post_office_code || null,
      commune_code: commune_code || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sửa 4 field nhân sự. hrm_code (nếu đổi) vẫn phải unique.
app.put('/api/personnel/:id', authRequired, requireManager, (req, res) => {
  try {
    const { hrm_code, full_name, post_office_code, commune_code } = req.body || {};
    const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy nhân sự' });

    let finalHrmCode = existing.hrm_code;
    if (hrm_code !== undefined && hrm_code !== null) {
      if (typeof hrm_code !== 'string' || !hrm_code.trim()) {
        return res.status(400).json({ error: 'Mã HRM không hợp lệ' });
      }
      const trimmed = hrm_code.trim();
      if (trimmed !== existing.hrm_code) {
        const dup = db.prepare("SELECT id FROM users WHERE hrm_code = ? AND id != ?").get(trimmed, req.params.id);
        if (dup) return res.status(400).json({ error: 'Mã HRM này đã tồn tại trong hệ thống' });
      }
      finalHrmCode = trimmed;
    }

    let finalFullName = existing.full_name;
    if (full_name !== undefined && full_name !== null) {
      if (typeof full_name !== 'string' || !full_name.trim()) {
        return res.status(400).json({ error: 'Họ và Tên không hợp lệ' });
      }
      finalFullName = full_name.trim();
    }

    const finalPostOfficeCode = post_office_code !== undefined ? (post_office_code || null) : existing.post_office_code;
    const finalCommuneCode = commune_code !== undefined ? (commune_code || null) : existing.commune_code;

    db.prepare(`
      UPDATE users SET hrm_code = ?, full_name = ?, post_office_code = ?, commune_code = ?
      WHERE id = ?
    `).run(finalHrmCode, finalFullName, finalPostOfficeCode, finalCommuneCode, req.params.id);

    res.json({ message: 'Cập nhật nhân sự thành công' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Xoá nhân sự (soft-delete bằng deactivated_at). Chặn nếu người này có tài khoản đăng nhập.
app.delete('/api/personnel/:id', authRequired, requireManager, (req, res) => {
  try {
    const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy nhân sự' });

    if (existing.password_hash !== null) {
      return res.status(400).json({ error: 'Người này cũng có tài khoản đăng nhập, vui lòng quản lý qua Quản Lý Người Dùng (Vô Hiệu Hoá) thay vì xoá ở đây.' });
    }

    if (existing.deactivated_at !== null) {
      return res.status(400).json({ error: 'Đã bị xoá trước đó' });
    }

    db.prepare("UPDATE users SET deactivated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);

    res.json({ message: 'Đã xoá nhân sự thành công' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Import hàng loạt nhân sự: { personnel: [{hrmCode, fullName, postOfficeCode, communeCode}, ...] }.
// Validate fail-fast TRƯỚC khi ghi DB: 1 dòng lỗi -> chặn cả batch, không ghi
// dòng nào. Hợp lệ hết -> UPSERT theo hrm_code trong 1 transaction (copy logic
// UPSERT users từ route HRM cũ trước khi xoá, nhưng khớp DUY NHẤT theo
// hrm_code — KHÔNG khớp thêm theo full_name như bản cũ).
app.post('/api/personnel/import', authRequired, requireManager, (req, res) => {
  try {
    const { personnel } = req.body || {};

    if (!Array.isArray(personnel) || personnel.length === 0) {
      return res.status(400).json({ error: 'Danh sách nhân sự không hợp lệ hoặc rỗng' });
    }

    // Validate fail-fast TRƯỚC khi mở transaction / ghi bất kỳ dữ liệu nào.
    for (const p of personnel) {
      if (!p || typeof p.hrmCode !== 'string' || !p.hrmCode.trim()) {
        return res.status(400).json({ error: 'Mỗi nhân sự phải có hrmCode dạng chuỗi, không rỗng' });
      }
      if (typeof p.fullName !== 'string' || !p.fullName.trim() || p.fullName.length > 200) {
        return res.status(400).json({ error: 'Mỗi nhân sự phải có fullName dạng chuỗi, không rỗng, tối đa 200 ký tự' });
      }
    }

    let created = 0;
    let updated = 0;

    const importPersonnelTxn = db.transaction((items) => {
      items.forEach((p) => {
        const hrmCode = p.hrmCode.trim();
        const fullName = p.fullName.trim();
        const postOfficeCode = p.postOfficeCode || null;
        const communeCode = p.communeCode || null;

        const po = postOfficeCode ? db.prepare("SELECT id FROM post_offices WHERE code = ?").get(postOfficeCode) : null;
        const poId = po ? po.id : null;

        const existing = db.prepare("SELECT id FROM users WHERE hrm_code = ?").get(hrmCode);
        if (existing) {
          db.prepare(`
            UPDATE users SET full_name = ?, post_office_code = ?, commune_code = ?, post_office_id = ?
            WHERE id = ?
          `).run(fullName, postOfficeCode, communeCode, poId, existing.id);
          updated++;
        } else {
          db.prepare(`
            INSERT INTO users (id, hrm_code, full_name, post_office_code, commune_code, post_office_id)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(uuidv4(), hrmCode, fullName, postOfficeCode, communeCode, poId);
          created++;
        }
      });
    });
    importPersonnelTxn(personnel);

    res.json({ created, updated });
  } catch (error) {
    console.error("Import personnel error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.use('/api', usersRoutes);

// Serve frontend static files in production
const clientBuildPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
  // Express 5 + path-to-regexp mới không còn chấp nhận wildcard '*' trần
  // (gây crash "Missing parameter name at index 1: *" ngay lúc khởi động
  // nếu thư mục dist/ tồn tại). Dùng app.use() không path — middleware
  // cuối cùng, chạy cho MỌI request chưa được route nào ở trên xử lý,
  // tương đương ý nghĩa wildcard cũ nhưng không cần path-to-regexp parse.
  app.use((req, res, next) => {
    // /api/* không khớp route nào -> 404 JSON, không trả trang giao diện.
    if (req.path.startsWith('/api/')) return next();
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// Mọi yêu cầu còn lại: trang 404 (trình duyệt) hoặc 404 JSON (API).
app.use(security.sendNotFound);

app.listen(PORT, () => {
  console.log(`Server CCDC bưu điện đang chạy tại http://localhost:${PORT}`);
});
