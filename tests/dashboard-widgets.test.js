// ==========================================
// Test: Dashboard động (server/routes/dashboardWidgets.js + server/lib/dashboardSources.js)
// Seed mặc định, phân quyền ADMIN-only cho ghi, tính đúng số liệu theo whitelist, validate,
// chống chèn SQL. Dữ liệu seed có chủ đích trong DB tạm (không đụng data/ccdc.db).
// ==========================================
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, waitForServer, cleanupDbFiles, closeServer } = require('./helpers/serverHarness');
const { seedMinimalOrg, seedUser, uid } = require('./helpers/fixtures');
const { computeWidgetData } = require('../server/lib/dashboardSources');
const { seedDefaultWidgets } = require('../server/lib/dashboardDefaults');

const PORT = 5910;
const USERS = {
  admin: { hrm: 'DW_ADMIN', pass: 'Admin@123', role: 'ADMIN' },
  manager: { hrm: 'DW_MGR', pass: 'Manager@123', role: 'MANAGER' },
  staff: { hrm: 'DW_STAFF', pass: 'Staff@123', role: 'STAFF' }
};

let ctx;
let org;
let c2; // BĐX thứ hai
let po2;
const tokens = {};

async function api(method, path, who, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (who) headers.Authorization = `Bearer ${tokens[who]}`;
  const res = await fetch(`${ctx.baseUrl}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  let json = null;
  try { json = await res.json(); } catch (e) { /* không có body */ }
  return { status: res.status, body: json };
}
const admin = (m, p, b) => api(m, p, 'admin', b);

const count = (table) => ctx.db.prepare(`SELECT COUNT(*) c FROM ${table}`).get().c;
// Tính trực tiếp qua lib (cùng code với route) trên DB test để kiểm tra nhiều tổ hợp nhanh.
const calc = (cfg) => computeWidgetData(ctx.db, { top_n: 10, filters: {}, chart_type: 'BAR', ...cfg });
const asMap = (r) => Object.fromEntries(r.items.map((x) => [x.label, x.count]));

function addEquip({ typeId, brandId = null, model = null, status = 'IN_USE', poId, year = null, specs = {}, ip = null, mac = null, deleted = false, rawSpecs }) {
  ctx.db.prepare(`
    INSERT INTO equipments (id, asset_tag, hostname, ip_address, mac_address, device_type_id, brand_id, model, specs, status, post_office_id, purchase_year, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uid(), `DW-${uid().slice(0, 8)}`, 'h', ip, mac, typeId, brandId, model, rawSpecs !== undefined ? rawSpecs : JSON.stringify(specs),
    status, poId, year, deleted ? '2024-01-01 00:00:00' : null);
}

before(async () => {
  ctx = startTestServer({ port: PORT, dbFileName: `ccdc-test-dashboard-widgets-${Date.now()}.db` });
  await waitForServer(ctx.baseUrl);
  org = seedMinimalOrg(ctx.db);
  for (const u of Object.values(USERS)) seedUser(ctx.db, { hrmCode: u.hrm, fullName: u.hrm, role: u.role, password: u.pass });
  for (const [k, u] of Object.entries(USERS)) {
    const r = await fetch(`${ctx.baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hrm_code: u.hrm, password: u.pass })
    });
    tokens[k] = (await r.json()).token;
  }

  // --- tổ chức: BĐX thứ hai + bưu cục thứ hai (VHX, ngừng hoạt động, không có máy, có toạ độ, phường mới)
  c2 = uid(); po2 = uid();
  ctx.db.prepare('INSERT INTO commune_post_offices (id, code, name, province_id) VALUES (?, ?, ?, ?)').run(c2, 'DWC2', 'BĐX Hai', org.provinceId);
  ctx.db.prepare(`INSERT INTO post_offices (id, code, name, type, commune_id, has_computer, operational_status, new_ward_name, latitude, longitude)
    VALUES (?, 'DWPO2', 'Bưu cục Hai', 'VHX', ?, 0, 'INACTIVE', 'Phường A', 16.4, 107.5)`).run(po2, c2);

  // --- danh mục + hãng
  const printerId = uid(); const dell = uid(); const hp = uid();
  ctx.db.prepare("INSERT INTO device_types (id, code, name, asset_prefix) VALUES (?, 'DWPRN', 'Máy in', 'DWP')").run(printerId);
  ctx.db.prepare("INSERT INTO brands (id, name) VALUES (?, 'Dell')").run(dell);
  ctx.db.prepare("INSERT INTO brands (id, name) VALUES (?, 'HP')").run(hp);
  org.printerId = printerId;

  const pc = org.deviceTypeId;
  const p1 = org.postOfficeId;
  addEquip({ typeId: pc, brandId: dell, model: 'Optiplex', status: 'IN_USE', poId: p1, year: 2014, ip: '10.0.0.1', mac: 'AA', specs: { os: 'Windows 7', ram: '4GB', cpu: 'i3' } });
  addEquip({ typeId: pc, brandId: dell, model: 'Optiplex', status: 'IN_USE', poId: p1, year: 2016, ip: '10.0.0.2', mac: 'BB', specs: { os: 'Windows 10' } });
  addEquip({ typeId: printerId, brandId: hp, model: null, status: 'BROKEN', poId: po2, year: 2020, ip: '', mac: 'UNKNOWN', specs: {} });
  addEquip({ typeId: printerId, brandId: null, model: '', status: 'IN_STOCK', poId: po2, year: 0, ip: null, mac: null, rawSpecs: 'not json' });
  addEquip({ typeId: pc, brandId: hp, model: null, status: 'MAINTENANCE', poId: p1, year: 2023, ip: '10.0.0.5', mac: '', specs: {} });
  addEquip({ typeId: pc, brandId: dell, model: 'Optiplex', status: 'BROKEN', poId: p1, year: 2010, deleted: true }); // xoá mềm: KHÔNG được đếm
  addEquip({ typeId: printerId, brandId: null, model: null, status: 'LIQUIDATED', poId: po2, year: null, ip: null, mac: null, specs: {} });
  addEquip({ typeId: pc, brandId: dell, model: 'Latitude', status: 'IN_USE', poId: p1, year: 2019, ip: '10.0.0.8', mac: 'CC', specs: { os: 'Windows 10', ram: '8GB' } });

  // --- email
  const em = ctx.db.prepare('INSERT INTO emails (id, email, kind, hrm_code, full_name, commune_id, post_office_id, created_date, revoked_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  em.run(uid(), 'm1@t.vn', 'UNIT', null, 'M1', org.communeId, p1, '2024-03-05', null);
  em.run(uid(), 'm2@t.vn', 'PERSONAL', 'H2', 'M2', org.communeId, null, '2024-03-20', null);
  em.run(uid(), 'm3@t.vn', 'PERSONAL', 'H3', 'M3', c2, po2, '2025-01-10', '2025-02-01');
  em.run(uid(), 'm4@t.vn', 'UNIT', null, 'M4', null, null, null, null);
});

after(async () => {
  await closeServer(ctx.server);
  cleanupDbFiles(ctx.testDbPath, ctx.db);
});

// ------------------ SEED MẶC ĐỊNH ------------------
test('seed mặc định: đủ 9 ô, đúng thứ tự/loại/cỡ; gọi seed lại không nhân đôi', async () => {
  const r = await admin('GET', '/api/dashboard/widgets');
  assert.equal(r.status, 200);
  const items = r.body.items;
  assert.equal(items.length, 9);
  assert.deepEqual(items.map((x) => x.system_key || x.group_by), ['KPI_SUMMARY', 'commune', 'IT_WARNINGS', 'device_type', 'status', 'brand', 'UPGRADE', 'RECENT_ACTIVITY', 'EMAIL_STATS']);
  assert.deepEqual(items.map((x) => x.size), ['FULL', 'XL', 'M', 'M', 'M', 'M', 'XL', 'M', 'FULL']);
  assert.deepEqual(items.map((x) => x.position), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(items.map((x) => x.chart_type), [null, 'BAR', null, 'DONUT', 'LIST', 'LIST', null, null, null]);
  assert.deepEqual(items.filter((x) => x.kind === 'CHART').map((x) => x.top_n), [10, 5, 10, 6]);
  assert.ok(items.filter((x) => x.kind === 'CHART').every((x) => x.source === 'EQUIPMENT'));
  assert.ok(items.every((x) => x.visible === true));

  assert.equal(seedDefaultWidgets(ctx.db), false, 'bảng đã có dữ liệu -> không seed lại');
  assert.equal(count('dashboard_widgets'), 9);
});

// ------------------ PHÂN QUYỀN ------------------
test('chưa đăng nhập -> 401 cho mọi route dashboard widgets', async () => {
  for (const [m, p] of [['GET', '/widgets'], ['GET', '/widgets-data'], ['GET', '/widgets-meta'], ['POST', '/widgets'],
    ['PUT', '/widgets/x'], ['DELETE', '/widgets/x'], ['PUT', '/widgets-order'], ['POST', '/widgets-reset']]) {
    assert.equal((await api(m, `/api/dashboard${p}`, null, m === 'GET' || m === 'DELETE' ? undefined : {})).status, 401, `${m} ${p}`);
  }
});

test('STAFF/MANAGER đọc được widgets + widgets-data; ghi/meta/order/reset -> 403; ADMIN làm được', async () => {
  for (const who of ['staff', 'manager']) {
    assert.equal((await api('GET', '/api/dashboard/widgets', who)).status, 200, who);
    assert.equal((await api('GET', '/api/dashboard/widgets-data', who)).status, 200, who);
    assert.equal((await api('GET', '/api/dashboard/widgets-meta', who)).status, 403, who);
    assert.equal((await api('POST', '/api/dashboard/widgets', who, { title: 'x', source: 'EQUIPMENT', group_by: 'status', chart_type: 'BAR' })).status, 403);
    assert.equal((await api('PUT', '/api/dashboard/widgets/x', who, { title: 'y' })).status, 403);
    assert.equal((await api('DELETE', '/api/dashboard/widgets/x', who)).status, 403);
    assert.equal((await api('PUT', '/api/dashboard/widgets-order', who, { ids: [] })).status, 403);
    assert.equal((await api('POST', '/api/dashboard/widgets-reset', who)).status, 403);
  }
  const r = await api('POST', '/api/dashboard/widgets', 'staff', { title: 'x', source: 'EQUIPMENT', group_by: 'status', chart_type: 'BAR' });
  assert.match(r.body.error, /ADMIN/);
  assert.equal(count('dashboard_widgets'), 9, 'các lần ghi bị 403 không để lại gì');

  assert.equal((await admin('GET', '/api/dashboard/widgets-meta')).status, 200);
});

test('STAFF/MANAGER chỉ thấy ô visible; ADMIN thấy tất cả kèm cờ visible', async () => {
  const items = (await admin('GET', '/api/dashboard/widgets')).body.items;
  const hide = items.find((x) => x.system_key === 'IT_WARNINGS');
  const hideChart = items.find((x) => x.group_by === 'brand');
  assert.equal((await admin('PUT', `/api/dashboard/widgets/${hide.id}`, { visible: false })).status, 200);
  assert.equal((await admin('PUT', `/api/dashboard/widgets/${hideChart.id}`, { visible: false })).status, 200);

  const adminList = (await admin('GET', '/api/dashboard/widgets')).body.items;
  assert.equal(adminList.length, 9);
  assert.equal(adminList.find((x) => x.id === hide.id).visible, false);
  for (const who of ['staff', 'manager']) {
    const list = (await api('GET', '/api/dashboard/widgets', who)).body.items;
    assert.equal(list.length, 7, who);
    assert.ok(!list.some((x) => x.id === hide.id || x.id === hideChart.id));
    const data = (await api('GET', '/api/dashboard/widgets-data', who)).body;
    assert.ok(!(hideChart.id in data), 'ô CHART ẩn không có trong widgets-data');
  }
  await admin('POST', '/api/dashboard/widgets-reset');
});

// ------------------ SỐ LIỆU ------------------
test('EQUIPMENT: device_type / brand / model / status / commune đếm đúng, bỏ qua xoá mềm, NULL/rỗng -> "Chưa xác định"', () => {
  assert.equal(calc({ source: 'EQUIPMENT', group_by: 'device_type' }).total, 7);
  assert.deepEqual(asMap(calc({ source: 'EQUIPMENT', group_by: 'device_type' })), { 'Máy Test': 4, 'Máy in': 3 });
  assert.deepEqual(asMap(calc({ source: 'EQUIPMENT', group_by: 'brand' })), { Dell: 3, HP: 2, 'Chưa xác định': 2 });
  assert.deepEqual(asMap(calc({ source: 'EQUIPMENT', group_by: 'model' })), { Optiplex: 2, Latitude: 1, 'Chưa xác định': 4 });
  assert.deepEqual(asMap(calc({ source: 'EQUIPMENT', group_by: 'status' })),
    { 'Đang sử dụng': 3, 'Hỏng': 1, 'Trong kho': 1, 'Bảo trì': 1, 'Thanh lý': 1 });
  assert.deepEqual(asMap(calc({ source: 'EQUIPMENT', group_by: 'commune' })), { 'BĐX Test': 4, 'BĐX Hai': 3 });
  assert.deepEqual(asMap(calc({ source: 'EQUIPMENT', group_by: 'post_office' })), { 'Bưu cục Test': 4, 'Bưu cục Hai': 3 });
  assert.deepEqual(asMap(calc({ source: 'EQUIPMENT', group_by: 'new_ward' })), { 'Chưa xác định': 4, 'Phường A': 3 });
});

test('EQUIPMENT: sắp xếp mặc định theo số lượng giảm dần', () => {
  const r = calc({ source: 'EQUIPMENT', group_by: 'brand' });
  assert.deepEqual(r.items.map((x) => x.count), [3, 2, 2]);
  assert.equal(r.items[0].label, 'Dell');
});

test('EQUIPMENT: purchase_year / age_bucket (0, NULL -> "Chưa xác định"; xoá mềm bị bỏ)', () => {
  assert.deepEqual(asMap(calc({ source: 'EQUIPMENT', group_by: 'purchase_year' })),
    { 2014: 1, 2016: 1, 2019: 1, 2020: 1, 2023: 1, 'Chưa xác định': 2 });
  assert.deepEqual(asMap(calc({ source: 'EQUIPMENT', group_by: 'age_bucket' })),
    { 'Trước 2015': 1, '2015–2018': 1, '2019–2021': 2, '2022 trở lại': 1, 'Chưa xác định': 2 });
});

test('EQUIPMENT: trường specs (os/ram/cpu), JSON hỏng không làm lỗi truy vấn; has_ip / has_mac', () => {
  assert.deepEqual(asMap(calc({ source: 'EQUIPMENT', group_by: 'os' })), { 'Windows 10': 2, 'Windows 7': 1, 'Chưa xác định': 4 });
  assert.deepEqual(asMap(calc({ source: 'EQUIPMENT', group_by: 'ram' })), { '4GB': 1, '8GB': 1, 'Chưa xác định': 5 });
  assert.deepEqual(asMap(calc({ source: 'EQUIPMENT', group_by: 'cpu' })), { i3: 1, 'Chưa xác định': 6 });
  assert.deepEqual(asMap(calc({ source: 'EQUIPMENT', group_by: 'storage' })), { 'Chưa xác định': 7 });
  assert.deepEqual(asMap(calc({ source: 'EQUIPMENT', group_by: 'category_raw' })), { 'Chưa xác định': 7 });
  assert.deepEqual(asMap(calc({ source: 'EQUIPMENT', group_by: 'has_ip' })), { 'Có IP': 4, 'Chưa có IP': 3 });
  assert.deepEqual(asMap(calc({ source: 'EQUIPMENT', group_by: 'has_mac' })), { 'Có MAC': 3, 'Chưa có MAC': 4 });
});

test('top_n gộp phần còn lại thành "other"; total vẫn là tổng', () => {
  const r = calc({ source: 'EQUIPMENT', group_by: 'purchase_year', top_n: 3 });
  assert.equal(r.items.length, 3);
  assert.equal(r.items[0].label, 'Chưa xác định');
  assert.equal(r.other, 3);
  assert.equal(r.total, 7);
  assert.equal(r.items.reduce((s, x) => s + x.count, 0) + r.other, 7);
  assert.equal(calc({ source: 'EQUIPMENT', group_by: 'purchase_year', top_n: 10 }).other, undefined, 'đủ chỗ thì không có other');
});

test('LINE: theo thứ tự tự nhiên (không theo số lượng), "Chưa xác định" cuối, không áp top_n', () => {
  const y = calc({ source: 'EQUIPMENT', group_by: 'purchase_year', chart_type: 'LINE', top_n: 3 });
  assert.deepEqual(y.items.map((x) => x.label), ['2014', '2016', '2019', '2020', '2023', 'Chưa xác định']);
  assert.equal(y.other, undefined);
  const a = calc({ source: 'EQUIPMENT', group_by: 'age_bucket', chart_type: 'LINE' });
  assert.deepEqual(a.items.map((x) => x.label), ['Trước 2015', '2015–2018', '2019–2021', '2022 trở lại', 'Chưa xác định']);
});

test('NUMBER (group_by = null): một con số tổng, có áp bộ lọc', () => {
  assert.deepEqual(calc({ source: 'EQUIPMENT', group_by: null, chart_type: 'NUMBER' }), { total: 7, items: [] });
  assert.equal(calc({ source: 'EQUIPMENT', group_by: null, chart_type: 'NUMBER', filters: { status: ['BROKEN'] } }).total, 1);
});

test('bộ lọc EQUIPMENT: hoạt động riêng lẻ và kết hợp', () => {
  const g = (filters) => calc({ source: 'EQUIPMENT', group_by: null, chart_type: 'NUMBER', filters }).total;
  assert.equal(g({ status: ['IN_USE'] }), 3);
  assert.equal(g({ status: ['IN_USE', 'BROKEN'] }), 4);
  assert.equal(g({ device_type_id: [org.printerId] }), 3);
  assert.equal(g({ commune_id: [c2] }), 3);
  assert.equal(g({ purchase_year_from: 2016, purchase_year_to: 2020 }), 3);
  assert.equal(g({ purchase_year_from: 2020 }), 2);
  assert.equal(g({ status: ['IN_USE', 'BROKEN'], commune_id: [org.communeId] }), 3);
  assert.equal(g({ commune_id: [c2], purchase_year_from: 2016 }), 1);
  assert.equal(g({ status: ['LIQUIDATED'], commune_id: [org.communeId] }), 0);
  // bộ lọc + nhóm
  assert.deepEqual(asMap(calc({ source: 'EQUIPMENT', group_by: 'brand', filters: { commune_id: [org.communeId], status: ['IN_USE'] } })), { Dell: 3 });
});

test('EMAIL: kind / state / commune / created_month / created_year + bộ lọc', () => {
  assert.deepEqual(asMap(calc({ source: 'EMAIL', group_by: 'kind' })), { 'Đơn vị': 2, 'Cá nhân': 2 });
  assert.deepEqual(asMap(calc({ source: 'EMAIL', group_by: 'state' })), { 'Đang sử dụng': 3, 'Đã thu hồi': 1 });
  assert.deepEqual(asMap(calc({ source: 'EMAIL', group_by: 'commune' })), { 'BĐX Test': 2, 'BĐX Hai': 1, 'Chưa xác định': 1 });
  assert.deepEqual(asMap(calc({ source: 'EMAIL', group_by: 'post_office' })), { 'Bưu cục Test': 1, 'Bưu cục Hai': 1, 'Chưa xác định': 2 });
  assert.deepEqual(asMap(calc({ source: 'EMAIL', group_by: 'created_month' })), { '2024-03': 2, '2025-01': 1, 'Chưa xác định': 1 });
  assert.deepEqual(asMap(calc({ source: 'EMAIL', group_by: 'created_year' })), { 2024: 2, 2025: 1, 'Chưa xác định': 1 });
  const g = (filters) => calc({ source: 'EMAIL', group_by: null, chart_type: 'NUMBER', filters }).total;
  assert.equal(g({ kind: 'PERSONAL' }), 2);
  assert.equal(g({ state: 'REVOKED' }), 1);
  assert.equal(g({ commune_id: [org.communeId] }), 2);
  assert.equal(g({ kind: 'PERSONAL', state: 'ACTIVE' }), 1);
  assert.equal(g({ kind: 'UNIT', commune_id: [org.communeId], state: 'ACTIVE' }), 1);
});

test('POST_OFFICE: type / tình trạng / BĐX / phường mới / có máy / toạ độ + bộ lọc', () => {
  assert.deepEqual(asMap(calc({ source: 'POST_OFFICE', group_by: 'type' })), { GD3: 1, VHX: 1 });
  assert.deepEqual(asMap(calc({ source: 'POST_OFFICE', group_by: 'operational_status' })), { 'Hoạt động': 1, 'Ngừng hoạt động': 1 });
  assert.deepEqual(asMap(calc({ source: 'POST_OFFICE', group_by: 'commune' })), { 'BĐX Test': 1, 'BĐX Hai': 1 });
  assert.deepEqual(asMap(calc({ source: 'POST_OFFICE', group_by: 'new_ward' })), { 'Phường A': 1, 'Chưa xác định': 1 });
  assert.deepEqual(asMap(calc({ source: 'POST_OFFICE', group_by: 'has_computer' })), { 'Có máy': 1, 'Không có máy': 1 });
  assert.deepEqual(asMap(calc({ source: 'POST_OFFICE', group_by: 'has_coordinates' })), { 'Có tọa độ': 1, 'Chưa có tọa độ': 1 });
  const g = (filters) => calc({ source: 'POST_OFFICE', group_by: null, chart_type: 'NUMBER', filters }).total;
  assert.equal(g({ commune_id: [c2] }), 1);
  assert.equal(g({ operational_status: ['INACTIVE'] }), 1);
  assert.equal(g({ operational_status: ['ACTIVE', 'INACTIVE'], commune_id: [c2] }), 1);
  assert.equal(g({ operational_status: ['ACTIVE'], commune_id: [c2] }), 0);
});

// ------------------ API: CRUD + widgets-data ------------------
test('widgets-data qua API: ô mặc định commune BAR, device_type DONUT, status LIST có số liệu đúng', async () => {
  await admin('POST', '/api/dashboard/widgets-reset');
  const items = (await admin('GET', '/api/dashboard/widgets')).body.items;
  const data = (await api('GET', '/api/dashboard/widgets-data', 'staff')).body;
  const byGroup = (g) => items.find((x) => x.group_by === g);
  const chartIds = items.filter((x) => x.kind === 'CHART').map((x) => x.id);
  assert.deepEqual(Object.keys(data).sort(), [...chartIds].sort(), 'chỉ ô CHART, không có ô SYSTEM');
  assert.deepEqual(asMap(data[byGroup('commune').id]), { 'BĐX Test': 4, 'BĐX Hai': 3 });
  assert.equal(data[byGroup('device_type').id].total, 7);
  assert.deepEqual(asMap(data[byGroup('device_type').id]), { 'Máy Test': 4, 'Máy in': 3 });
  assert.equal(asMap(data[byGroup('status').id])['Đang sử dụng'], 3);
  assert.deepEqual(asMap(data[byGroup('brand').id]), { Dell: 3, HP: 2, 'Chưa xác định': 2 });
});

test('widgets-data: lỗi 1 ô không làm hỏng cả response', async () => {
  const items = (await admin('GET', '/api/dashboard/widgets')).body.items;
  const target = items.find((x) => x.group_by === 'brand');
  ctx.db.prepare("UPDATE dashboard_widgets SET source = 'KHONG_CO' WHERE id = ?").run(target.id);
  const r = await api('GET', '/api/dashboard/widgets-data', 'staff');
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.body[target.id]), ['error']);
  assert.ok(!/SELECT|FROM|KHONG_CO/i.test(JSON.stringify(r.body[target.id])), 'không lộ chi tiết nội bộ');
  const ok = items.find((x) => x.group_by === 'status');
  assert.ok(r.body[ok.id].items.length > 0);
  await admin('POST', '/api/dashboard/widgets-reset');
});

test('POST tạo ô CHART: position cuối, mặc định size M / top_n 10, lưu bộ lọc; widgets-meta trả whitelist', async () => {
  const r = await admin('POST', '/api/dashboard/widgets', {
    title: '  Hỏng theo BĐX ', source: 'EQUIPMENT', group_by: 'commune', chart_type: 'BAR_H',
    filters: { status: ['BROKEN', 'MAINTENANCE'] }
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.item.title, 'Hỏng theo BĐX');
  assert.equal(r.body.item.kind, 'CHART');
  assert.equal(r.body.item.position, 10);
  assert.equal(r.body.item.size, 'M');
  assert.equal(r.body.item.top_n, 10);
  assert.equal(r.body.item.system_key, null);
  assert.deepEqual(r.body.item.filters, { status: ['BROKEN', 'MAINTENANCE'] });
  const data = (await api('GET', '/api/dashboard/widgets-data', 'manager')).body;
  assert.deepEqual(asMap(data[r.body.item.id]), { 'BĐX Hai': 1, 'BĐX Test': 1 });

  const meta = (await admin('GET', '/api/dashboard/widgets-meta')).body;
  assert.deepEqual(meta.sources.map((s) => s.key), ['EQUIPMENT', 'EMAIL', 'POST_OFFICE']);
  const eq = meta.sources.find((s) => s.key === 'EQUIPMENT');
  const py = eq.fields.find((f) => f.key === 'purchase_year');
  assert.equal(py.ordered, true);
  assert.ok(py.chartTypes.includes('LINE'));
  assert.ok(!eq.fields.find((f) => f.key === 'brand').chartTypes.includes('LINE'));
  assert.ok(!py.chartTypes.includes('NUMBER'));
  assert.deepEqual(eq.filters.find((f) => f.key === 'status').options.map((o) => o.value), ['IN_USE', 'IN_STOCK', 'MAINTENANCE', 'BROKEN', 'LIQUIDATED']);
  assert.ok(eq.filters.find((f) => f.key === 'commune_id').options.some((o) => o.label === 'BĐX Hai'));
  assert.deepEqual(meta.chartTypes, ['BAR', 'BAR_H', 'DONUT', 'LINE', 'LIST', 'TABLE', 'NUMBER']);
  await admin('POST', '/api/dashboard/widgets-reset');
});

test('PUT ô CHART: sửa cấu hình, validate lại toàn bộ; đổi nguồn mà giữ group_by cũ -> 400', async () => {
  const w = (await admin('POST', '/api/dashboard/widgets', { title: 'A', source: 'EQUIPMENT', group_by: 'brand', chart_type: 'LIST' })).body.item;
  const r = await admin('PUT', `/api/dashboard/widgets/${w.id}`, { title: 'B', chart_type: 'DONUT', top_n: 4, size: 'L', filters: { status: ['IN_USE'] }, visible: false });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.item.title, r.body.item.chart_type, r.body.item.top_n, r.body.item.size, r.body.item.visible], ['B', 'DONUT', 4, 'L', false]);
  assert.equal(r.body.item.position, w.position, 'PUT không đổi vị trí');

  assert.equal((await admin('PUT', `/api/dashboard/widgets/${w.id}`, { source: 'EMAIL' })).status, 400, 'group_by "brand" không thuộc EMAIL');
  const ok = await admin('PUT', `/api/dashboard/widgets/${w.id}`, { source: 'EMAIL', group_by: 'kind', filters: {} });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.item.source, 'EMAIL');
  assert.equal((await admin('PUT', '/api/dashboard/widgets/khong-co', { title: 'x' })).status, 404);
  await admin('POST', '/api/dashboard/widgets-reset');
});

test('ô SYSTEM: chỉ đổi title/size/visible; key khác bị BỎ QUA; không xoá được', async () => {
  const sys = (await admin('GET', '/api/dashboard/widgets')).body.items.find((x) => x.system_key === 'UPGRADE');
  const r = await admin('PUT', `/api/dashboard/widgets/${sys.id}`, {
    title: 'Nâng cấp', size: 'FULL', visible: false,
    source: 'EMAIL', group_by: 'kind', chart_type: 'DONUT', top_n: 3, filters: { kind: 'UNIT' }, position: 99, system_key: 'HACK', kind: 'CHART'
  });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.item.title, r.body.item.size, r.body.item.visible], ['Nâng cấp', 'FULL', false]);
  assert.deepEqual([r.body.item.kind, r.body.item.system_key, r.body.item.source, r.body.item.group_by, r.body.item.chart_type, r.body.item.position],
    ['SYSTEM', 'UPGRADE', null, null, null, sys.position], 'các trường khác không đổi');
  assert.equal((await admin('PUT', `/api/dashboard/widgets/${sys.id}`, { size: 'HUGE' })).status, 400);
  assert.equal((await admin('PUT', `/api/dashboard/widgets/${sys.id}`, { title: '' })).status, 400);

  const del = await admin('DELETE', `/api/dashboard/widgets/${sys.id}`);
  assert.equal(del.status, 400);
  assert.match(del.body.error, /ẩn/);
  assert.equal(count('dashboard_widgets'), 9);
  await admin('POST', '/api/dashboard/widgets-reset');
});

test('DELETE ô CHART; id không có -> 404', async () => {
  const w = (await admin('POST', '/api/dashboard/widgets', { title: 'Xoá', source: 'POST_OFFICE', group_by: 'type', chart_type: 'BAR' })).body.item;
  assert.equal(count('dashboard_widgets'), 10);
  assert.equal((await admin('DELETE', `/api/dashboard/widgets/${w.id}`)).status, 200);
  assert.equal(count('dashboard_widgets'), 9);
  assert.equal((await admin('DELETE', `/api/dashboard/widgets/${w.id}`)).status, 404);
});

test('widgets-order: đúng tập id -> cập nhật position; thiếu/thừa/trùng/lạ -> 400', async () => {
  const items = (await admin('GET', '/api/dashboard/widgets')).body.items;
  const ids = items.map((x) => x.id);
  const reversed = [...ids].reverse();
  const ok = await admin('PUT', '/api/dashboard/widgets-order', { ids: reversed });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body.items.map((x) => x.id), reversed);
  assert.deepEqual((await admin('GET', '/api/dashboard/widgets')).body.items.map((x) => x.position), [1, 2, 3, 4, 5, 6, 7, 8, 9]);

  for (const bad of [ids.slice(1), [...ids, 'khong-co'], [...ids.slice(1), ids[1]], ids.map((x, i) => (i === 0 ? 'khong-co' : x)), 'abc', [1, 2]]) {
    assert.equal((await admin('PUT', '/api/dashboard/widgets-order', { ids: bad })).status, 400);
  }
  assert.deepEqual((await admin('GET', '/api/dashboard/widgets')).body.items.map((x) => x.id), reversed, 'lỗi thì thứ tự giữ nguyên');
  await admin('POST', '/api/dashboard/widgets-reset');
});

test('widgets-reset: xoá cấu hình, seed lại đúng 9 ô mặc định', async () => {
  await admin('POST', '/api/dashboard/widgets', { title: 'Tạm', source: 'EMAIL', group_by: 'kind', chart_type: 'DONUT' });
  const sys = (await admin('GET', '/api/dashboard/widgets')).body.items.find((x) => x.system_key === 'KPI_SUMMARY');
  await admin('PUT', `/api/dashboard/widgets/${sys.id}`, { title: 'Đổi tên', visible: false });
  const r = await admin('POST', '/api/dashboard/widgets-reset');
  assert.equal(r.status, 200);
  assert.equal(r.body.items.length, 9);
  assert.equal(count('dashboard_widgets'), 9);
  const kpi = r.body.items.find((x) => x.system_key === 'KPI_SUMMARY');
  assert.equal(kpi.title, 'Tổng quan');
  assert.equal(kpi.visible, true);
  assert.equal(r.body.items.filter((x) => x.title === 'Tạm').length, 0);
});

// ------------------ VALIDATE ------------------
const base = () => ({ title: 'Kiểm thử', source: 'EQUIPMENT', group_by: 'status', chart_type: 'BAR' });
const post = (over) => admin('POST', '/api/dashboard/widgets', { ...base(), ...over });

test('validate: khóa lạ (nguồn, group_by, chart_type, bộ lọc, size) -> 400 tiếng Việt, nêu rõ trường', async () => {
  const cases = [
    [{ source: 'USERS' }, /source/],
    [{ source: undefined }, /source/],
    [{ group_by: 'password_hash' }, /group_by/],
    [{ group_by: 'hrm_code', source: 'EMAIL' }, /group_by/],
    [{ chart_type: 'PIE' }, /chart_type/],
    [{ filters: { password: ['x'] } }, /password/],
    [{ filters: { status: ['KHONG_CO'] } }, /status/],
    [{ filters: { status: 'BROKEN' } }, /status/],
    [{ filters: { purchase_year_from: 'abc' } }, /purchase_year_from/],
    [{ filters: [] }, /filters/],
    [{ size: 'HUGE' }, /size/]
  ];
  for (const [over, re] of cases) {
    const r = await post(over);
    assert.equal(r.status, 400, JSON.stringify(over));
    assert.match(r.body.error, re, JSON.stringify(over));
  }
  assert.equal(count('dashboard_widgets'), 9);
});

test('validate: LINE chỉ cho trường có thứ tự; NUMBER bắt buộc group_by = null; loại khác bắt buộc group_by', async () => {
  assert.equal((await post({ chart_type: 'LINE', group_by: 'brand' })).status, 400);
  assert.equal((await post({ chart_type: 'LINE', group_by: 'status' })).status, 400);
  for (const [src, f] of [['EQUIPMENT', 'purchase_year'], ['EQUIPMENT', 'age_bucket'], ['EMAIL', 'created_month'], ['EMAIL', 'created_year']]) {
    const r = await post({ chart_type: 'LINE', source: src, group_by: f });
    assert.equal(r.status, 201, `${src}.${f}`);
    await admin('DELETE', `/api/dashboard/widgets/${r.body.item.id}`);
  }
  assert.equal((await post({ chart_type: 'NUMBER', group_by: 'status' })).status, 400);
  const num = await post({ chart_type: 'NUMBER', group_by: null });
  assert.equal(num.status, 201);
  await admin('DELETE', `/api/dashboard/widgets/${num.body.item.id}`);
  for (const t of ['BAR', 'BAR_H', 'DONUT', 'LIST', 'TABLE']) {
    assert.equal((await post({ chart_type: t, group_by: null })).status, 400, t);
  }
});

test('validate: top_n ngoài 3..30; title rỗng/quá dài; vượt 30 ô', async () => {
  for (const n of [2, 31, 0, -1, 5.5, 'abc']) assert.equal((await post({ top_n: n })).status, 400, `top_n=${n}`);
  for (const n of [3, 30]) {
    const r = await post({ top_n: n });
    assert.equal(r.status, 201, `top_n=${n}`);
    await admin('DELETE', `/api/dashboard/widgets/${r.body.item.id}`);
  }
  assert.equal((await post({ title: '' })).status, 400);
  assert.equal((await post({ title: '   ' })).status, 400);
  assert.equal((await post({ title: undefined })).status, 400);
  assert.equal((await post({ title: 'x'.repeat(81) })).status, 400);
  const ok80 = await post({ title: 'x'.repeat(80) });
  assert.equal(ok80.status, 201);
  await admin('DELETE', `/api/dashboard/widgets/${ok80.body.item.id}`);

  // đạt trần 30 ô
  for (let i = count('dashboard_widgets'); i < 30; i++) assert.equal((await post({ title: `Ô ${i}` })).status, 201);
  assert.equal(count('dashboard_widgets'), 30);
  const over = await post({ title: 'Ô thứ 31' });
  assert.equal(over.status, 400);
  assert.match(over.body.error, /30/);
  await admin('POST', '/api/dashboard/widgets-reset');
});

// ------------------ CHỐNG CHÈN SQL ------------------
test('chống chèn SQL: group_by / bộ lọc / title chứa mã độc không phá DB, không đổi kết quả', async () => {
  const evil = "'; DROP TABLE equipments; --";
  const evil2 = '" OR 1=1';
  const equipBefore = count('equipments');
  const widgetsBefore = count('dashboard_widgets');
  const totalBefore = calc({ source: 'EQUIPMENT', group_by: null, chart_type: 'NUMBER' }).total;

  // group_by / source / chart_type độc hại -> 400
  for (const over of [{ group_by: evil }, { group_by: evil2 }, { source: evil }, { chart_type: evil }, { size: evil },
    { filters: { [evil]: ['x'] } }, { filters: { [evil2]: ['x'] } }, { filters: { status: [evil] } }, { filters: { status: [evil2] } },
    { filters: { purchase_year_from: evil } }]) {
    const r = await post(over);
    assert.equal(r.status, 400, JSON.stringify(over));
    assert.ok(!/DROP|SELECT|sqlite/i.test(r.body.error.replace(/DROP TABLE equipments/g, '')), 'không lộ SQL');
  }

  // giá trị lọc dạng id là chuỗi tự do -> chỉ là giá trị tham số (không khớp gì), KHÔNG biến thành "OR 1=1"
  const filtered = await post({ group_by: null, chart_type: 'NUMBER', filters: { commune_id: [evil, evil2, "x' OR 1=1 --"] } });
  assert.equal(filtered.status, 201);
  const data = (await api('GET', '/api/dashboard/widgets-data', 'staff')).body;
  assert.equal(data[filtered.body.item.id].total, 0, 'không khớp bản ghi nào, không bị "OR 1=1"');

  // title chứa mã độc: lưu và trả lại như văn bản thường
  const titled = await post({ title: evil });
  assert.equal(titled.status, 201);
  assert.equal(titled.body.item.title, evil);
  const titled2 = await post({ title: evil2 });
  assert.equal(titled2.status, 201);
  assert.equal(titled2.body.item.title, evil2);

  // PUT cũng không chèn được
  const put = await admin('PUT', `/api/dashboard/widgets/${titled.body.item.id}`, { group_by: evil });
  assert.equal(put.status, 400);

  assert.equal(count('equipments'), equipBefore, 'bảng equipments còn nguyên');
  assert.equal(count('dashboard_widgets'), widgetsBefore + 3);
  assert.equal(calc({ source: 'EQUIPMENT', group_by: null, chart_type: 'NUMBER' }).total, totalBefore);
  await admin('POST', '/api/dashboard/widgets-reset');
});

test('GET /api/dashboard/stats cũ vẫn trả đủ field như trước', async () => {
  const r = await api('GET', '/api/dashboard/stats', 'staff');
  assert.equal(r.status, 200);
  for (const k of ['summary', 'charts', 'warnings', 'upgrade', 'recentActivity', 'emails']) assert.ok(k in r.body, k);
  assert.equal(r.body.summary.totalAssets, 7);
});

// ------------------ PREVIEW + include_hidden ------------------
test('widgets-preview: 401 chưa đăng nhập, 403 STAFF/MANAGER, 200 ADMIN', async () => {
  const cfg = { title: 'Xem trước', source: 'EQUIPMENT', group_by: 'status', chart_type: 'BAR' };
  assert.equal((await api('POST', '/api/dashboard/widgets-preview', null, cfg)).status, 401);
  for (const who of ['staff', 'manager']) {
    const r = await api('POST', '/api/dashboard/widgets-preview', who, cfg);
    assert.equal(r.status, 403, who);
    assert.match(r.body.error, /ADMIN/);
  }
  const ok = await admin('POST', '/api/dashboard/widgets-preview', cfg);
  assert.equal(ok.status, 200);
  assert.deepEqual(Object.keys(ok.body), ['data']);
  assert.equal(ok.body.data.total, 7);
});

test('widgets-preview: số liệu khớp ô lưu cùng cấu hình; không ghi DB', async () => {
  await admin('POST', '/api/dashboard/widgets-reset');
  const cfg = {
    title: 'Hỏng/bảo trì theo BĐX', source: 'EQUIPMENT', group_by: 'purchase_year', chart_type: 'BAR', top_n: 3,
    filters: { commune_id: [org.communeId], purchase_year_from: 2010 }, size: 'L'
  };
  const before = count('dashboard_widgets');
  const prev = await admin('POST', '/api/dashboard/widgets-preview', cfg);
  assert.equal(prev.status, 200, JSON.stringify(prev.body));
  assert.equal(count('dashboard_widgets'), before, 'preview không tạo dòng nào');

  const saved = await admin('POST', '/api/dashboard/widgets', cfg);
  assert.equal(saved.status, 201);
  const data = (await admin('GET', '/api/dashboard/widgets-data')).body;
  assert.deepEqual(data[saved.body.item.id], prev.body.data, 'cùng cấu hình -> cùng số liệu');
  assert.equal(prev.body.data.other !== undefined, true, 'top_n 3 gộp phần còn lại vào other');

  // NUMBER không group_by + bộ lọc cũng dùng được
  const num = await admin('POST', '/api/dashboard/widgets-preview', { title: 'Tổng', source: 'EMAIL', group_by: null, chart_type: 'NUMBER', filters: { kind: 'PERSONAL' } });
  assert.deepEqual(num.body.data, { total: 2, items: [] });
  await admin('POST', '/api/dashboard/widgets-reset');
});

test('widgets-preview: cấu hình sai -> 400 tiếng Việt; payload chèn SQL -> 400, bảng còn nguyên', async () => {
  const equipBefore = count('equipments');
  const widgetsBefore = count('dashboard_widgets');
  const cases = [
    { title: 'x', source: 'USERS', group_by: 'status', chart_type: 'BAR' },
    { title: 'x', source: 'EQUIPMENT', group_by: 'x; DROP TABLE equipments', chart_type: 'BAR' },
    { title: 'x', source: 'EQUIPMENT', group_by: 'status', chart_type: 'PIE' },
    { title: 'x', source: 'EQUIPMENT', group_by: 'brand', chart_type: 'LINE' },
    { title: 'x', source: 'EQUIPMENT', group_by: 'status', chart_type: 'NUMBER' },
    { title: 'x', source: 'EQUIPMENT', group_by: 'status', chart_type: 'BAR', top_n: 99 },
    { title: '', source: 'EQUIPMENT', group_by: 'status', chart_type: 'BAR' },
    { title: 'x', source: 'EQUIPMENT', group_by: 'status', chart_type: 'BAR', filters: { 'status; DROP TABLE equipments': ['IN_USE'] } },
    { title: 'x', source: 'EQUIPMENT', group_by: 'status', chart_type: 'BAR', filters: { status: ["IN_USE' OR 1=1 --"] } }
  ];
  for (const c of cases) {
    const r = await admin('POST', '/api/dashboard/widgets-preview', c);
    assert.equal(r.status, 400, JSON.stringify(c));
    assert.equal(typeof r.body.error, 'string');
  }
  assert.equal(count('equipments'), equipBefore);
  assert.equal(count('dashboard_widgets'), widgetsBefore);
});

test('widgets-data?include_hidden=1: ADMIN thấy cả ô CHART ẩn; MANAGER/STAFF bị bỏ qua tham số; không tham số = như cũ', async () => {
  await admin('POST', '/api/dashboard/widgets-reset');
  const items = (await admin('GET', '/api/dashboard/widgets')).body.items;
  const hidden = items.find((x) => x.group_by === 'brand');
  await admin('PUT', `/api/dashboard/widgets/${hidden.id}`, { visible: false });

  const adminHidden = (await admin('GET', '/api/dashboard/widgets-data?include_hidden=1')).body;
  assert.ok(hidden.id in adminHidden);
  assert.deepEqual(asMap(adminHidden[hidden.id]), { Dell: 3, HP: 2, 'Chưa xác định': 2 });
  assert.equal(Object.keys(adminHidden).length, 4);

  assert.ok(!(hidden.id in (await admin('GET', '/api/dashboard/widgets-data')).body), 'ADMIN không tham số: chỉ ô visible');
  for (const who of ['manager', 'staff']) {
    const withParam = (await api('GET', '/api/dashboard/widgets-data?include_hidden=1', who)).body;
    assert.ok(!(hidden.id in withParam), `${who} bỏ qua include_hidden`);
    assert.equal(Object.keys(withParam).length, 3);
  }
  await admin('POST', '/api/dashboard/widgets-reset');
});
