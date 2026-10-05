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

module.exports = router;
