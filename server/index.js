const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const { v4: uuidv4 } = require('uuid');
const { signToken, verifyPassword, authRequired, requireManager } = require('./auth');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ==========================================
// 0. AUTHENTICATION API (Đăng nhập + JWT)
// ==========================================
// POST /api/auth/login  { hrm_code, password }
// Trả về JWT nếu hợp lệ. Dùng token này ở header cho các route ghi:
//   Authorization: Bearer <token>
app.post('/api/auth/login', (req, res) => {
  try {
    const { hrm_code, password } = req.body || {};
    if (!hrm_code || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập mã HRM và mật khẩu' });
    }

    const user = db.prepare("SELECT * FROM users WHERE hrm_code = ?").get(hrm_code);
    // Thông báo chung để tránh lộ thông tin tài khoản tồn tại hay không.
    if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Mã HRM hoặc mật khẩu không đúng' });
    }

    const token = signToken(user);
    res.json({
      message: 'Đăng nhập thành công',
      token,
      user: {
        id: user.id,
        hrm_code: user.hrm_code,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to format JSON specs
const parseSpecs = (specsStr) => {
  try {
    return typeof specsStr === 'string' ? JSON.parse(specsStr) : (specsStr || {});
  } catch (e) {
    return {};
  }
};

// ==========================================
// 1. DASHBOARD & STATS API
// ==========================================
app.get('/api/dashboard/stats', (req, res) => {
  try {
    const totalAssets = db.prepare("SELECT COUNT(*) as count FROM equipments").get().count;
    const activeAssets = db.prepare("SELECT COUNT(*) as count FROM equipments WHERE status = 'IN_USE'").get().count;
    const totalCommunes = db.prepare("SELECT COUNT(*) as count FROM commune_post_offices").get().count;
    const totalPostOffices = db.prepare("SELECT COUNT(*) as count FROM post_offices").get().count;
    const emptyPostOffices = db.prepare("SELECT COUNT(*) as count FROM post_offices WHERE has_computer = 0 OR id NOT IN (SELECT DISTINCT post_office_id FROM equipments)").get().count;

    // Equipments with specs needing upgrade (RAM <= 4GB or HDD only)
    const allEquipments = db.prepare("SELECT specs FROM equipments").all();
    let lowSpecCount = 0;
    allEquipments.forEach(eq => {
      const specs = parseSpecs(eq.specs);
      const ram = (specs.ram || '').toLowerCase();
      const storage = (specs.storage || '').toLowerCase();
      if (ram.includes('4gb') || ram.includes('2gb') || storage.includes('hdd') && !storage.includes('ssd')) {
        lowSpecCount++;
      }
    });

    // 1. Assets count by BĐX (Top 10 BĐX)
    const assetsByCommune = db.prepare(`
      SELECT c.id, c.code, c.name, COUNT(e.id) as assetCount
      FROM commune_post_offices c
      JOIN post_offices p ON p.commune_id = c.id
      JOIN equipments e ON e.post_office_id = p.id
      GROUP BY c.id
      ORDER BY assetCount DESC
      LIMIT 10
    `).all();

    // 2. Assets count by Device Type
    const assetsByType = db.prepare(`
      SELECT dt.name, dt.code, COUNT(e.id) as count
      FROM device_types dt
      LEFT JOIN equipments e ON e.device_type_id = dt.id
      GROUP BY dt.id
    `).all();

    // 3. Assets count by Brand
    const assetsByBrand = db.prepare(`
      SELECT COALESCE(b.name, 'Chưa xác định') as brandName, COUNT(e.id) as count
      FROM equipments e
      LEFT JOIN brands b ON e.brand_id = b.id
      GROUP BY brandName
      ORDER BY count DESC
      LIMIT 6
    `).all();

    // 4. IT Warnings (Missing MAC, Missing IP, Windows 7)
    const missingMac = db.prepare("SELECT COUNT(*) as count FROM equipments WHERE mac_address IS NULL OR mac_address = '' OR mac_address = 'UNKNOWN'").get().count;
    const missingIp = db.prepare("SELECT COUNT(*) as count FROM equipments WHERE ip_address IS NULL OR ip_address = ''").get().count;
    let win7Count = 0;
    allEquipments.forEach(eq => {
      const specs = parseSpecs(eq.specs);
      if ((specs.os || '').toLowerCase().includes('win') && (specs.os || '').includes('7')) {
        win7Count++;
      }
    });

    res.json({
      summary: {
        totalAssets,
        activeAssets,
        totalCommunes,
        totalPostOffices,
        emptyPostOffices,
        lowSpecCount
      },
      charts: {
        assetsByCommune,
        assetsByType,
        assetsByBrand
      },
      warnings: {
        missingMac,
        missingIp,
        win7Count
      }
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 2. EQUIPMENTS CRUD API
// ==========================================
app.get('/api/equipments', (req, res) => {
  try {
    const {
      search,
      communeId,
      postOfficeId,
      deviceTypeId,
      brandId,
      status,
      page = 1,
      limit = 20
    } = req.query;

    let whereClause = ["1=1"];
    let params = [];

    if (search) {
      whereClause.push(`(
        e.hostname LIKE ? OR 
        e.ip_address LIKE ? OR 
        e.mac_address LIKE ? OR 
        e.serial_number LIKE ? OR 
        e.asset_tag LIKE ? OR 
        e.raw_user_name LIKE ? OR 
        u.full_name LIKE ? OR 
        p.name LIKE ? OR 
        c.name LIKE ?
      )`);
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term, term, term, term, term);
    }

    if (communeId) {
      whereClause.push("p.commune_id = ?");
      params.push(communeId);
    }

    if (postOfficeId) {
      whereClause.push("e.post_office_id = ?");
      params.push(postOfficeId);
    }

    if (deviceTypeId) {
      whereClause.push("e.device_type_id = ?");
      params.push(deviceTypeId);
    }

    if (brandId) {
      whereClause.push("e.brand_id = ?");
      params.push(brandId);
    }

    if (status) {
      whereClause.push("e.status = ?");
      params.push(status);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const countSql = `
      SELECT COUNT(*) as total
      FROM equipments e
      JOIN post_offices p ON e.post_office_id = p.id
      JOIN commune_post_offices c ON p.commune_id = c.id
      LEFT JOIN users u ON e.assigned_user_id = u.id
      WHERE ${whereClause.join(' AND ')}
    `;
    const total = db.prepare(countSql).get(...params).total;

    const dataSql = `
      SELECT 
        e.*,
        p.name as post_office_name, p.code as post_office_code, p.type as post_office_type,
        c.id as commune_id, c.name as commune_name, c.code as commune_code,
        dt.name as device_type_name, dt.code as device_type_code, dt.icon as device_type_icon,
        b.name as brand_name,
        u.full_name as assigned_user_name, u.hrm_code as assigned_user_hrm
      FROM equipments e
      JOIN post_offices p ON e.post_office_id = p.id
      JOIN commune_post_offices c ON p.commune_id = c.id
      JOIN device_types dt ON e.device_type_id = dt.id
      LEFT JOIN brands b ON e.brand_id = b.id
      LEFT JOIN users u ON e.assigned_user_id = u.id
      WHERE ${whereClause.join(' AND ')}
      ORDER BY e.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const items = db.prepare(dataSql).all(...params, parseInt(limit), offset);

    // Format item specs
    const formattedItems = items.map(item => ({
      ...item,
      specs: parseSpecs(item.specs),
      assigned_user_display: item.assigned_user_name || item.raw_user_name || 'Chưa bàn giao'
    }));

    res.json({
      items: formattedItems,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("Get equipments error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Single equipment detail with audit logs
app.get('/api/equipments/:id', (req, res) => {
  try {
    const sql = `
      SELECT 
        e.*,
        p.name as post_office_name, p.code as post_office_code, p.address as post_office_address,
        c.name as commune_name, c.code as commune_code,
        dt.name as device_type_name, dt.code as device_type_code, dt.icon as device_type_icon,
        b.name as brand_name,
        u.full_name as assigned_user_name, u.hrm_code as assigned_user_hrm
      FROM equipments e
      JOIN post_offices p ON e.post_office_id = p.id
      JOIN commune_post_offices c ON p.commune_id = c.id
      JOIN device_types dt ON e.device_type_id = dt.id
      LEFT JOIN brands b ON e.brand_id = b.id
      LEFT JOIN users u ON e.assigned_user_id = u.id
      WHERE e.id = ?
    `;
    const item = db.prepare(sql).get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Không tìm thấy thiết bị CCDC' });

    const logs = db.prepare(`
      SELECT 
        l.*,
        p_from.name as from_post_office_name,
        p_to.name as to_post_office_name
      FROM asset_transfer_logs l
      LEFT JOIN post_offices p_from ON l.from_post_office_id = p_from.id
      LEFT JOIN post_offices p_to ON l.to_post_office_id = p_to.id
      WHERE l.equipment_id = ?
      ORDER BY l.transferred_at DESC
    `).all(req.params.id);

    res.json({
      ...item,
      specs: parseSpecs(item.specs),
      logs
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new CCDC equipment (Supports Multi-Device)
// Ghi: yêu cầu token hợp lệ + role quản lý (STAFF chỉ đọc).
app.post('/api/equipments', authRequired, requireManager, (req, res) => {
  try {
    const {
      hostname,
      ip_address,
      mac_address,
      serial_number,
      device_type_id,
      brand_id,
      brand_name,
      model,
      post_office_id,
      raw_user_name,
      notes,
      specs
    } = req.body;

    if (!device_type_id || !post_office_id) {
      return res.status(400).json({ error: 'Vui lòng chọn Loại thiết bị và Bưu cục' });
    }

    // Resolve Brand ID
    let finalBrandId = brand_id;
    if (!finalBrandId && brand_name) {
      const existingBrand = db.prepare("SELECT id FROM brands WHERE name = ?").get(brand_name);
      if (existingBrand) {
        finalBrandId = existingBrand.id;
      } else {
        finalBrandId = uuidv4();
        db.prepare("INSERT INTO brands (id, name) VALUES (?, ?)").run(finalBrandId, brand_name);
      }
    }

    const eqId = uuidv4();
    const poCode = db.prepare("SELECT code FROM post_offices WHERE id = ?").get(post_office_id)?.code || '00';
    const assetTag = `CCDC-${poCode}-${Date.now().toString().slice(-4)}`;

    db.prepare(`
      INSERT INTO equipments 
      (id, asset_tag, hostname, ip_address, mac_address, serial_number, device_type_id, brand_id, model, specs, status, post_office_id, raw_user_name, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'IN_USE', ?, ?, ?)
    `).run(
      eqId,
      assetTag,
      hostname || null,
      ip_address || null,
      mac_address || null,
      serial_number || null,
      device_type_id,
      finalBrandId || null,
      model || null,
      JSON.stringify(specs || {}),
      post_office_id,
      raw_user_name || null,
      notes || null
    );

    // Record creation audit log
    db.prepare(`
      INSERT INTO asset_transfer_logs (id, equipment_id, action, to_post_office_id, reason)
      VALUES (?, ?, 'CREATE', ?, 'Thêm mới thiết bị CCDC từ hệ thống web')
    `).run(uuidv4(), eqId, post_office_id);

    res.status(201).json({ message: 'Tạo CCDC thành công', id: eqId, asset_tag: assetTag });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update CCDC equipment (bao gồm đổi "status" thiết bị)
// Ghi: yêu cầu token hợp lệ + role quản lý. STAFF thường KHÔNG được đổi status.
app.put('/api/equipments/:id', authRequired, requireManager, (req, res) => {
  try {
    const {
      hostname,
      ip_address,
      mac_address,
      serial_number,
      model,
      status,
      raw_user_name,
      notes,
      specs
    } = req.body;

    const existing = db.prepare("SELECT * FROM equipments WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy thiết bị' });

    db.prepare(`
      UPDATE equipments
      SET hostname = ?, ip_address = ?, mac_address = ?, serial_number = ?, model = ?, status = ?, raw_user_name = ?, notes = ?, specs = ?
      WHERE id = ?
    `).run(
      hostname || null,
      ip_address || null,
      mac_address || null,
      serial_number || null,
      model || null,
      status || existing.status,
      raw_user_name || null,
      notes || null,
      JSON.stringify(specs || parseSpecs(existing.specs)),
      req.params.id
    );

    db.prepare(`
      INSERT INTO asset_transfer_logs (id, equipment_id, action, reason)
      VALUES (?, ?, 'UPDATE', 'Cập nhật thông tin cấu hình / thiết bị')
    `).run(uuidv4(), req.params.id);

    res.json({ message: 'Cập nhật CCDC thành công' });
  } catch (error) {
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
    const { name, code, icon, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Tên danh mục không được để trống' });
    
    const finalCode = (code || name).toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const existing = db.prepare("SELECT id FROM device_types WHERE code = ? OR name = ?").get(finalCode, name);
    if (existing) {
      return res.status(400).json({ error: 'Danh mục này đã tồn tại' });
    }

    const id = uuidv4();
    db.prepare("INSERT INTO device_types (id, code, name, icon, description) VALUES (?, ?, ?, ?, ?)").run(
      id, finalCode, name, icon || 'monitor', description || null
    );

    res.status(201).json({ message: 'Tạo danh mục thành công', id, code: finalCode, name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ==========================================
// 4. HRM AUTO-MAPPING API
// ==========================================
app.post('/api/hrm/upload-and-map', authRequired, requireManager, (req, res) => {
  try {
    const { hrmEmployees } = req.body;
    // Expected format of hrmEmployees array:
    // [{ hrmCode: 'HRM102', fullName: 'THANH THÌN', postOfficeCode: '536750', communeCode: '5300' }]

    if (!Array.isArray(hrmEmployees) || hrmEmployees.length === 0) {
      return res.status(400).json({ error: 'Danh sách nhân sự HRM không hợp lệ hoặc rỗng' });
    }

    let usersCreated = 0;
    let usersUpdated = 0;
    let assetsAutoMapped = 0;
    let mappingDetails = [];

    // Helper string normalizer
    const normalizeStr = (s) => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    hrmEmployees.forEach(emp => {
      const { hrmCode, fullName, postOfficeCode, communeCode } = emp;
      if (!fullName) return;

      // Find matching Post Office by code
      const po = db.prepare("SELECT id FROM post_offices WHERE code = ?").get(postOfficeCode || '');
      const poId = po ? po.id : null;

      // Insert or Update User record
      let user = db.prepare("SELECT * FROM users WHERE hrm_code = ? OR full_name = ?").get(hrmCode || '', fullName);
      let userId;

      if (user) {
        userId = user.id;
        db.prepare(`
          UPDATE users
          SET hrm_code = ?, full_name = ?, post_office_code = ?, commune_code = ?, post_office_id = ?
          WHERE id = ?
        `).run(hrmCode || user.hrm_code, fullName, postOfficeCode || user.post_office_code, communeCode || user.commune_code, poId || user.post_office_id, userId);
        usersUpdated++;
      } else {
        userId = uuidv4();
        db.prepare(`
          INSERT INTO users (id, hrm_code, full_name, post_office_code, commune_code, post_office_id)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(userId, hrmCode || null, fullName, postOfficeCode || null, communeCode || null, poId);
        usersCreated++;
      }

      // Auto-Match Equipment by Raw User Name
      const normName = normalizeStr(fullName);
      const unmappedEquipments = db.prepare("SELECT id, raw_user_name, post_office_id FROM equipments WHERE assigned_user_id IS NULL AND raw_user_name IS NOT NULL AND raw_user_name != ''").all();

      unmappedEquipments.forEach(eq => {
        const normRaw = normalizeStr(eq.raw_user_name);
        if (normRaw === normName || normRaw.includes(normName) || normName.includes(normRaw)) {
          // Check if post office matches or commune matches
          db.prepare(`
            UPDATE equipments
            SET assigned_user_id = ?
            WHERE id = ?
          `).run(userId, eq.id);

          db.prepare(`
            INSERT INTO asset_transfer_logs (id, equipment_id, action, to_user_id, reason)
            VALUES (?, ?, 'HRM_SYNC', ?, 'Tự động mapping từ file HRM nhân sự')
          `).run(uuidv4(), eq.id, userId);

          assetsAutoMapped++;
          mappingDetails.push({
            equipmentId: eq.id,
            rawName: eq.raw_user_name,
            matchedUser: fullName,
            hrmCode: hrmCode || 'N/A'
          });
        }
      });
    });

    res.json({
      message: 'Xử lý Auto-Mapping HRM hoàn tất!',
      stats: {
        totalHrmInput: hrmEmployees.length,
        usersCreated,
        usersUpdated,
        assetsAutoMapped
      },
      mappingDetails
    });
  } catch (error) {
    console.error("HRM mapping error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Serve frontend static files in production
const clientBuildPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server CCDC bưu điện đang chạy tại http://localhost:${PORT}`);
});
