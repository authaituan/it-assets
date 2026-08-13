const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const { v4: uuidv4 } = require('uuid');
const { signToken, verifyPassword, hashPassword, authRequired, requireManager } = require('./auth');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ==========================================
// Rate limit đăng nhập: chống brute-force đoán mật khẩu.
// Giới hạn theo cặp (IP + hrm_code) — không chặn nhầm nhiều người dùng
// chung 1 mạng (NAT/wifi công ty) đăng nhập các tài khoản KHÁC nhau, chỉ
// chặn việc dò mật khẩu liên tục nhắm vào 1 tài khoản cụ thể.
// Lưu trong bộ nhớ tiến trình (Map, không dùng DB/Redis) — đủ dùng cho quy
// mô 1 instance hiện tại; sẽ tự reset khi restart server (đánh đổi chấp
// nhận được, không phải phòng thủ tuyệt đối cho hệ thống nhiều instance).
// LƯU Ý triển khai: nếu sau này chạy sau reverse proxy (nginx...), cần
// `app.set('trust proxy', ...)` để req.ip lấy đúng IP thật của client thay
// vì IP của proxy — hiện chưa cấu hình vì chưa biết mô hình deploy thật.
// ==========================================
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 phút
const loginAttempts = new Map(); // key: "ip|hrm_code" -> { count, windowStart }

function getLoginRateLimitKey(req, hrmCode) {
  return `${req.ip}|${hrmCode}`;
}

function checkLoginRateLimit(key) {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
    return { limited: false };
  }
  if (entry.count >= LOGIN_MAX_ATTEMPTS) {
    const retryAfterMs = LOGIN_WINDOW_MS - (now - entry.windowStart);
    return { limited: true, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }
  return { limited: false };
}

function recordFailedLogin(key) {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, windowStart: now });
  } else {
    entry.count += 1;
  }
}

