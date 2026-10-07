// ==========================================
// Test: GET /api/dashboard/stats (server/routes/dashboard.js) — các field mở rộng cho
// Dashboard mới + field cũ còn nguyên + chặn chưa đăng nhập / IP không hợp lệ.
// Seed dữ liệu có chủ đích trực tiếp vào DB tạm, rồi kiểm tra từng field.
// ==========================================
'use strict';
process.env.CMS_ALLOWED_IPS = '10.0.0.5';
process.env.TRUSTED_PROXIES = '127.0.0.1,::1';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, cleanupDbFiles, closeServer } = require('./helpers/serverHarness');
const { seedMinimalOrg, seedUser, uid } = require('./helpers/fixtures');

const PORT = 5909;
const OK_IP = '10.0.0.5';
const HRM = 'DASH_STAFF';
const PASS = 'Staff@123';

let ctx;
let org;
let token;

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function getStats(t = token, ip = OK_IP) {
  const headers = { 'X-Forwarded-For': ip };
  if (t) headers.Authorization = `Bearer ${t}`;
  return fetch(`${ctx.baseUrl}/api/dashboard/stats`, { headers });
}

let seq = 0;
function addEquip({ status = 'IN_USE', specs = {}, year = null, deleted = false, postOfficeId = org.postOfficeId, mac = 'AA:BB', ip = '10.1.1.1' } = {}) {
  const id = uid();
  seq++;
  ctx.db.prepare(`
    INSERT INTO equipments (id, asset_tag, hostname, ip_address, mac_address, device_type_id, specs, status, post_office_id, purchase_year, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, `DASH-${seq}`, `host-${seq}`, ip, mac, org.deviceTypeId, JSON.stringify(specs), status, postOfficeId, year,
    deleted ? '2024-01-01 00:00:00' : null);
  return id;
}

before(async () => {
  ctx = startTestServer({ port: PORT, dbFileName: `ccdc-test-dashboard-${Date.now()}.db` });
  for (let i = 0; i < 50; i++) {
    try { await fetch(`${ctx.baseUrl}/`); break; } catch (e) { await new Promise((r) => setTimeout(r, 100)); }
  }
  org = seedMinimalOrg(ctx.db);
  // STAFF cũng đọc được dashboard (chỉ cần đăng nhập)
  seedUser(ctx.db, { hrmCode: HRM, fullName: 'Dash Staff', role: 'STAFF', password: PASS });
  const res = await fetch(`${ctx.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': OK_IP },
    body: JSON.stringify({ hrm_code: HRM, password: PASS })
  });
  assert.equal(res.status, 200);
  token = (await res.json()).token;
});

after(async () => {
  await closeServer(ctx.server);
  cleanupDbFiles(ctx.testDbPath, ctx.db);
});

test('chưa đăng nhập -> 401; IP không hợp lệ -> 404 (không lộ hệ thống)', async () => {
  assert.equal((await getStats(null)).status, 401);
  const blocked = await getStats(token, '10.0.0.9');
  assert.equal(blocked.status, 404);
  assert.equal((await getStats()).status, 200);
});

test('DB trống: đủ cấu trúc mới, mọi số = 0, 5 trạng thái, 4 nhóm tuổi', async () => {
  const s = await (await getStats()).json();
  assert.equal(s.summary.totalAssets, 0);
  assert.equal(s.summary.brokenOrMaintenanceCount, 0);
  assert.equal(s.summary.inStockCount, 0);
  assert.deepEqual(s.charts.assetsByStatus.map((x) => x.status), ['IN_USE', 'IN_STOCK', 'MAINTENANCE', 'BROKEN', 'LIQUIDATED']);
  assert.ok(s.charts.assetsByStatus.every((x) => x.count === 0));
  assert.deepEqual(s.upgrade.byAge.map((x) => x.bucket), ['BEFORE_2015', 'Y2015_2018', 'Y2019_2021', 'Y2022_PLUS']);
  assert.deepEqual(s.recentActivity, []);
  assert.deepEqual(s.emails, { total: 0, active: 0, revoked: 0, unit: 0, personal: 0, createdThisMonth: 0 });
});

test('assetsByStatus + brokenOrMaintenance + inStock: đủ 5 trạng thái, bỏ qua thiết bị xoá mềm', async () => {
  addEquip({ status: 'IN_USE' });
  addEquip({ status: 'IN_USE' });
  addEquip({ status: 'IN_STOCK' });
  addEquip({ status: 'MAINTENANCE' });
  addEquip({ status: 'BROKEN' });
  addEquip({ status: 'BROKEN' });
  addEquip({ status: 'LIQUIDATED' });
  // đã xoá mềm: không được tính vào bất kỳ chỉ số nào
  addEquip({ status: 'BROKEN', deleted: true });
  addEquip({ status: 'IN_STOCK', deleted: true });

  const s = await (await getStats()).json();
  const by = Object.fromEntries(s.charts.assetsByStatus.map((x) => [x.status, x.count]));
  assert.deepEqual(by, { IN_USE: 2, IN_STOCK: 1, MAINTENANCE: 1, BROKEN: 2, LIQUIDATED: 1 });
  assert.equal(s.summary.brokenOrMaintenanceCount, 3);
  assert.equal(s.summary.inStockCount, 1);
  assert.equal(s.summary.totalAssets, 7);
  assert.equal(s.summary.activeAssets, 2);
});

