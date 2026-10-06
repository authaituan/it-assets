const express = require('express');
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const { authRequired, requireManager } = require('../auth');
const { normalizeStr } = require('../lib/helpers');

const router = express.Router();

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
router.get('/personnel/search', authRequired, requireManager, (req, res) => {
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
router.get('/personnel', authRequired, requireManager, (req, res) => {
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
router.post('/personnel', authRequired, requireManager, (req, res) => {
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
router.put('/personnel/:id', authRequired, requireManager, (req, res) => {
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
router.delete('/personnel/:id', authRequired, requireManager, (req, res) => {
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
router.post('/personnel/import', authRequired, requireManager, (req, res) => {
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

module.exports = router;
