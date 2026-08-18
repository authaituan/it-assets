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
      categoryRaw,
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

    if (categoryRaw) {
      whereClause.push("json_extract(e.specs, '$.category_raw') = ?");
      params.push(categoryRaw);
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

// GET unique category_raw options for dropdown filter
app.get('/api/equipments/category-raw-options', (req, res) => {
  try {
    const { deviceTypeId } = req.query;
    let sql = `
      SELECT json_extract(specs, '$.category_raw') as label, COUNT(*) as count 
      FROM equipments 
      WHERE deleted_at IS NULL 
        AND json_extract(specs, '$.category_raw') IS NOT NULL 
        AND json_extract(specs, '$.category_raw') != ''
    `;
    let params = [];
    if (deviceTypeId) {
      sql += " AND device_type_id = ?";
      params.push(deviceTypeId);
    }
    sql += " GROUP BY label ORDER BY count DESC";
    
    const options = db.prepare(sql).all(...params);
    res.json(options);
  } catch (error) {
    console.error("Get category-raw-options error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// Export toàn bộ dữ liệu CCDC khớp filter (KHÔNG phân trang — export cần lấy
// TẤT CẢ dòng cùng lúc). Tái sử dụng NGUYÊN VẸN logic WHERE clause của
// GET /api/equipments (copy từ đó, xem trên) để filter luôn đồng bộ.
// Đặt TRƯỚC GET /api/equipments/:id để route tĩnh "export-data" không bị
// route :id nuốt nhầm (Express match theo thứ tự khai báo).
// Mỗi dòng trả đủ 24 field khớp cột Excel gốc (A-X, key tiếng Việt không
// dấu) CỘNG 7 field mới (maCcdc, danhMucCcdc, tienToDanhMucMoi luôn "",
// namMua, maHrmNguoiSuDung, trangThai, ghiChu) — xem bảng field đầy đủ ở
// docs/ai/03_ARCHITECTURE_MAP.md.
// ==========================================
app.get('/api/equipments/export-data', authRequired, requireManager, (req, res) => {
  try {
    const { search, communeId, postOfficeId, deviceTypeId, categoryRaw, status } = req.query;

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

    if (status) {
      whereClause.push("e.status = ?");
      params.push(status);
    }

    if (categoryRaw) {
      whereClause.push("json_extract(e.specs, '$.category_raw') = ?");
      params.push(categoryRaw);
    }

    const dataSql = `
      SELECT
        e.*,
        pv.code as province_code, pv.name as province_name,
        p.code as post_office_code, p.name as post_office_name, p.type as post_office_type,
        p.address as post_office_address, p.bdkv_code as post_office_bdkv_code, p.bdkv_name as post_office_bdkv_name,
        c.code as commune_code, c.name as commune_name, c.central_commune_code as commune_central_code,
        dt.name as device_type_name,
        b.name as brand_name,
        u.hrm_code as assigned_user_hrm
      FROM equipments e
      JOIN post_offices p ON e.post_office_id = p.id
      JOIN commune_post_offices c ON p.commune_id = c.id
      JOIN province_post_offices pv ON c.province_id = pv.id
      JOIN device_types dt ON e.device_type_id = dt.id
      LEFT JOIN brands b ON e.brand_id = b.id
      LEFT JOIN users u ON e.assigned_user_id = u.id
      WHERE ${whereClause.join(' AND ')}
      ORDER BY e.created_at DESC
    `;

    const rows = db.prepare(dataSql).all(...params);

    const items = rows.map((r) => {
      const specs = parseSpecs(r.specs);
      return {
        // A-X: khớp thứ tự cột Excel gốc
        maBdtTp: r.province_code,
        tenBdtTp: r.province_name,
        maMbc: r.post_office_code,
        tenBuuCuc: r.post_office_name,
        maBdx: r.commune_code,
        tenBuuDienXa: r.commune_name,
        loai: r.post_office_type || '',
        ip: r.ip_address || '',
        ngayCap: r.assigned_date || '',
        tenMay: r.hostname || '',
        diaChiMac: r.mac_address || '',
        loaiMay: specs.category_raw || '',
        hang: r.brand_name || '',
        model: r.model || '',
        serialNumber: r.serial_number || '',
        heDieuHanh: specs.os || '',
        cpu: specs.cpu || '',
        ram: specs.ram || '',
        oCung: specs.storage || '',
        nguoiSuDung: r.raw_user_name || '',
        maBdkv: r.post_office_bdkv_code || '',
        tenBdkv: r.post_office_bdkv_name || '',
        buuDienXaTrungTam: r.commune_central_code || '',
        diaChiChiTiet: r.post_office_address || '',
        // Field mới (không có trong Excel gốc)
        maCcdc: r.asset_tag || '',
        danhMucCcdc: r.device_type_name || '',
        tienToDanhMucMoi: '', // chỉ có ý nghĩa lúc Import, luôn rỗng lúc Export
        namMua: r.purchase_year || '',
        maHrmNguoiSuDung: r.assigned_user_hrm || '',
        trangThai: r.status || '',
        ghiChu: r.notes || ''
      };
    });

    res.json({ items, total: items.length });
  } catch (error) {
    console.error("Export equipments error:", error);
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
      assigned_user_id,
      notes,
      purchase_year,
      category_raw
    } = req.body;

    let { specs } = req.body;

    if (!device_type_id || !post_office_id) {
      return res.status(400).json({ error: 'Vui lòng chọn Loại thiết bị và Bưu cục' });
    }

    // assigned_user_id (optional): nếu gửi và không rỗng, phải tồn tại trong
    // bảng users (nhân sự HOẶC tài khoản đăng nhập — cùng bảng). raw_user_name
    // (tên thô, không cần khớp bản ghi users) giữ nguyên hành vi cũ, không đổi.
    let finalAssignedUserId = null;
    if (assigned_user_id !== undefined && assigned_user_id !== null && assigned_user_id !== '') {
      const userExists = db.prepare("SELECT 1 FROM users WHERE id = ?").get(assigned_user_id);
      if (!userExists) return res.status(400).json({ error: 'Người sử dụng (assigned_user_id) không tồn tại trong hệ thống' });
      finalAssignedUserId = assigned_user_id;
    }

    if (hostname && hostname.length > 255) return res.status(400).json({ error: 'Tên máy (hostname) không được vượt quá 255 ký tự' });
    if (model && model.length > 255) return res.status(400).json({ error: 'Model không được vượt quá 255 ký tự' });
    if (serial_number && serial_number.length > 255) return res.status(400).json({ error: 'Serial number không được vượt quá 255 ký tự' });

    if (specs !== undefined && (typeof specs !== 'object' || Array.isArray(specs) || specs === null)) {
      console.warn("Cảnh báo: 'specs' không hợp lệ (phải là object thuần). Đã bỏ qua specs.");
      specs = {};
    }

    const mergedSpecs = { ...(specs || {}) };
    if (category_raw !== undefined) {
      mergedSpecs.category_raw = category_raw;
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
        (id, asset_tag, hostname, ip_address, mac_address, serial_number, device_type_id, brand_id, model, specs, status, post_office_id, raw_user_name, assigned_user_id, notes, purchase_year)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'IN_USE', ?, ?, ?, ?, ?)
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
        JSON.stringify(mergedSpecs),
        post_office_id,
        raw_user_name || null,
        finalAssignedUserId,
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
      assigned_user_id,
      notes,
      device_type_id,
      brand_id,
      brand_name,
      post_office_id,
      purchase_year,
      category_raw
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

    const currentSpecs = specs !== undefined ? specs : parseSpecs(existing.specs);
    const mergedSpecs = { ...currentSpecs };
    if (category_raw !== undefined) {
      mergedSpecs.category_raw = category_raw;
    }

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

    // assigned_user_id: nullable — undefined -> giữ nguyên; null/'' -> gỡ gán
    // (bỏ người sử dụng); giá trị khác -> validate tồn tại trong users.
    let finalAssignedUserId = existing.assigned_user_id;
    if (assigned_user_id !== undefined) {
      if (assigned_user_id === null || assigned_user_id === '') {
        finalAssignedUserId = null;
      } else {
        const userExists = db.prepare("SELECT 1 FROM users WHERE id = ?").get(assigned_user_id);
        if (!userExists) return res.status(400).json({ error: 'Người sử dụng (assigned_user_id) không tồn tại trong hệ thống' });
        finalAssignedUserId = assigned_user_id;
      }
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
        SET hostname = ?, ip_address = ?, mac_address = ?, serial_number = ?, model = ?, status = ?, raw_user_name = ?, assigned_user_id = ?, notes = ?, specs = ?, device_type_id = ?, brand_id = ?, post_office_id = ?, purchase_year = ?
        WHERE id = ?
      `).run(
        hostname || null,
        ip_address || null,
        mac_address || null,
        serial_number || null,
        model || null,
        status || existing.status,
        raw_user_name || null,
        finalAssignedUserId,
        notes || null,
        JSON.stringify(mergedSpecs),
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
// HELPER TỔ CHỨC DÙNG CHUNG (province -> commune -> post_office)
// ------------------------------------------------------------------
// QUYẾT ĐỊNH NGHIỆP VỤ (Phương án B, PO chốt 2026-08-17, xem 04_DECISIONS.md):
// "Quản Lý Mạng Lưới" là danh mục chuẩn BẮT BUỘC. CHỈ route Quản Lý Mạng Lưới
// (POST /api/network/import, PUT /api/network/post-offices/:id) mới được tạo
// mới Tỉnh/BĐX/Bưu cục. Route Equipment Import KHÔNG còn tự tạo tổ chức nữa —
// gọi requireExistingPostOffice() và CHẶN (400) nếu mã bưu cục chưa tồn tại.
// ==========================================

// Parse chuỗi -> số thực, rỗng/không hợp lệ -> null (dùng cho latitude/longitude).
function parseFloatOrNull(v) {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

// resolveOrCreateOrgChain: chứa NGUYÊN VẸN logic tự tạo Tỉnh->BĐX->Bưu cục
// (tách ra từ route Equipment Import cũ), MỞ RỘNG lưu thêm 9 cột mới của
// post_offices (old_ward_*, district_name, new_ward_*, phone,
// operational_status, latitude, longitude). CHỈ dùng cho "Quản Lý Mạng Lưới".
// Mutate `report` (tăng provincesCreated/communesCreated/postOfficesCreated/
// postOfficesUpdated nếu report có các field đó). Trả về { province, commune, postOffice }.
// PHẢI gọi bên trong 1 db.transaction() để rollback nếu 1 dòng lỗi.
function resolveOrCreateOrgChain(row, report, rowNum) {
  // --- Tỉnh/Thành phố ---
  const maBdtTp = (row.maBdtTp || '').trim();
  const tenBdtTp = (row.tenBdtTp || '').trim();
  let province = null;
  if (maBdtTp) {
    province = db.prepare("SELECT * FROM province_post_offices WHERE code = ?").get(maBdtTp);
    if (!province) {
      const pid = uuidv4();
      db.prepare("INSERT INTO province_post_offices (id, code, name) VALUES (?, ?, ?)")
        .run(pid, maBdtTp, tenBdtTp || maBdtTp);
      province = { id: pid, code: maBdtTp, name: tenBdtTp || maBdtTp };
      if (typeof report.provincesCreated === 'number') report.provincesCreated++;
    } else if (tenBdtTp && province.name !== tenBdtTp) {
      db.prepare("UPDATE province_post_offices SET name = ? WHERE id = ?").run(tenBdtTp, province.id);
      province.name = tenBdtTp;
    }
  }

  // --- Bưu điện Xã (BĐX / commune) ---
  const maBdx = (row.maBdx || '').trim();
  const tenBuuDienXa = (row.tenBuuDienXa || '').trim();
  const buuDienXaTrungTam = (row.buuDienXaTrungTam || '').trim() || null;
  let commune = null;
  if (maBdx) {
    commune = db.prepare("SELECT * FROM commune_post_offices WHERE code = ?").get(maBdx);
    if (!commune) {
      if (!province) {
        throw new Error(`Dòng ${rowNum}: BĐX "${maBdx}" chưa tồn tại và thiếu maBdtTp để tạo mới`);
      }
      const cid = uuidv4();
      db.prepare("INSERT INTO commune_post_offices (id, code, name, central_commune_code, province_id) VALUES (?, ?, ?, ?, ?)")
        .run(cid, maBdx, tenBuuDienXa || maBdx, buuDienXaTrungTam, province.id);
      commune = { id: cid, code: maBdx, name: tenBuuDienXa || maBdx };
      if (typeof report.communesCreated === 'number') report.communesCreated++;
    } else if (tenBuuDienXa && commune.name !== tenBuuDienXa) {
      db.prepare("UPDATE commune_post_offices SET name = ? WHERE id = ?").run(tenBuuDienXa, commune.id);
      commune.name = tenBuuDienXa;
    }
  }

  // --- Bưu cục (MBC / post_office) + 9 cột mới ---
  const maMbc = (row.maMbc || '').trim();
  const tenBuuCuc = (row.tenBuuCuc || '').trim();
  // Giá trị các field (rỗng -> null), dùng chung cho INSERT (create) và UPDATE.
  const nf = {
    type: (row.loai || '').trim() || null,
    address: (row.diaChiChiTiet || '').trim() || null,
    bdkv_code: (row.maBdkv || '').trim() || null,
    bdkv_name: (row.tenBdkv || '').trim() || null,
    old_ward_code: (row.maPhuongXaCu || '').trim() || null,
    old_ward_name: (row.tenPhuongXaCu || '').trim() || null,
    district_name: (row.tenQuanHuyen || '').trim() || null,
    new_ward_code: (row.maPhuongXaMoi || '').trim() || null,
    new_ward_name: (row.tenPhuongXaMoi || '').trim() || null,
    phone: (row.soDienThoai || '').trim() || null,
    operational_status: (row.tinhTrangHoatDong || '').trim() || null,
    latitude: parseFloatOrNull(row.viDo),
    longitude: parseFloatOrNull(row.kinhDo)
  };
  // Người Phụ Trách bưu cục (resolve theo mã HRM, giống cách Equipment Import
  // resolve maHrmNguoiSuDung -> assigned_user_id). undefined = không đụng tới
  // field này (giữ nguyên khi UPDATE, null khi CREATE).
  const maHrmPhuTrach = (row.maHrmNguoiPhuTrach || '').trim();
  let resolvedResponsibleUserId; // undefined = không có trong dòng import
  if (maHrmPhuTrach) {
    const ru = db.prepare("SELECT id FROM users WHERE hrm_code = ?").get(maHrmPhuTrach);
    if (!ru) throw new Error(`Dòng ${rowNum}: maHrmNguoiPhuTrach "${maHrmPhuTrach}" không tồn tại trong hệ thống`);
    resolvedResponsibleUserId = ru.id;
  }

  let postOffice = db.prepare("SELECT * FROM post_offices WHERE code = ?").get(maMbc);
  if (!postOffice) {
    if (!commune) {
      throw new Error(`Dòng ${rowNum}: bưu cục "${maMbc}" chưa tồn tại và thiếu maBdx để tạo mới`);
    }
    const poid = uuidv4();
    db.prepare(`
      INSERT INTO post_offices
        (id, code, name, type, address, commune_id, bdkv_code, bdkv_name,
         old_ward_code, old_ward_name, district_name, new_ward_code, new_ward_name,
         phone, operational_status, latitude, longitude, responsible_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      poid, maMbc, tenBuuCuc || maMbc, nf.type || 'GD3', nf.address, commune.id,
      nf.bdkv_code, nf.bdkv_name, nf.old_ward_code, nf.old_ward_name, nf.district_name,
      nf.new_ward_code, nf.new_ward_name, nf.phone, nf.operational_status || 'ACTIVE',
      nf.latitude, nf.longitude, resolvedResponsibleUserId || null
    );
    postOffice = db.prepare("SELECT * FROM post_offices WHERE id = ?").get(poid);
    if (typeof report.postOfficesCreated === 'number') report.postOfficesCreated++;
  } else {
    // CẬP NHẬT: chỉ ghi đè field có giá trị KHÔNG RỖNG trong dòng import (giữ
    // nguyên field vắng mặt) — cùng nguyên tắc "import theo trường cần thiết"
    // như Equipment Import.
    db.prepare(`
      UPDATE post_offices SET
        name = ?, type = ?, address = ?, bdkv_code = ?, bdkv_name = ?,
        old_ward_code = ?, old_ward_name = ?, district_name = ?, new_ward_code = ?,
        new_ward_name = ?, phone = ?, operational_status = ?, latitude = ?, longitude = ?,
        responsible_user_id = ?
      WHERE id = ?
    `).run(
      tenBuuCuc || postOffice.name,
      nf.type || postOffice.type,
      nf.address || postOffice.address,
      nf.bdkv_code || postOffice.bdkv_code,
      nf.bdkv_name || postOffice.bdkv_name,
      nf.old_ward_code || postOffice.old_ward_code,
      nf.old_ward_name || postOffice.old_ward_name,
      nf.district_name || postOffice.district_name,
      nf.new_ward_code || postOffice.new_ward_code,
      nf.new_ward_name || postOffice.new_ward_name,
      nf.phone || postOffice.phone,
      nf.operational_status || postOffice.operational_status,
      nf.latitude !== null ? nf.latitude : postOffice.latitude,
      nf.longitude !== null ? nf.longitude : postOffice.longitude,
      resolvedResponsibleUserId !== undefined ? resolvedResponsibleUserId : postOffice.responsible_user_id,
      postOffice.id
    );
    postOffice = db.prepare("SELECT * FROM post_offices WHERE id = ?").get(postOffice.id);
    if (typeof report.postOfficesUpdated === 'number') report.postOfficesUpdated++;
  }

  return { province, commune, postOffice };
}

// requireExistingPostOffice: CHỈ tra bưu cục theo code, KHÔNG tạo mới. Dùng cho
// Equipment Import (Phương án B: không được tự tạo tổ chức). Throw lỗi rõ ràng
// nếu không tìm thấy.
function requireExistingPostOffice(maMbc) {
  const po = db.prepare("SELECT * FROM post_offices WHERE code = ?").get(maMbc);
  if (!po) {
    throw new Error(`Bưu cục ${maMbc} chưa có trong hệ thống Quản Lý Mạng Lưới, vui lòng thêm bưu cục này trước hoặc kiểm tra lại mã.`);
  }
  return po;
}

// ==========================================
// Import hàng loạt CCDC từ file Excel (đã parse sẵn phía frontend thành
// mảng `rows`, mỗi phần tử dùng đúng key JSON của GET /api/equipments/export-data
// ở trên — 24 field gốc A-X + 7 field mới). Bọc TOÀN BỘ đợt trong 1
// db.transaction(): 1 dòng lỗi -> throw -> better-sqlite3 tự rollback toàn
// bộ transaction -> trả 400 (fail-fast, giống POST /api/personnel/import).
// PHƯƠNG ÁN B (PO chốt 2026-08-17): route này KHÔNG còn tự tạo tổ chức mới —
// gọi requireExistingPostOffice() và CHẶN (400) nếu mã bưu cục chưa có trong
// hệ thống Quản Lý Mạng Lưới. Các field report provincesCreated/communesCreated/
// postOfficesCreated GIỮ NGUYÊN trong response (để không phá frontend) nhưng
// LUÔN = 0.
// ==========================================
app.post('/api/equipments/import', authRequired, requireManager, (req, res) => {
  try {
    const { rows } = req.body || {};
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Danh sách dữ liệu import không hợp lệ hoặc rỗng' });
    }

    // Validate tối thiểu fail-fast TRƯỚC khi mở transaction: mỗi dòng phải có
    // maMbc VÀ (tenMay HOẶC maCcdc). Liệt kê TẤT CẢ dòng lỗi (không chỉ dòng đầu).
    const validationErrors = [];
    rows.forEach((r, idx) => {
      const rowNum = idx + 1;
      if (!r || typeof r.maMbc !== 'string' || !r.maMbc.trim()) {
        validationErrors.push({ row: rowNum, message: 'Thiếu maMbc (mã bưu cục)' });
        return;
      }
      const hasHostname = typeof r.tenMay === 'string' && r.tenMay.trim();
      const hasAssetTag = typeof r.maCcdc === 'string' && r.maCcdc.trim();
      if (!hasHostname && !hasAssetTag) {
        validationErrors.push({ row: rowNum, message: 'Phải có tenMay (tên máy) hoặc maCcdc (mã CCDC)' });
      }
    });
    if (validationErrors.length > 0) {
      return res.status(400).json({ error: 'Dữ liệu import có dòng không hợp lệ', errors: validationErrors });
    }

    const VALID_STATUSES = ['IN_USE', 'IN_STOCK', 'MAINTENANCE', 'BROKEN', 'LIQUIDATED'];

    const report = {
      provincesCreated: 0,
      communesCreated: 0,
      postOfficesCreated: 0,
      brandsCreated: 0,
      deviceTypesCreated: 0,
      equipmentsCreated: 0,
      equipmentsUpdated: 0,
      errors: []
    };

    const importTxn = db.transaction((items) => {
      items.forEach((r, idx) => {
        const rowNum = idx + 1;

        // b. PHƯƠNG ÁN B: bưu cục PHẢI đã tồn tại trong hệ thống Quản Lý Mạng
        // Lưới. Route này KHÔNG tự tạo Tỉnh/BĐX/Bưu cục nữa — chặn 400 nếu mã
        // bưu cục chưa có (report.provincesCreated/communesCreated/
        // postOfficesCreated giữ nguyên = 0). Các field org khác trong dòng
        // (maBdtTp/maBdx/tenBuuCuc...) bị bỏ qua ở route này.
        let postOffice;
        try {
          postOffice = requireExistingPostOffice(r.maMbc.trim());
        } catch (e) {
          throw new Error(`Dòng ${rowNum}: ${e.message}`);
        }

        // c. Resolve/tạo mới brand theo tên (upsert theo name).
        const hang = (r.hang || '').trim();
        let brandId = null;
        if (hang) {
          const existingBrand = db.prepare("SELECT id FROM brands WHERE name = ?").get(hang);
          if (existingBrand) {
            brandId = existingBrand.id;
          } else {
            brandId = uuidv4();
            db.prepare("INSERT INTO brands (id, name) VALUES (?, ?)").run(brandId, hang);
            report.brandsCreated++;
          }
        }

        // d. Resolve/tạo mới device_type theo tên THẬT (danhMucCcdc, khác cột L/loaiMay).
        const danhMucCcdc = (r.danhMucCcdc || '').trim();
        const maCcdc = (r.maCcdc || '').trim();
        let deviceType = null;
        if (danhMucCcdc) {
          deviceType = db.prepare("SELECT * FROM device_types WHERE name = ?").get(danhMucCcdc);
          if (!deviceType) {
            const tienTo = (r.tienToDanhMucMoi || '').trim().toUpperCase();
            // Danh mục mới cần tiền tố hợp lệ để CÓ THỂ tạo thiết bị mới. Nếu dòng này
            // đang CẬP NHẬT thiết bị đã có (maCcdc có giá trị) -> không bắt buộc tiền tố
            // (không cần sinh mã mới), chỉ bắt buộc khi đang TẠO MỚI (không có maCcdc).
            if (!maCcdc && !ASSET_PREFIX_REGEX.test(tienTo)) {
              throw new Error(`Dòng ${rowNum}: danh mục "${danhMucCcdc}" chưa có, cần tienToDanhMucMoi hợp lệ (2-5 ký tự A-Z/0-9) để tạo danh mục mới`);
            }
            const dtId = uuidv4();
            const dtCode = danhMucCcdc.toUpperCase().replace(/[^A-Z0-9]/g, '_') + '_' + dtId.slice(0, 4);
            db.prepare("INSERT INTO device_types (id, code, name, asset_prefix) VALUES (?, ?, ?, ?)")
              .run(dtId, dtCode, danhMucCcdc, ASSET_PREFIX_REGEX.test(tienTo) ? tienTo : null);
            deviceType = { id: dtId, code: dtCode, name: danhMucCcdc, asset_prefix: ASSET_PREFIX_REGEX.test(tienTo) ? tienTo : null };
            report.deviceTypesCreated++;
          }
        }

        // Resolve người sử dụng theo mã HRM (nếu có gửi).
        const maHrm = (r.maHrmNguoiSuDung || '').trim();
        let resolvedAssignedUserId; // undefined = không đụng tới field này
        if (maHrm) {
          const u = db.prepare("SELECT id FROM users WHERE hrm_code = ?").get(maHrm);
          if (!u) throw new Error(`Dòng ${rowNum}: maHrmNguoiSuDung "${maHrm}" không tồn tại trong hệ thống`);
          resolvedAssignedUserId = u.id;
        }

        // e/f. Resolve thiết bị theo maCcdc (asset_tag).
        let equipment = null;
        if (maCcdc) {
          equipment = db.prepare("SELECT * FROM equipments WHERE asset_tag = ? AND deleted_at IS NULL").get(maCcdc);
          if (!equipment) {
            throw new Error(`Dòng ${rowNum}: maCcdc "${maCcdc}" không tồn tại trong hệ thống, không thể cập nhật`);
          }
        }

        if (equipment) {
          // e. CẬP NHẬT — CHỈ ghi đè field có giá trị KHÔNG RỖNG trong dòng import.
          // KHÔNG đổi lại asset_tag dù đổi danh mục.
          const currentSpecs = parseSpecs(equipment.specs);
          const mergedSpecs = { ...currentSpecs };
          if ((r.loaiMay || '').trim()) mergedSpecs.category_raw = r.loaiMay.trim();
          if ((r.heDieuHanh || '').trim()) mergedSpecs.os = r.heDieuHanh.trim();
          if ((r.cpu || '').trim()) mergedSpecs.cpu = r.cpu.trim();
          if ((r.ram || '').trim()) mergedSpecs.ram = r.ram.trim();
          if ((r.oCung || '').trim()) mergedSpecs.storage = r.oCung.trim();

          let finalStatus = equipment.status;
          if ((r.trangThai || '').trim()) {
            const st = r.trangThai.trim();
            if (!VALID_STATUSES.includes(st)) throw new Error(`Dòng ${rowNum}: trangThai "${st}" không hợp lệ`);
            finalStatus = st;
          }

          let finalPurchaseYear = equipment.purchase_year;
          if (r.namMua !== undefined && r.namMua !== null && String(r.namMua).trim() !== '') {
            const py = parseInt(r.namMua, 10);
            if (Number.isNaN(py) || py < 1990 || py > 2100) throw new Error(`Dòng ${rowNum}: namMua "${r.namMua}" không hợp lệ`);
            finalPurchaseYear = py;
          }

          db.prepare(`
            UPDATE equipments
            SET hostname = ?, ip_address = ?, mac_address = ?, serial_number = ?, model = ?, status = ?,
                raw_user_name = ?, assigned_user_id = ?, notes = ?, specs = ?, device_type_id = ?, brand_id = ?,
                post_office_id = ?, purchase_year = ?, assigned_date = ?
            WHERE id = ?
          `).run(
            (r.tenMay || '').trim() || equipment.hostname,
            (r.ip || '').trim() || equipment.ip_address,
            (r.diaChiMac || '').trim() || equipment.mac_address,
            (r.serialNumber || '').trim() || equipment.serial_number,
            (r.model || '').trim() || equipment.model,
            finalStatus,
            (r.nguoiSuDung || '').trim() || equipment.raw_user_name,
            resolvedAssignedUserId !== undefined ? resolvedAssignedUserId : equipment.assigned_user_id,
            (r.ghiChu || '').trim() || equipment.notes,
            JSON.stringify(mergedSpecs),
            deviceType ? deviceType.id : equipment.device_type_id,
            brandId || equipment.brand_id,
            postOffice.id,
            finalPurchaseYear ?? null,
            (r.ngayCap || '').trim() || equipment.assigned_date,
            equipment.id
          );

          db.prepare(`
            INSERT INTO asset_transfer_logs (id, equipment_id, action, reason)
            VALUES (?, ?, 'UPDATE', 'Cập nhật qua Import Excel')
          `).run(uuidv4(), equipment.id);

          report.equipmentsUpdated++;
        } else {
          // f. TẠO MỚI — sinh asset_tag theo đúng cơ chế đã có ở POST /api/equipments.
          if (!deviceType) {
            throw new Error(`Dòng ${rowNum}: thiếu danhMucCcdc (danh mục CCDC) để tạo thiết bị mới`);
          }
          const assetPrefix = (deviceType.asset_prefix || '').trim();
          if (!assetPrefix) {
            throw new Error(`Dòng ${rowNum}: danh mục "${deviceType.name}" chưa có tiền tố mã CCDC, vui lòng cấu hình tienToDanhMucMoi trước khi tạo thiết bị mới`);
          }

          let finalPurchaseYear = new Date().getFullYear();
          if (r.namMua !== undefined && r.namMua !== null && String(r.namMua).trim() !== '') {
            finalPurchaseYear = parseInt(r.namMua, 10);
            if (Number.isNaN(finalPurchaseYear) || finalPurchaseYear < 1990 || finalPurchaseYear > 2100) {
              throw new Error(`Dòng ${rowNum}: namMua "${r.namMua}" không hợp lệ`);
            }
          }
          const yy = String(finalPurchaseYear).slice(-2);
          const likePattern = `${assetPrefix}-${yy}-%`;
          const seqRows = db.prepare("SELECT asset_tag FROM equipments WHERE asset_tag LIKE ?").all(likePattern);
          let maxSeq = 0;
          for (const sr of seqRows) {
            const m = /-(\d+)$/.exec(sr.asset_tag || '');
            if (m) {
              const n = parseInt(m[1], 10);
              if (n > maxSeq) maxSeq = n;
            }
          }
          const seq = String(maxSeq + 1).padStart(3, '0');
          const newAssetTag = `${assetPrefix}-${yy}-${seq}`;

          const specs = {};
          if ((r.loaiMay || '').trim()) specs.category_raw = r.loaiMay.trim();
          if ((r.heDieuHanh || '').trim()) specs.os = r.heDieuHanh.trim();
          if ((r.cpu || '').trim()) specs.cpu = r.cpu.trim();
          if ((r.ram || '').trim()) specs.ram = r.ram.trim();
          if ((r.oCung || '').trim()) specs.storage = r.oCung.trim();

          let status = 'IN_USE';
          if ((r.trangThai || '').trim()) {
            if (!VALID_STATUSES.includes(r.trangThai.trim())) throw new Error(`Dòng ${rowNum}: trangThai "${r.trangThai}" không hợp lệ`);
            status = r.trangThai.trim();
          }

          const newId = uuidv4();
          db.prepare(`
            INSERT INTO equipments
            (id, asset_tag, hostname, ip_address, mac_address, serial_number, device_type_id, brand_id, model, specs, status, assigned_date, post_office_id, raw_user_name, assigned_user_id, notes, purchase_year)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            newId,
            newAssetTag,
            (r.tenMay || '').trim() || null,
            (r.ip || '').trim() || null,
            (r.diaChiMac || '').trim() || null,
            (r.serialNumber || '').trim() || null,
            deviceType.id,
            brandId,
            (r.model || '').trim() || null,
            JSON.stringify(specs),
            status,
            (r.ngayCap || '').trim() || null,
            postOffice.id,
            (r.nguoiSuDung || '').trim() || null,
            resolvedAssignedUserId || null,
            (r.ghiChu || '').trim() || null,
            finalPurchaseYear
          );

          db.prepare(`
            INSERT INTO asset_transfer_logs (id, equipment_id, action, to_post_office_id, reason)
            VALUES (?, ?, 'CREATE', ?, 'Tạo mới qua Import Excel')
          `).run(uuidv4(), newId, postOffice.id);

          report.equipmentsCreated++;
        }
      });
    });

    try {
      importTxn(rows);
    } catch (txnError) {
      return res.status(400).json({ error: txnError.message });
    }

    res.json(report);
  } catch (error) {
    console.error("Import equipments error:", error);
    res.status(500).json({ error: error.message });
  }
});

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
// ==========================================
// Helper string normalizer (bỏ dấu + viết thường), dùng chung cho tìm kiếm
// nhân sự (search/autocomplete). Copy nguyên logic từ route HRM cũ
// (POST /api/hrm/upload-and-map, đã xoá — xem docs/ai/04_DECISIONS.md) trước
// khi xoá route đó, giữ lại đúng hành vi chuẩn hoá.
// ==========================================
const normalizeStr = (s) => (s || '').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

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

// ==========================================
// 5. USER ADMINISTRATION API
// ==========================================
// Danh sách user — KHÔNG bao giờ trả password_hash (SELECT tường minh từng cột).
// CHỈ trả tài khoản đăng nhập THẬT (password_hash IS NOT NULL) — bảng `users`
// giờ dùng chung cho cả nhân sự thuần (không có password_hash, quản lý qua
// /api/personnel), nên route này phải lọc để không lẫn nhân sự vào danh sách
// tài khoản đăng nhập.
app.get('/api/users', authRequired, requireManager, (req, res) => {
  try {
    // Vẫn trả về CẢ user đã vô hiệu hoá (khác equipments soft-delete vốn ẩn khỏi danh
    // sách) — UI cần thấy để biết ai đang bị khoá + có nút Kích Hoạt Lại.
    const users = db.prepare(`
      SELECT id, hrm_code, full_name, role, post_office_code, commune_code, post_office_id, created_at, deactivated_at
      FROM users
      WHERE password_hash IS NOT NULL
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
