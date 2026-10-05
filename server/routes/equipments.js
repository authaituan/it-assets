const express = require('express');
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const { authRequired, requireManager } = require('../auth');
const { parseSpecs, ASSET_PREFIX_REGEX } = require('../lib/helpers');
const { requireExistingPostOffice } = require('../lib/orgImport');

const router = express.Router();

// ==========================================
// 2. EQUIPMENTS CRUD API
// ==========================================
router.get('/equipments', (req, res) => {
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
router.get('/equipments/category-raw-options', (req, res) => {
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
router.get('/equipments/export-data', authRequired, requireManager, (req, res) => {
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
router.get('/equipments/:id', (req, res) => {
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
router.post('/equipments', authRequired, requireManager, (req, res) => {
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
router.put('/equipments/:id', authRequired, requireManager, (req, res) => {
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
router.delete('/equipments/:id', authRequired, requireManager, (req, res) => {
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
router.post('/equipments/import', authRequired, requireManager, (req, res) => {
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

module.exports = router;