test('upgrade.byAge: 4 nhóm theo purchase_year; thiết bị không năm chỉ vào missingPurchaseYear', async () => {
  ctx.db.prepare('DELETE FROM equipments').run();
  addEquip({ year: 2014 });
  addEquip({ year: 2015 });
  addEquip({ year: 2016 });
  addEquip({ year: 2018 });
  addEquip({ year: 2019 });
  addEquip({ year: 2020 });
  addEquip({ year: 2021 });
  addEquip({ year: 2022 });
  addEquip({ year: 2023 });
  addEquip({ year: null });
  addEquip({ year: 2010, deleted: true }); // xoá mềm: bỏ qua

  const s = await (await getStats()).json();
  const age = Object.fromEntries(s.upgrade.byAge.map((x) => [x.bucket, x.count]));
  assert.deepEqual(age, { BEFORE_2015: 1, Y2015_2018: 3, Y2019_2021: 3, Y2022_PLUS: 2 });
  assert.equal(s.upgrade.missingPurchaseYear, 1);
  const inBuckets = Object.values(age).reduce((a, b) => a + b, 0);
  assert.equal(inBuckets + s.upgrade.missingPurchaseYear, s.summary.totalAssets);
});

test('byAge: purchase_year = 0 / âm / quá xa trong tương lai tính là thiếu năm mua, không vào "Trước 2015"', async () => {
  ctx.db.prepare('DELETE FROM equipments').run();
  addEquip({ year: 0 });
  addEquip({ year: -5 });
  addEquip({ year: 1900 });
  addEquip({ year: new Date().getFullYear() + 5 });
  addEquip({ year: null });
  addEquip({ year: 2014 });
  addEquip({ year: 2015 });

  const s = await (await getStats()).json();
  const age = Object.fromEntries(s.upgrade.byAge.map((x) => [x.bucket, x.count]));
  assert.equal(s.upgrade.missingPurchaseYear, 5);
  assert.deepEqual(age, { BEFORE_2015: 1, Y2015_2018: 1, Y2019_2021: 0, Y2022_PLUS: 0 });
});

test('lowRam / hddOnly / lowSpecCount nhất quán với quy tắc cũ', async () => {
  ctx.db.prepare('DELETE FROM equipments').run();
  addEquip({ specs: { ram: '4GB', storage: 'SSD 256GB' } });          // lowRam
  addEquip({ specs: { ram: '2GB DDR2', storage: 'SSD' } }); // lowRam ('2gb')
  addEquip({ specs: { ram: '8GB', storage: 'HDD 500GB' } });          // hddOnly
  addEquip({ specs: { ram: '4GB', storage: 'HDD 1TB' } });            // cả hai
  addEquip({ specs: { ram: '8GB', storage: 'SSD 256GB + HDD 1TB' } }); // có SSD -> không hddOnly
  addEquip({ specs: { ram: '16GB', storage: 'SSD' } });               // đạt
  addEquip({ specs: {} });                                            // không có specs
  addEquip({ specs: { ram: '4GB', storage: 'HDD' }, deleted: true });  // xoá mềm

  const s = await (await getStats()).json();
  assert.equal(s.upgrade.lowRamCount, 3);
  assert.equal(s.upgrade.hddOnlyCount, 2);
  // quy tắc cũ: lowRam HOẶC hddOnly -> 4 máy (4GB-SSD, 2GB-SSD, 8GB-HDD, 4GB-HDD)
  assert.equal(s.summary.lowSpecCount, 4);
  assert.ok(s.summary.lowSpecCount >= Math.max(s.upgrade.lowRamCount, s.upgrade.hddOnlyCount));
  assert.equal(s.summary.lowSpecCount, s.upgrade.lowRamCount + s.upgrade.hddOnlyCount - 1, 'trừ 1 máy trùng cả hai');
});

