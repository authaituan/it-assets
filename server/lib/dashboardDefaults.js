// ==========================================
// Dashboard động — bộ ô mặc định (tái hiện đúng Dashboard cố định trước đây) + hàm seed.
// seedDefaultWidgets(db) chạy trong transaction của caller hoặc tự bọc; KHÔNG require server/db.js
// (db.js gọi hàm này lúc khởi tạo -> tránh vòng require).
// ==========================================
'use strict';
const crypto = require('crypto');

const DEFAULT_WIDGETS = [
  { kind: 'SYSTEM', system_key: 'KPI_SUMMARY', title: 'Tổng quan', size: 'FULL' },
  { kind: 'CHART', title: 'Thiết bị theo BĐX / bưu cục', source: 'EQUIPMENT', group_by: 'commune', chart_type: 'BAR', top_n: 10, size: 'XL' },
  { kind: 'SYSTEM', system_key: 'IT_WARNINGS', title: 'Cảnh báo & rủi ro IT', size: 'M' },
  { kind: 'CHART', title: 'Theo loại thiết bị', source: 'EQUIPMENT', group_by: 'device_type', chart_type: 'DONUT', top_n: 5, size: 'M' },
  { kind: 'CHART', title: 'Theo trạng thái', source: 'EQUIPMENT', group_by: 'status', chart_type: 'LIST', top_n: 10, size: 'M' },
  { kind: 'CHART', title: 'Theo hãng (Top 6)', source: 'EQUIPMENT', group_by: 'brand', chart_type: 'LIST', top_n: 6, size: 'M' },
  { kind: 'SYSTEM', system_key: 'UPGRADE', title: 'Thiết bị cần nâng cấp / thay thế', size: 'XL' },
  { kind: 'SYSTEM', system_key: 'RECENT_ACTIVITY', title: 'Hoạt động gần đây', size: 'M' },
  { kind: 'SYSTEM', system_key: 'EMAIL_STATS', title: 'Thống kê email', size: 'FULL' }
];

function insertDefaults(db) {
  const ins = db.prepare(`
    INSERT INTO dashboard_widgets (id, kind, system_key, title, source, group_by, chart_type, top_n, filters, size, position, visible)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
  DEFAULT_WIDGETS.forEach((w, i) => {
    ins.run(crypto.randomUUID(), w.kind, w.system_key || null, w.title, w.source || null, w.group_by || null,
      w.chart_type || null, w.top_n || 10, '{}', w.size, i + 1);
  });
}

// Chỉ seed khi bảng RỖNG (idempotent). Trả true nếu đã seed.
function seedDefaultWidgets(db) {
  let seeded = false;
  db.transaction(() => {
    const n = db.prepare('SELECT COUNT(*) AS n FROM dashboard_widgets').get().n;
    if (n === 0) { insertDefaults(db); seeded = true; }
  })();
  return seeded;
}

// Xoá toàn bộ cấu hình rồi seed lại mặc định (1 transaction).
function resetDefaultWidgets(db) {
  db.transaction(() => {
    db.prepare('DELETE FROM dashboard_widgets').run();
    insertDefaults(db);
  })();
}

module.exports = { DEFAULT_WIDGETS, seedDefaultWidgets, resetDefaultWidgets };