function clearLoginAttempts(key) {
  loginAttempts.delete(key);
}

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

    const rateLimitKey = getLoginRateLimitKey(req, hrm_code);
    const rateLimitCheck = checkLoginRateLimit(rateLimitKey);
    if (rateLimitCheck.limited) {
      res.set('Retry-After', String(rateLimitCheck.retryAfterSeconds));
      return res.status(429).json({
        error: `Đăng nhập sai quá nhiều lần, vui lòng thử lại sau ${Math.ceil(rateLimitCheck.retryAfterSeconds / 60)} phút`
      });
    }

    const user = db.prepare("SELECT * FROM users WHERE hrm_code = ?").get(hrm_code);
    // Thông báo chung để tránh lộ thông tin tài khoản tồn tại hay không.
    if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
      recordFailedLogin(rateLimitKey);
      return res.status(401).json({ error: 'Mã HRM hoặc mật khẩu không đúng' });
    }

    // Mật khẩu đúng nhưng tài khoản đã bị vô hiệu hoá -> vẫn chặn đăng nhập, dùng
    // message RIÊNG (khác lỗi sai mật khẩu) để người dùng biết rõ cần liên hệ quản
    // trị viên. Kiểm tra SAU KHI verify mật khẩu đúng (không phải trước) để tránh lộ
    // trạng thái vô hiệu hoá của 1 tài khoản cho người chưa chứng minh biết mật khẩu.
    if (user.deactivated_at) {
      return res.status(401).json({ error: 'Tài khoản đã bị vô hiệu hoá, vui lòng liên hệ quản trị viên' });
    }

    clearLoginAttempts(rateLimitKey);
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
    const totalAssets = db.prepare("SELECT COUNT(*) as count FROM equipments WHERE deleted_at IS NULL").get().count;
    const activeAssets = db.prepare("SELECT COUNT(*) as count FROM equipments WHERE status = 'IN_USE' AND deleted_at IS NULL").get().count;
    const totalCommunes = db.prepare("SELECT COUNT(*) as count FROM commune_post_offices").get().count;
    const totalPostOffices = db.prepare("SELECT COUNT(*) as count FROM post_offices").get().count;
    const emptyPostOffices = db.prepare("SELECT COUNT(*) as count FROM post_offices WHERE has_computer = 0 OR id NOT IN (SELECT DISTINCT post_office_id FROM equipments WHERE deleted_at IS NULL)").get().count;

    // Equipments with specs needing upgrade (RAM <= 4GB or HDD only)
    const allEquipments = db.prepare("SELECT specs FROM equipments WHERE deleted_at IS NULL").all();
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
      JOIN equipments e ON e.post_office_id = p.id AND e.deleted_at IS NULL
      GROUP BY c.id
      ORDER BY assetCount DESC
      LIMIT 10
    `).all();

    // 2. Assets count by Device Type
    const assetsByType = db.prepare(`
      SELECT dt.name, dt.code, COUNT(e.id) as count
      FROM device_types dt
      LEFT JOIN equipments e ON e.device_type_id = dt.id AND e.deleted_at IS NULL
      GROUP BY dt.id
    `).all();

    // 3. Assets count by Brand
    const assetsByBrand = db.prepare(`
      SELECT COALESCE(b.name, 'Chưa xác định') as brandName, COUNT(e.id) as count
      FROM equipments e
      LEFT JOIN brands b ON e.brand_id = b.id
      WHERE e.deleted_at IS NULL
      GROUP BY brandName
      ORDER BY count DESC
      LIMIT 6
    `).all();

    // 4. IT Warnings (Missing MAC, Missing IP, Windows 7)
    const missingMac = db.prepare("SELECT COUNT(*) as count FROM equipments WHERE (mac_address IS NULL OR mac_address = '' OR mac_address = 'UNKNOWN') AND deleted_at IS NULL").get().count;
    const missingIp = db.prepare("SELECT COUNT(*) as count FROM equipments WHERE (ip_address IS NULL OR ip_address = '') AND deleted_at IS NULL").get().count;
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

    // Mặc định luôn loại trừ thiết bị đã "xoá mềm" (soft-delete) khỏi danh sách.
    let whereClause = ["1=1", "e.deleted_at IS NULL"];
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
      WHERE e.id = ? AND e.deleted_at IS NULL
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
      purchase_year
    } = req.body;

    let { specs } = req.body;

    if (!device_type_id || !post_office_id) {
      return res.status(400).json({ error: 'Vui lòng chọn Loại thiết bị và Bưu cục' });
    }

    if (hostname && hostname.length > 255) return res.status(400).json({ error: 'Tên máy (hostname) không được vượt quá 255 ký tự' });
    if (model && model.length > 255) return res.status(400).json({ error: 'Model không được vượt quá 255 ký tự' });
    if (serial_number && serial_number.length > 255) return res.status(400).json({ error: 'Serial number không được vượt quá 255 ký tự' });

    if (specs !== undefined && (typeof specs !== 'object' || Array.isArray(specs) || specs === null)) {
      console.warn("Cảnh báo: 'specs' không hợp lệ (phải là object thuần). Đã bỏ qua specs.");
      specs = {};
    }

    const deviceType = db.prepare("SELECT asset_prefix FROM device_types WHERE id = ?").get(device_type_id);
    if (!deviceType) return res.status(400).json({ error: 'Loại thiết bị không tồn tại trong hệ thống' });

    // Tiền tố mã CCDC bắt buộc phải được cấu hình trước khi tạo thiết bị.
    const assetPrefix = (deviceType.asset_prefix || '').trim();
    if (!assetPrefix) {
      return res.status(400).json({ error: 'Danh mục thiết bị này chưa được cấu hình tiền tố mã CCDC, vui lòng vào Quản Lý Danh Mục để thêm trước khi tạo thiết bị.' });
    }

    const postOfficeExists = db.prepare("SELECT 1 FROM post_offices WHERE id = ?").get(post_office_id);
    if (!postOfficeExists) return res.status(400).json({ error: 'Bưu cục không tồn tại trong hệ thống' });

    // Năm mua: nếu không nhập -> mặc định năm hiện tại. Nếu nhập -> validate khoảng hợp lý.
    let finalPurchaseYear;
    if (purchase_year === undefined || purchase_year === null || purchase_year === '') {
      finalPurchaseYear = new Date().getFullYear();
    } else {
      finalPurchaseYear = parseInt(purchase_year, 10);
      if (Number.isNaN(finalPurchaseYear) || finalPurchaseYear < 1990 || finalPurchaseYear > 2100) {
        return res.status(400).json({ error: 'Năm mua không hợp lệ (phải trong khoảng 1990 - 2100)' });
      }
    }
    const yy = String(finalPurchaseYear).slice(-2);

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

    // Bọc transaction: TÍNH số thứ tự + insert equipment + insert log phải cùng 1
    // transaction. Việc tính seq (SELECT MAX) nằm CÙNG transaction với INSERT để
    // tránh race condition (better-sqlite3 đồng bộ, cùng transaction là an toàn,
    // không cần cơ chế khoá riêng). Transaction trả về asset_tag đã sinh.
    const createEquipmentTxn = db.transaction(() => {
      // Lấy TẤT CẢ asset_tag khớp tiền tố+năm (KHÔNG lọc deleted_at, để không bao
      // giờ tái sử dụng số của thiết bị đã xoá mềm) -> parse số thứ tự cuối cùng ->
      // lấy MAX + 1 (không dùng COUNT, tránh trùng nếu có khoảng trống do xoá).
      const likePattern = `${assetPrefix}-${yy}-%`;
      const rows = db.prepare("SELECT asset_tag FROM equipments WHERE asset_tag LIKE ?").all(likePattern);
      let maxSeq = 0;
      for (const r of rows) {
        const m = /-(\d+)$/.exec(r.asset_tag || '');
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > maxSeq) maxSeq = n;
        }
      }
      const seq = String(maxSeq + 1).padStart(3, '0');
      const assetTag = `${assetPrefix}-${yy}-${seq}`;

      db.prepare(`
        INSERT INTO equipments
        (id, asset_tag, hostname, ip_address, mac_address, serial_number, device_type_id, brand_id, model, specs, status, post_office_id, raw_user_name, notes, purchase_year)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'IN_USE', ?, ?, ?, ?)
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
        notes || null,
        finalPurchaseYear
      );

      db.prepare(`
        INSERT INTO asset_transfer_logs (id, equipment_id, action, to_post_office_id, reason)
        VALUES (?, ?, 'CREATE', ?, 'Thêm mới thiết bị CCDC từ hệ thống web')
      `).run(uuidv4(), eqId, post_office_id);

      return assetTag;
    });
    const generatedAssetTag = createEquipmentTxn();

    res.status(201).json({ message: 'Tạo CCDC thành công', id: eqId, asset_tag: generatedAssetTag });
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
      device_type_id,
      brand_id,
      brand_name,
      post_office_id,
      purchase_year
    } = req.body;

    let { specs } = req.body;

    if (status !== undefined) {
      const validStatuses = ['IN_USE', 'IN_STOCK', 'MAINTENANCE', 'BROKEN', 'LIQUIDATED'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Trạng thái (status) không hợp lệ' });
      }
    }

    if (model && model.length > 255) return res.status(400).json({ error: 'Model không được vượt quá 255 ký tự' });

    if (specs !== undefined && (typeof specs !== 'object' || Array.isArray(specs) || specs === null)) {
      console.warn("Cảnh báo: 'specs' không hợp lệ (phải là object thuần). Đã bỏ qua specs.");
      specs = undefined; // sẽ fallback về specs cũ của thiết bị (existing.specs) như code phía dưới
    }

    const existing = db.prepare("SELECT * FROM equipments WHERE id = ? AND deleted_at IS NULL").get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy thiết bị' });

    // device_type_id: nếu gửi lên thì validate tồn tại; nếu không gửi -> giữ nguyên.
    // LƯU Ý: đổi loại thiết bị KHÔNG đổi lại asset_tag (mã CCDC là định danh cố định
    // từ lúc tạo — chỉ ghi log UPDATE bình thường, không sinh mã mới).
    let finalDeviceTypeId = existing.device_type_id;
    if (device_type_id !== undefined && device_type_id !== null && device_type_id !== '') {
      const dtExists = db.prepare("SELECT 1 FROM device_types WHERE id = ?").get(device_type_id);
      if (!dtExists) return res.status(400).json({ error: 'Loại thiết bị không tồn tại trong hệ thống' });
      finalDeviceTypeId = device_type_id;
    }

    // post_office_id: tương tự — validate nếu gửi, giữ nguyên nếu không.
    let finalPostOfficeId = existing.post_office_id;
    if (post_office_id !== undefined && post_office_id !== null && post_office_id !== '') {
      const poExists = db.prepare("SELECT 1 FROM post_offices WHERE id = ?").get(post_office_id);
      if (!poExists) return res.status(400).json({ error: 'Bưu cục không tồn tại trong hệ thống' });
      finalPostOfficeId = post_office_id;
    }

    // purchase_year: validate nếu gửi, giữ nguyên nếu không.
    let finalPurchaseYear = existing.purchase_year;
    if (purchase_year !== undefined && purchase_year !== null && purchase_year !== '') {
      const py = parseInt(purchase_year, 10);
      if (Number.isNaN(py) || py < 1990 || py > 2100) {
        return res.status(400).json({ error: 'Năm mua không hợp lệ (phải trong khoảng 1990 - 2100)' });
      }
      finalPurchaseYear = py;
    }

    // Resolve Brand (cùng cách với route POST): brand_id trực tiếp, hoặc brand_name ->
    // tra/tạo brand. Nếu không gửi gì về brand -> giữ nguyên brand cũ.
    let finalBrandId;
    if (brand_id !== undefined && brand_id !== null && brand_id !== '') {
      finalBrandId = brand_id;
    } else if (brand_name !== undefined && brand_name !== null && brand_name !== '') {
      const existingBrand = db.prepare("SELECT id FROM brands WHERE name = ?").get(brand_name);
      if (existingBrand) {
        finalBrandId = existingBrand.id;
      } else {
        finalBrandId = uuidv4();
        db.prepare("INSERT INTO brands (id, name) VALUES (?, ?)").run(finalBrandId, brand_name);
      }
    } else {
      finalBrandId = existing.brand_id;
    }

    // Bọc transaction: update thiết bị + insert log audit phải cùng thành công/rollback.
    const updateEquipmentTxn = db.transaction(() => {
      db.prepare(`
        UPDATE equipments
        SET hostname = ?, ip_address = ?, mac_address = ?, serial_number = ?, model = ?, status = ?, raw_user_name = ?, notes = ?, specs = ?, device_type_id = ?, brand_id = ?, post_office_id = ?, purchase_year = ?
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
        finalDeviceTypeId,
        finalBrandId || null,
        finalPostOfficeId,
        finalPurchaseYear ?? null,
        req.params.id
      );

      db.prepare(`
        INSERT INTO asset_transfer_logs (id, equipment_id, action, reason)
        VALUES (?, ?, 'UPDATE', 'Cập nhật thông tin cấu hình / thiết bị')
      `).run(uuidv4(), req.params.id);
    });
    updateEquipmentTxn();

    res.json({ message: 'Cập nhật CCDC thành công' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Xoá thiết bị CCDC (SOFT-DELETE — không xoá cứng khỏi DB, chỉ đánh dấu deleted_at).
// Ghi: yêu cầu token hợp lệ + role quản lý, giống các route ghi khác.
app.delete('/api/equipments/:id', authRequired, requireManager, (req, res) => {
  try {
    const existing = db.prepare("SELECT * FROM equipments WHERE id = ? AND deleted_at IS NULL").get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy thiết bị hoặc đã bị xoá trước đó' });

    // Bọc transaction: đánh dấu deleted_at + insert log audit phải cùng thành công/rollback.
    const deleteEquipmentTxn = db.transaction(() => {
      db.prepare(`
        UPDATE equipments
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(req.params.id);

      db.prepare(`
        INSERT INTO asset_transfer_logs (id, equipment_id, action, reason)
        VALUES (?, ?, 'DELETE', 'Xoá (soft-delete) thiết bị CCDC khỏi hệ thống')
      `).run(uuidv4(), req.params.id);
    });
    deleteEquipmentTxn();

    res.json({ message: 'Đã xoá thiết bị CCDC (có thể khôi phục từ lịch sử nếu cần)' });
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

// Tiền tố mã CCDC hợp lệ: 2-5 ký tự IN HOA / số (A-Z, 0-9).
const ASSET_PREFIX_REGEX = /^[A-Z0-9]{2,5}$/;

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
app.post('/api/hrm/upload-and-map', authRequired, requireManager, (req, res) => {
  try {
    const { hrmEmployees } = req.body;
    // Expected format of hrmEmployees array:
    // [{ hrmCode: 'HRM102', fullName: 'THANH THÌN', postOfficeCode: '536750', communeCode: '5300' }]

    if (!Array.isArray(hrmEmployees) || hrmEmployees.length === 0) {
      return res.status(400).json({ error: 'Danh sách nhân sự HRM không hợp lệ hoặc rỗng' });
    }

    // Validate fail-fast TRƯỚC khi mở transaction / ghi bất kỳ dữ liệu nào.
    for (const emp of hrmEmployees) {
      if (emp.fullName !== undefined && emp.fullName !== null) {
        if (typeof emp.fullName !== 'string' || emp.fullName.length > 200) {
          return res.status(400).json({ error: 'fullName phải là chuỗi và tối đa 200 ký tự' });
        }
      }
      if (emp.hrmCode !== undefined && emp.hrmCode !== null && typeof emp.hrmCode !== 'string') {
        return res.status(400).json({ error: 'hrmCode phải là chuỗi' });
      }
    }

    let usersCreated = 0;
    let usersUpdated = 0;
    let assetsAutoMapped = 0;
    let mappingDetails = [];

    // Helper string normalizer
    const normalizeStr = (s) => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    // Bọc TOÀN BỘ đợt import HRM trong 1 transaction: mỗi nhân sự kéo theo nhiều
    // thao tác ghi (users + equipments + asset_transfer_logs). Nếu 1 dòng dữ liệu
    // lỗi giữa chừng, rollback toàn bộ đợt thay vì để lại trạng thái mapping dở dang.
    const importHrmTxn = db.transaction((employees) => {
    employees.forEach(emp => {
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
    }); // hết importHrmTxn
    importHrmTxn(hrmEmployees);

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

// ==========================================
// 5. USER ADMINISTRATION API
// ==========================================
// Danh sách user — KHÔNG bao giờ trả password_hash (SELECT tường minh từng cột).
app.get('/api/users', authRequired, requireManager, (req, res) => {
  try {
    // Vẫn trả về CẢ user đã vô hiệu hoá (khác equipments soft-delete vốn ẩn khỏi danh
    // sách) — UI cần thấy để biết ai đang bị khoá + có nút Kích Hoạt Lại.
    const users = db.prepare(`
      SELECT id, hrm_code, full_name, role, post_office_code, commune_code, post_office_id, created_at, deactivated_at
      FROM users
      ORDER BY created_at DESC
    `).all();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Tạo user mới. hrm_code bắt buộc + unique, password bắt buộc >= 6 ký tự,
// hash bằng hashPassword() trước khi lưu (không bao giờ lưu plaintext).
app.post('/api/users', authRequired, requireManager, (req, res) => {
  try {
    const { hrm_code, full_name, role, password } = req.body || {};

    if (!hrm_code || typeof hrm_code !== 'string' || !hrm_code.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập Mã HRM' });
    }
    if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập Họ và Tên' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }

    const trimmedHrmCode = hrm_code.trim();
    const existing = db.prepare("SELECT id FROM users WHERE hrm_code = ?").get(trimmedHrmCode);
    if (existing) {
      return res.status(400).json({ error: 'Mã HRM này đã tồn tại trong hệ thống' });
    }

    const finalRole = (role && typeof role === 'string' && role.trim()) ? role.trim() : 'STAFF';
    const id = uuidv4();

    db.prepare(`
      INSERT INTO users (id, hrm_code, full_name, role, password_hash)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, trimmedHrmCode, full_name.trim(), finalRole, hashPassword(password));

    res.status(201).json({
      message: 'Tạo tài khoản người dùng thành công',
      id,
      hrm_code: trimmedHrmCode,
      full_name: full_name.trim(),
      role: finalRole
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sửa full_name/role của 1 user. Chặn tự đổi role của chính mình (so
// req.user.id với :id) để tránh tự khoá quyền quản lý của chính mình.
app.put('/api/users/:id', authRequired, requireManager, (req, res) => {
  try {
    const { full_name, role } = req.body || {};
    const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

    const wantsRoleChange = role !== undefined && typeof role === 'string' && role.trim() && role.trim() !== existing.role;
    if (wantsRoleChange && req.user.id === req.params.id) {
      return res.status(400).json({ error: 'Không thể tự đổi quyền (role) của chính mình, tránh tự khoá quyền quản lý' });
    }

    const finalFullName = (full_name !== undefined && typeof full_name === 'string' && full_name.trim())
      ? full_name.trim()
      : existing.full_name;
    const finalRole = wantsRoleChange ? role.trim() : existing.role;

    db.prepare("UPDATE users SET full_name = ?, role = ? WHERE id = ?").run(finalFullName, finalRole, req.params.id);

    res.json({ message: 'Cập nhật người dùng thành công' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset mật khẩu cho user KHÁC — không cần biết mật khẩu cũ (dùng cho quản lý).
app.put('/api/users/:id/reset-password', authRequired, requireManager, (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
    }

    const existing = db.prepare("SELECT id FROM users WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), req.params.id);

    res.json({ message: 'Đặt lại mật khẩu thành công' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Vô hiệu hoá tài khoản (KHÔNG xoá cứng, chỉ set deactivated_at) — chặn đăng nhập
// từ lần sau (xem POST /api/auth/login). Chặn tự vô hiệu hoá chính mình (so
// req.user.id với :id) — copy đúng pattern đã dùng để chặn tự đổi role.
app.put('/api/users/:id/deactivate', authRequired, requireManager, (req, res) => {
  try {
    if (req.user.id === req.params.id) {
      return res.status(400).json({ error: 'Không thể tự vô hiệu hoá chính tài khoản đang đăng nhập' });
    }

    const existing = db.prepare("SELECT id FROM users WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

    db.prepare("UPDATE users SET deactivated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);

    res.json({ message: 'Đã vô hiệu hoá tài khoản' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Khôi phục tài khoản đã vô hiệu hoá (set deactivated_at = NULL).
app.put('/api/users/:id/reactivate', authRequired, requireManager, (req, res) => {
  try {
    const existing = db.prepare("SELECT id FROM users WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

    db.prepare("UPDATE users SET deactivated_at = NULL WHERE id = ?").run(req.params.id);

    res.json({ message: 'Đã kích hoạt lại tài khoản' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Tự đổi mật khẩu CỦA CHÍNH MÌNH — chỉ cần authRequired (KHÔNG cần
// requireManager, mọi user kể cả STAFF đều tự đổi được). Bắt buộc verify
// đúng mật khẩu hiện tại trước khi cho đổi.
app.put('/api/users/me/password', authRequired, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    if (!user || !verifyPassword(currentPassword, user.password_hash)) {
      return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
    }

    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(newPassword), req.user.id);

    res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve frontend static files in production
const clientBuildPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
  // Express 5 + path-to-regexp mới không còn chấp nhận wildcard '*' trần
  // (gây crash "Missing parameter name at index 1: *" ngay lúc khởi động
  // nếu thư mục dist/ tồn tại). Dùng app.use() không path — middleware
  // cuối cùng, chạy cho MỌI request chưa được route nào ở trên xử lý,
  // tương đương ý nghĩa wildcard cũ nhưng không cần path-to-regexp parse.
  app.use((req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server CCDC bưu điện đang chạy tại http://localhost:${PORT}`);
});