test('recentActivity: tối đa 8, mới -> cũ, tên bưu cục đúng, thiết bị xoá mềm không làm hỏng', async () => {
  ctx.db.prepare('DELETE FROM asset_transfer_logs').run();
  ctx.db.prepare('DELETE FROM equipments').run();
  const po2 = uid();
  ctx.db.prepare('INSERT INTO post_offices (id, code, name, commune_id) VALUES (?, ?, ?, ?)').run(po2, 'DASHPO2', 'Bưu cục Hai', org.communeId);
  const live = addEquip({});
  const gone = addEquip({ deleted: true });

  const ins = ctx.db.prepare(`
    INSERT INTO asset_transfer_logs (id, equipment_id, action, from_post_office_id, to_post_office_id, reason, transferred_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (let i = 1; i <= 10; i++) {
    ins.run(`log-${pad(i)}`, live, 'UPDATE', null, null, `lý do ${i}`, `2024-03-${pad(i)} 10:00:00`);
  }
  // log đặc biệt mới nhất: chuyển bưu cục; thiết bị đã xoá mềm; tên bưu cục
  ins.run('log-zz-latest', gone, 'TRANSFER', org.postOfficeId, po2, 'chuyển kho', '2024-04-01 08:00:00');
  // cùng thời điểm với log-zz-latest: id lớn hơn đứng trước
  ins.run('log-zzz-tie', live, 'ASSIGN', null, po2, null, '2024-04-01 08:00:00');

  const res = await getStats();
  assert.equal(res.status, 200);
  const s = await res.json();
  assert.equal(s.recentActivity.length, 8);
  assert.equal(s.recentActivity[0].id, 'log-zzz-tie');
  assert.equal(s.recentActivity[1].id, 'log-zz-latest');
  assert.equal(s.recentActivity[2].id, 'log-10');
  const times = s.recentActivity.map((x) => x.at);
  assert.deepEqual(times, [...times].sort().reverse());

  const t = s.recentActivity[1];
  assert.equal(t.action, 'TRANSFER');
  assert.equal(t.fromPostOffice, 'Bưu cục Test');
  assert.equal(t.toPostOffice, 'Bưu cục Hai');
  assert.equal(t.reason, 'chuyển kho');
  assert.equal(t.at, '2024-04-01 08:00:00');
  assert.ok(t.assetTag && t.hostname, 'thiết bị xoá mềm vẫn trả asset_tag/hostname');

  const first = s.recentActivity[0];
  assert.equal(first.fromPostOffice, null);
  assert.equal(first.toPostOffice, 'Bưu cục Hai');
  assert.equal(first.reason, null);
  assert.deepEqual(Object.keys(first), ['id', 'action', 'assetTag', 'hostname', 'fromPostOffice', 'toPostOffice', 'reason', 'at']);
});

test('emails: tổng, active/revoked, unit/personal, createdThisMonth (tháng này vs tháng trước)', async () => {
  ctx.db.prepare('DELETE FROM emails').run();
  const now = new Date();
  const thisMonth = iso(new Date(now.getFullYear(), now.getMonth(), 1));
  const lastMonth = iso(new Date(now.getFullYear(), now.getMonth() - 1, 15));
  const ins = ctx.db.prepare('INSERT INTO emails (id, email, kind, hrm_code, full_name, created_date, revoked_date) VALUES (?, ?, ?, ?, ?, ?, ?)');
  ins.run(uid(), 'a@t.vn', 'UNIT', null, 'A', thisMonth, null);
  ins.run(uid(), 'b@t.vn', 'PERSONAL', 'H1', 'B', lastMonth, null);
  ins.run(uid(), 'c@t.vn', 'PERSONAL', 'H2', 'C', lastMonth, '2099-01-01');
  ins.run(uid(), 'd@t.vn', 'UNIT', null, 'D', null, null); // không có created_date

  const s = await (await getStats()).json();
  assert.deepEqual(s.emails, { total: 4, active: 3, revoked: 1, unit: 2, personal: 2, createdThisMonth: 1 });
});

test('field cũ còn nguyên và đúng (summary, charts, warnings)', async () => {
  ctx.db.prepare('DELETE FROM asset_transfer_logs').run();
  ctx.db.prepare('DELETE FROM equipments').run();
  addEquip({ specs: { os: 'Windows 7' }, mac: '', ip: '' });
  addEquip({ specs: { os: 'Windows 10' }, mac: 'UNKNOWN', ip: '10.9.9.9' });
  addEquip({ specs: { os: 'Windows 7' }, mac: 'AA', ip: '10.9.9.8', status: 'BROKEN' });

  const s = await (await getStats()).json();
  assert.equal(s.summary.totalAssets, 3);
  assert.equal(s.summary.activeAssets, 2);
  assert.equal(s.summary.totalCommunes, 1);
  assert.equal(s.summary.totalPostOffices, 2); // Bưu cục Test + DASHPO2 từ test trước
  assert.equal(s.summary.emptyPostOffices, 1);
  assert.equal(typeof s.summary.lowSpecCount, 'number');
  assert.equal(s.charts.assetsByCommune[0].assetCount, 3);
  assert.equal(s.charts.assetsByType.find((x) => x.code === org.deviceTypeCode).count, 3);
  assert.ok(Array.isArray(s.charts.assetsByBrand));
  assert.deepEqual(s.warnings, { missingMac: 2, missingIp: 1, win7Count: 2 });
});
