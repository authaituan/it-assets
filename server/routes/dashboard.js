const express = require('express');
const db = require('../db');
const { parseSpecs } = require('../lib/helpers');

const router = express.Router();

// ==========================================
// 1. DASHBOARD & STATS API
// ==========================================
router.get('/dashboard/stats', (req, res) => {
  try {
    const totalAssets = db.prepare("SELECT COUNT(*) as count FROM equipments WHERE deleted_at IS NULL").get().count;
    const activeAssets = db.prepare("SELECT COUNT(*) as count FROM equipments WHERE status = 'IN_USE' AND deleted_at IS NULL").get().count;
    const totalCommunes = db.prepare("SELECT COUNT(*) as count FROM commune_post_offices").get().count;
    const totalPostOffices = db.prepare("SELECT COUNT(*) as count FROM post_offices").get().count;
    const emptyPostOffices = db.prepare("SELECT COUNT(*) as count FROM post_offices WHERE has_computer = 0 OR id NOT IN (SELECT DISTINCT post_office_id FROM equipments WHERE deleted_at IS NULL)").get().count;

    // Một lần quét equipments: parse specs đúng 1 lần cho mọi chỉ số (nâng cấp, Win 7, tuổi máy).
    // lowSpecCount GIỮ NGUYÊN quy tắc cũ: RAM chứa '4gb'/'2gb' HOẶC chỉ có HDD (có 'hdd', không 'ssd').
    const allEquipments = db.prepare("SELECT specs, purchase_year FROM equipments WHERE deleted_at IS NULL").all();
    let lowSpecCount = 0;
    let lowRamCount = 0;
    let hddOnlyCount = 0;
    let missingPurchaseYear = 0;
    let win7Count = 0;
    const maxPurchaseYear = new Date().getFullYear() + 1;
    const byAge = { BEFORE_2015: 0, Y2015_2018: 0, Y2019_2021: 0, Y2022_PLUS: 0 };
    allEquipments.forEach(eq => {
      const specs = parseSpecs(eq.specs);
      const ram = (specs.ram || '').toLowerCase();
      const storage = (specs.storage || '').toLowerCase();
      const os = (specs.os || '').toLowerCase();
      const lowRam = ram.includes('4gb') || ram.includes('2gb');
      const hddOnly = storage.includes('hdd') && !storage.includes('ssd');
      if (lowRam) lowRamCount++;
      if (hddOnly) hddOnlyCount++;
      if (lowRam || hddOnly) lowSpecCount++;
      if (os.includes('win') && os.includes('7')) win7Count++;

      // Năm mua chỉ hợp lệ khi là số nguyên trong 1990..năm hiện tại+1; ngoài khoảng (0, âm, NaN...) = thiếu.
      const y = eq.purchase_year;
      if (!Number.isInteger(y) || y < 1990 || y > maxPurchaseYear) missingPurchaseYear++;
      else if (y < 2015) byAge.BEFORE_2015++;
      else if (y <= 2018) byAge.Y2015_2018++;
      else if (y <= 2021) byAge.Y2019_2021++;
      else byAge.Y2022_PLUS++;
    });

    // Đếm theo trạng thái (đủ 5 trạng thái, thiếu thì 0).
    const STATUSES = ['IN_USE', 'IN_STOCK', 'MAINTENANCE', 'BROKEN', 'LIQUIDATED'];
    const statusCounts = {};
    db.prepare("SELECT status, COUNT(*) as count FROM equipments WHERE deleted_at IS NULL GROUP BY status").all()
      .forEach(r => { statusCounts[r.status] = r.count; });
    const assetsByStatus = STATUSES.map(st => ({ status: st, count: statusCounts[st] || 0 }));
    const brokenOrMaintenanceCount = (statusCounts.BROKEN || 0) + (statusCounts.MAINTENANCE || 0);
    const inStockCount = statusCounts.IN_STOCK || 0;

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

    // 5. Hoạt động gần đây: 8 log mới nhất (thiết bị đã xoá mềm vẫn hiện; LEFT JOIN nên không hỏng truy vấn).
    const recentActivity = db.prepare(`
      SELECT l.id, l.action, e.asset_tag AS assetTag, e.hostname,
             fp.name AS fromPostOffice, tp.name AS toPostOffice, l.reason, l.transferred_at AS at
      FROM asset_transfer_logs l
      LEFT JOIN equipments e ON e.id = l.equipment_id
      LEFT JOIN post_offices fp ON fp.id = l.from_post_office_id
      LEFT JOIN post_offices tp ON tp.id = l.to_post_office_id
      ORDER BY l.transferred_at DESC, l.id DESC
      LIMIT 8
    `).all();

    // 6. Email: created_date lưu ISO YYYY-MM-DD -> so sánh chuỗi theo tháng hiện tại (múi giờ máy chủ).
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const monthStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthStart = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-01`;
    const emailRow = db.prepare(`
      SELECT COUNT(*) AS total,
             COALESCE(SUM(CASE WHEN revoked_date IS NULL THEN 1 ELSE 0 END), 0) AS active,
             COALESCE(SUM(CASE WHEN revoked_date IS NOT NULL THEN 1 ELSE 0 END), 0) AS revoked,
             COALESCE(SUM(CASE WHEN kind = 'UNIT' THEN 1 ELSE 0 END), 0) AS unit,
             COALESCE(SUM(CASE WHEN kind = 'PERSONAL' THEN 1 ELSE 0 END), 0) AS personal,
             COALESCE(SUM(CASE WHEN created_date >= ? AND created_date < ? THEN 1 ELSE 0 END), 0) AS createdThisMonth
      FROM emails
    `).get(monthStart, nextMonthStart);

    res.json({
      summary: {
        totalAssets,
        activeAssets,
        totalCommunes,
        totalPostOffices,
        emptyPostOffices,
        lowSpecCount,
        brokenOrMaintenanceCount,
        inStockCount
      },
      charts: {
        assetsByCommune,
        assetsByType,
        assetsByBrand,
        assetsByStatus
      },
      warnings: {
        missingMac,
        missingIp,
        win7Count
      },
      upgrade: {
        lowRamCount,
        hddOnlyCount,
        missingPurchaseYear,
        byAge: [
          { bucket: 'BEFORE_2015', count: byAge.BEFORE_2015 },
          { bucket: 'Y2015_2018', count: byAge.Y2015_2018 },
          { bucket: 'Y2019_2021', count: byAge.Y2019_2021 },
          { bucket: 'Y2022_PLUS', count: byAge.Y2022_PLUS }
        ]
      },
      recentActivity,
      emails: emailRow
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
