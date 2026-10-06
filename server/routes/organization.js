const express = require('express');
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const { authRequired, requireManager } = require('../auth');
const { ASSET_PREFIX_REGEX } = require('../lib/helpers');

const router = express.Router();

// ==========================================
// 3. ORGANIZATIONAL TREE & UNITS API
// ==========================================
router.get('/organization/tree', (req, res) => {
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

router.get('/organization/communes', (req, res) => {
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

router.get('/organization/post-offices', (req, res) => {
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

router.get('/device-types', (req, res) => {
  try {
    const types = db.prepare("SELECT * FROM device_types ORDER BY name ASC").all();
    res.json(types);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/device-types', authRequired, requireManager, (req, res) => {
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
router.put('/device-types/:id', authRequired, requireManager, (req, res) => {
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

module.exports = router;
