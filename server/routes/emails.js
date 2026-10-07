const express = require('express');
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const { authRequired, requireManager } = require('../auth');
const { normalizeStr } = require('../lib/helpers');

const router = express.Router();

// ==========================================
// EMAILS API (Quản lý email) — bảng `emails`.
// - Trạng thái KHÔNG lưu: revoked_date NULL = Đang sử dụng, có ngày = Đã thu hồi.
// - Không xoá cứng. Thu hồi / kích hoạt lại qua 2 route riêng.
// - Liên kết nhân sự LỎNG qua hrm_code (không FK sang users).
// - KHÔNG BAO GIỜ tự tạo Tỉnh/BĐX/Bưu cục (danh mục chuẩn, 04_DECISIONS #14);
//   chỉ có thể tự tạo NHÂN SỰ (bảng users, không mật khẩu) cho email cá nhân đang dùng.
// - Đọc: mọi tài khoản đăng nhập. Ghi/import/export: requireManager.
// ==========================================

const MAX_IMPORT_ERRORS = 100;
const EMAIL_REGEX = /^[a-z0-9._%+'-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/;

// ------------------------------------------
// Tiện ích
// ------------------------------------------
const isBlank = (v) => v === undefined || v === null || (typeof v === 'string' && !v.trim());
const str = (v) => (typeof v === 'string' ? v.trim() : v === undefined || v === null ? '' : String(v).trim());

function todayIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function isRealDate(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// Nhận dd/mm/yyyy hoặc yyyy-mm-dd; trả ISO yyyy-mm-dd, hoặc null nếu không hợp lệ.
function parseDateInput(v) {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  let y, m, d;
  let mt = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (mt) { y = +mt[1]; m = +mt[2]; d = +mt[3]; }
  else {
    mt = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!mt) return null;
    d = +mt[1]; m = +mt[2]; y = +mt[3];
  }
  if (!isRealDate(y, m, d)) return null;
  const p = (n) => String(n).padStart(2, '0');
  return `${y}-${p(m)}-${p(d)}`;
}

function isoToVn(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function normalizeEmail(v) {
  return typeof v === 'string' ? v.trim().toLowerCase() : '';
}

function parseKind(v) {
  const n = normalizeStr(String(v || ''));
  if (n === 'unit' || n === 'don vi') return 'UNIT';
  if (n === 'personal' || n === 'ca nhan') return 'PERSONAL';
  return null;
}

// Tra đơn vị theo id (API thủ công). Trả { commune_id, post_office_id } hoặc { error }.
function resolveUnitIds(communeId, postOfficeId) {
  let communeIdFinal = isBlank(communeId) ? null : String(communeId);
  let poIdFinal = isBlank(postOfficeId) ? null : String(postOfficeId);
  if (poIdFinal) {
    const po = db.prepare('SELECT id, commune_id FROM post_offices WHERE id = ?').get(poIdFinal);
    if (!po) return { error: 'Bưu cục không tồn tại' };
    if (communeIdFinal && communeIdFinal !== po.commune_id) return { error: 'Bưu cục không thuộc BĐX đã chọn' };
    communeIdFinal = po.commune_id;
  } else if (communeIdFinal) {
    if (!db.prepare('SELECT id FROM commune_post_offices WHERE id = ?').get(communeIdFinal)) {
      return { error: 'BĐX không tồn tại' };
    }
  }
  return { commune_id: communeIdFinal, post_office_id: poIdFinal };
}

// Tra đơn vị theo MÃ (import). Mã không tồn tại -> lỗi, KHÔNG tạo mới.
function resolveUnitCodes(maBdx, maBuuCuc) {
  if (maBuuCuc) {
    const po = db.prepare(`
      SELECT p.id, p.commune_id, c.code AS commune_code
      FROM post_offices p JOIN commune_post_offices c ON c.id = p.commune_id
      WHERE p.code = ?
    `).get(maBuuCuc);
    if (!po) return { error: `Mã bưu cục "${maBuuCuc}" không tồn tại trong Quản Lý Mạng Lưới` };
    if (maBdx && maBdx !== po.commune_code) {
      return { error: `Bưu cục "${maBuuCuc}" thuộc BĐX "${po.commune_code}", không khớp maBdx "${maBdx}"` };
    }
    return { commune_id: po.commune_id, post_office_id: po.id };
  }
  const c = db.prepare('SELECT id FROM commune_post_offices WHERE code = ?').get(maBdx);
  if (!c) return { error: `Mã BĐX "${maBdx}" không tồn tại trong Quản Lý Mạng Lưới` };
  return { commune_id: c.id, post_office_id: null };
}

// Kiểm tra bản ghi cuối cùng (đã gộp). Trả mảng thông báo lỗi (rỗng = hợp lệ).
function validateFinal(f) {
  const errs = [];
  if (!f.email) errs.push('Thiếu email');
  else if (f.email.length > 254 || !EMAIL_REGEX.test(f.email)) errs.push(`Email "${f.email}" sai định dạng`);
  if (f.kind !== 'UNIT' && f.kind !== 'PERSONAL') errs.push('Loại email phải là UNIT (Đơn vị) hoặc PERSONAL (Cá nhân)');
  if (f.kind === 'UNIT' && f.hrm_code) errs.push('Email đơn vị không được có mã HRM');
  if (f.kind === 'PERSONAL' && !f.hrm_code) errs.push('Email cá nhân bắt buộc có mã HRM');
  if (!f.full_name) errs.push('Thiếu họ tên / tên đơn vị');
  else if (f.full_name.length > 200) errs.push('Họ tên / tên đơn vị tối đa 200 ký tự');
  if (f.hrm_code && f.hrm_code.length > 50) errs.push('Mã HRM tối đa 50 ký tự');
  if (f.phone && f.phone.length > 30) errs.push('Số điện thoại tối đa 30 ký tự');
  if (f.job_title && f.job_title.length > 200) errs.push('Chức danh tối đa 200 ký tự');
  if (f.created_date && f.revoked_date && f.revoked_date < f.created_date) {
    errs.push('Ngày thu hồi không được trước ngày khởi tạo');
  }
  return errs;
}

// Tạo nhân sự (users) cho email cá nhân ĐANG DÙNG nếu HRM chưa có; HRM đã có thì giữ
// nguyên, lệch họ tên/đơn vị -> trả cảnh báo. Gọi bên trong transaction.
// Trả { created: boolean, warning: string|null }.
function ensurePersonnel(f) {
  if (f.kind !== 'PERSONAL' || f.revoked_date || !f.hrm_code) return { created: false, warning: null };
  const poRow = f.post_office_id ? db.prepare('SELECT code FROM post_offices WHERE id = ?').get(f.post_office_id) : null;
  const cRow = f.commune_id ? db.prepare('SELECT code FROM commune_post_offices WHERE id = ?').get(f.commune_id) : null;
  const poCode = poRow ? poRow.code : null;
  const communeCode = cRow ? cRow.code : null;

  const user = db.prepare('SELECT * FROM users WHERE hrm_code = ?').get(f.hrm_code);
  if (!user) {
    db.prepare(`
      INSERT INTO users (id, hrm_code, full_name, post_office_code, commune_code, post_office_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), f.hrm_code, f.full_name, poCode, communeCode, f.post_office_id || null);
    return { created: true, warning: null };
  }
  const diffs = [];
  if (normalizeStr(user.full_name || '') !== normalizeStr(f.full_name)) diffs.push(`họ tên ("${user.full_name}" ≠ "${f.full_name}")`);
  if ((poCode || communeCode) && ((user.post_office_code || null) !== poCode || (user.commune_code || null) !== communeCode)) {
    diffs.push('đơn vị');
  }
  return {
    created: false,
    warning: diffs.length ? `Mã HRM ${f.hrm_code} đã có trong nhân sự, giữ nguyên (khác ${diffs.join(', ')})` : null
  };
}

const SELECT_JOIN = `
  SELECT e.*,
         c.code AS commune_code, c.name AS commune_name,
         p.code AS post_office_code, p.name AS post_office_name
  FROM emails e
  LEFT JOIN commune_post_offices c ON c.id = e.commune_id
  LEFT JOIN post_offices p ON p.id = e.post_office_id
`;

function withStatus(r) {
  return { ...r, status: r.revoked_date ? 'REVOKED' : 'ACTIVE' };
}

// Danh sách đã lọc (dùng chung GET /emails và export-data).
function queryEmails(q) {
  const { search, kind, status, communeId, postOfficeId } = q;
  const where = ['1=1'];
  const params = [];
  if (kind === 'UNIT' || kind === 'PERSONAL') { where.push('e.kind = ?'); params.push(kind); }
  if (status === 'ACTIVE') where.push('e.revoked_date IS NULL');
  else if (status === 'REVOKED') where.push('e.revoked_date IS NOT NULL');
  if (communeId) { where.push('e.commune_id = ?'); params.push(communeId); }
  if (postOfficeId) { where.push('e.post_office_id = ?'); params.push(postOfficeId); }

  let rows = db.prepare(`${SELECT_JOIN} WHERE ${where.join(' AND ')} ORDER BY e.created_at DESC, e.email ASC`).all(...params);
  if (search && String(search).trim()) {
    const ns = normalizeStr(String(search));
    rows = rows.filter((r) =>
      [r.email, r.full_name, r.hrm_code, r.phone].some((v) => normalizeStr(v || '').includes(ns))
    );
  }
  return rows.map(withStatus);
}

function getById(id) {
  const r = db.prepare(`${SELECT_JOIN} WHERE e.id = ?`).get(id);
  return r ? withStatus(r) : null;
}

// ------------------------------------------
// GET /api/emails
// ------------------------------------------
router.get('/emails', authRequired, (req, res) => {
  try {
    const pageNum = Math.max(parseInt(req.query.page) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 200);
    const all = queryEmails(req.query);
    const total = all.length;
    const items = all.slice((pageNum - 1) * limitNum, pageNum * limitNum);
    res.json({ items, pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) } });
  } catch (error) {
    console.error('Get emails error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/emails/export-data — cùng bộ lọc, không phân trang, trả hàng theo key Excel.
router.get('/emails/export-data', authRequired, requireManager, (req, res) => {
  try {
    const items = queryEmails(req.query).map((r) => ({
      email: r.email,
      loai: r.kind === 'UNIT' ? 'Đơn vị' : 'Cá nhân',
      maHrm: r.hrm_code || '',
      hoTen: r.full_name,
      soDienThoai: r.phone || '',
      maBdx: r.commune_code || '',
      maBuuCuc: r.post_office_code || '',
      chucDanh: r.job_title || '',
      trangThai: r.status === 'REVOKED' ? 'Đã thu hồi' : 'Đang sử dụng',
      ngayKhoiTao: isoToVn(r.created_date),
      ngayThuHoi: isoToVn(r.revoked_date)
    }));
    res.json({ items, total: items.length });
  } catch (error) {
    console.error('Export emails error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ------------------------------------------
// POST /api/emails/import  { rows: [{email, loai, maHrm, hoTen, soDienThoai, maBdx,
//   maBuuCuc, chucDanh, trangThai, ngayKhoiTao, ngayThuHoi}] }
// Kiểm tra TOÀN BỘ trước (gom lỗi theo số dòng, tối đa 100) -> có lỗi thì không ghi gì;
// sau đó ghi trong 1 transaction. Cập nhật theo email; ô trống = giữ giá trị cũ.
// Đặt TRƯỚC POST /emails cho rõ ràng (route tĩnh).
// ------------------------------------------
router.post('/emails/import', authRequired, requireManager, (req, res) => {
  try {
    const { rows } = req.body || {};
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Danh sách dữ liệu import không hợp lệ hoặc rỗng' });
    }

    const errors = [];
    let totalErrors = 0;
    const addError = (row, message) => {
      totalErrors++;
      if (errors.length < MAX_IMPORT_ERRORS) errors.push({ row, message });
    };

    const sim = new Map(); // email -> bản ghi sau khi áp dụng các dòng trước trong file
    const plan = [];

    rows.forEach((r, idx) => {
      const rowNum = idx + 1;
      if (!r || typeof r !== 'object') return addError(rowNum, 'Dòng không hợp lệ');
      const rowErrs = [];

      const email = normalizeEmail(str(r.email));
      if (!email) return addError(rowNum, 'Thiếu email');

      const prev = sim.get(email) || db.prepare('SELECT * FROM emails WHERE email = ?').get(email) || null;
      const f = prev
        ? { ...prev }
        : { email, kind: null, hrm_code: null, full_name: null, phone: null, commune_id: null, post_office_id: null, job_title: null, created_date: null, revoked_date: null };
      f.email = email;

      if (!isBlank(r.loai)) {
        const k = parseKind(r.loai);
        if (!k) rowErrs.push(`loai "${r.loai}" không hợp lệ (Đơn vị / Cá nhân)`);
        else f.kind = k;
      } else if (!prev) rowErrs.push('Thiếu loai (Đơn vị / Cá nhân) cho email mới');

      if (!isBlank(r.maHrm)) f.hrm_code = str(r.maHrm);
      if (!isBlank(r.hoTen)) f.full_name = str(r.hoTen);
      if (!isBlank(r.soDienThoai)) f.phone = str(r.soDienThoai);
      if (!isBlank(r.chucDanh)) f.job_title = str(r.chucDanh);

      if (!isBlank(r.maBuuCuc) || !isBlank(r.maBdx)) {
        const u = resolveUnitCodes(str(r.maBdx), str(r.maBuuCuc));
        if (u.error) rowErrs.push(u.error);
        else { f.commune_id = u.commune_id; f.post_office_id = u.post_office_id; }
      }

      if (!isBlank(r.ngayKhoiTao)) {
        const d = parseDateInput(r.ngayKhoiTao);
        if (!d) rowErrs.push(`ngayKhoiTao "${r.ngayKhoiTao}" không phải ngày hợp lệ (dd/mm/yyyy hoặc yyyy-mm-dd)`);
        else f.created_date = d;
      }

      let revokedInput = null;
      if (!isBlank(r.ngayThuHoi)) {
        revokedInput = parseDateInput(r.ngayThuHoi);
        if (!revokedInput) rowErrs.push(`ngayThuHoi "${r.ngayThuHoi}" không phải ngày hợp lệ (dd/mm/yyyy hoặc yyyy-mm-dd)`);
      }

      const warnings = [];
      if (!isBlank(r.trangThai)) {
        const st = normalizeStr(String(r.trangThai));
        if (st === 'dang su dung' || st === 'active') {
          f.revoked_date = null;
          if (revokedInput) warnings.push('trangThai "Đang sử dụng" nên ngayThuHoi bị bỏ qua');
        } else if (st === 'da thu hoi' || st === 'revoked') {
          if (revokedInput) f.revoked_date = revokedInput;
          if (!f.revoked_date && !rowErrs.some((m) => m.startsWith('ngayThuHoi'))) {
            rowErrs.push('Trạng thái "Đã thu hồi" nhưng thiếu ngayThuHoi');
          }
        } else {
          rowErrs.push(`trangThai "${r.trangThai}" không hợp lệ (Đang sử dụng / Đã thu hồi)`);
        }
      } else if (revokedInput) {
        f.revoked_date = revokedInput;
      }

      rowErrs.push(...validateFinal(f).filter((m) => !(m === 'Thiếu email')));
      if (rowErrs.length) {
        addError(rowNum, rowErrs.join('; '));
        return;
      }
      sim.set(email, f);
      plan.push({ rowNum, f, isNew: !prev || !prev.id, warnings });
    });

    if (totalErrors > 0) {
      return res.status(400).json({
        error: 'Dữ liệu import có dòng không hợp lệ, chưa ghi gì vào hệ thống',
        errors,
        totalErrors,
        truncated: totalErrors > errors.length
      });
    }

    let created = 0;
    let updated = 0;
    let personnelCreated = 0;
    const warnings = [];

    const applyTxn = db.transaction(() => {
      for (const { rowNum, f, warnings: rowWarn } of plan) {
        const existing = db.prepare('SELECT id FROM emails WHERE email = ?').get(f.email);
        if (existing) {
          db.prepare(`
            UPDATE emails SET kind = ?, hrm_code = ?, full_name = ?, phone = ?, commune_id = ?,
              post_office_id = ?, job_title = ?, created_date = ?, revoked_date = ?
            WHERE id = ?
          `).run(f.kind, f.hrm_code || null, f.full_name, f.phone || null, f.commune_id || null,
            f.post_office_id || null, f.job_title || null, f.created_date || null, f.revoked_date || null, existing.id);
          updated++;
        } else {
          db.prepare(`
            INSERT INTO emails (id, email, kind, hrm_code, full_name, phone, commune_id, post_office_id, job_title, created_date, revoked_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(uuidv4(), f.email, f.kind, f.hrm_code || null, f.full_name, f.phone || null, f.commune_id || null,
            f.post_office_id || null, f.job_title || null, f.created_date || null, f.revoked_date || null);
          created++;
        }
        rowWarn.forEach((w) => warnings.push(`Dòng ${rowNum}: ${w}`));
        const p = ensurePersonnel(f);
        if (p.created) personnelCreated++;
        if (p.warning) warnings.push(`Dòng ${rowNum}: ${p.warning}`);
      }
    });
    applyTxn();

    res.json({ created, updated, personnelCreated, warnings });
  } catch (error) {
    console.error('Import emails error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ------------------------------------------
// POST /api/emails — thêm thủ công (dùng cùng logic tạo nhân sự như import)
// ------------------------------------------
router.post('/emails', authRequired, requireManager, (req, res) => {
  try {
    const b = req.body || {};
    const f = {
      email: normalizeEmail(b.email),
      kind: b.kind,
      hrm_code: str(b.hrm_code) || null,
      full_name: str(b.full_name),
      phone: str(b.phone) || null,
      job_title: str(b.job_title) || null,
      created_date: null,
      revoked_date: null,
      commune_id: null,
      post_office_id: null
    };
    if (!isBlank(b.created_date)) {
      f.created_date = parseDateInput(b.created_date);
      if (!f.created_date) return res.status(400).json({ error: 'Ngày khởi tạo không hợp lệ (dd/mm/yyyy hoặc yyyy-mm-dd)' });
    }
    const errs = validateFinal(f);
    if (errs.length) return res.status(400).json({ error: errs[0] });

    const unit = resolveUnitIds(b.commune_id, b.post_office_id);
    if (unit.error) return res.status(400).json({ error: unit.error });
    f.commune_id = unit.commune_id;
    f.post_office_id = unit.post_office_id;

    if (db.prepare('SELECT id FROM emails WHERE email = ?').get(f.email)) {
      return res.status(400).json({ error: 'Email này đã tồn tại trong hệ thống' });
    }

    const id = uuidv4();
    let person = { created: false, warning: null };
    db.transaction(() => {
      db.prepare(`
        INSERT INTO emails (id, email, kind, hrm_code, full_name, phone, commune_id, post_office_id, job_title, created_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, f.email, f.kind, f.hrm_code, f.full_name, f.phone, f.commune_id, f.post_office_id, f.job_title, f.created_date);
      person = ensurePersonnel(f);
    })();

    res.status(201).json({
      message: 'Thêm email thành công',
      item: getById(id),
      personnelCreated: person.created,
      warnings: person.warning ? [person.warning] : []
    });
  } catch (error) {
    console.error('Create email error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ------------------------------------------
// PUT /api/emails/:id/revoke  { revoked_date? } — mặc định ngày hôm nay
// PUT /api/emails/:id/reactivate — xoá ngày thu hồi; email cá nhân có HRM chưa có nhân sự -> tạo
// (đặt TRƯỚC PUT /emails/:id; khác độ sâu path nên không xung đột, giữ cho rõ)
// ------------------------------------------
router.put('/emails/:id/revoke', authRequired, requireManager, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM emails WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy email' });
    if (existing.revoked_date) return res.status(400).json({ error: 'Email đã được thu hồi trước đó' });

    const input = (req.body || {}).revoked_date;
    let revoked = todayIso();
    if (!isBlank(input)) {
      revoked = parseDateInput(input);
      if (!revoked) return res.status(400).json({ error: 'Ngày thu hồi không hợp lệ (dd/mm/yyyy hoặc yyyy-mm-dd)' });
    }
    if (existing.created_date && revoked < existing.created_date) {
      return res.status(400).json({ error: 'Ngày thu hồi không được trước ngày khởi tạo' });
    }

    db.prepare('UPDATE emails SET revoked_date = ? WHERE id = ?').run(revoked, existing.id);
    res.json({ message: 'Đã thu hồi email', item: getById(existing.id) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/emails/:id/reactivate', authRequired, requireManager, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM emails WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy email' });
    if (!existing.revoked_date) return res.status(400).json({ error: 'Email đang được sử dụng' });

    // Đưa về "đang dùng" -> cũng đảm bảo có nhân sự (cùng logic POST/import).
    let person = { created: false, warning: null };
    db.transaction(() => {
      db.prepare('UPDATE emails SET revoked_date = NULL WHERE id = ?').run(existing.id);
      person = ensurePersonnel({ ...existing, revoked_date: null });
    })();
    res.json({
      message: 'Đã kích hoạt lại email',
      item: getById(existing.id),
      personnelCreated: person.created,
      warnings: person.warning ? [person.warning] : []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ------------------------------------------
// PUT /api/emails/:id — sửa (key DB-style; key không gửi = giữ nguyên). Không sửa
// revoked_date ở đây (dùng revoke/reactivate).
// ------------------------------------------
router.put('/emails/:id', authRequired, requireManager, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM emails WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy email' });

    const b = req.body || {};
    const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
    const f = { ...existing };

    if (has('email')) f.email = normalizeEmail(b.email);
    if (has('kind')) f.kind = b.kind;
    if (has('hrm_code')) f.hrm_code = str(b.hrm_code) || null;
    if (has('full_name')) f.full_name = str(b.full_name);
    if (has('phone')) f.phone = str(b.phone) || null;
    if (has('job_title')) f.job_title = str(b.job_title) || null;
    if (has('created_date')) {
      if (isBlank(b.created_date)) f.created_date = null;
      else {
        f.created_date = parseDateInput(b.created_date);
        if (!f.created_date) return res.status(400).json({ error: 'Ngày khởi tạo không hợp lệ (dd/mm/yyyy hoặc yyyy-mm-dd)' });
      }
    }
    const errs = validateFinal(f);
    if (errs.length) return res.status(400).json({ error: errs[0] });

    if (has('commune_id') || has('post_office_id')) {
      const newPo = has('post_office_id')
        ? b.post_office_id
        : (has('commune_id') && (b.commune_id || null) !== existing.commune_id ? null : existing.post_office_id);
      const newCommune = has('commune_id') ? b.commune_id : (has('post_office_id') ? null : existing.commune_id);
      const unit = resolveUnitIds(newCommune, newPo);
      if (unit.error) return res.status(400).json({ error: unit.error });
      f.commune_id = unit.commune_id;
      f.post_office_id = unit.post_office_id;
    }

    if (f.email !== existing.email) {
      const dup = db.prepare('SELECT id FROM emails WHERE email = ? AND id <> ?').get(f.email, existing.id);
      if (dup) return res.status(400).json({ error: 'Email này đã tồn tại trong hệ thống' });
    }

    // Sau khi sửa mà là cá nhân + đang dùng + có HRM -> đảm bảo có nhân sự (ensurePersonnel
    // tự bỏ qua nếu đã thu hồi / không phải PERSONAL).
    let person = { created: false, warning: null };
    db.transaction(() => {
      db.prepare(`
        UPDATE emails SET email = ?, kind = ?, hrm_code = ?, full_name = ?, phone = ?, commune_id = ?,
          post_office_id = ?, job_title = ?, created_date = ?
        WHERE id = ?
      `).run(f.email, f.kind, f.hrm_code, f.full_name, f.phone, f.commune_id, f.post_office_id, f.job_title, f.created_date, existing.id);
      person = ensurePersonnel(f);
    })();

    res.json({
      message: 'Cập nhật email thành công',
      item: getById(existing.id),
      personnelCreated: person.created,
      warnings: person.warning ? [person.warning] : []
    });
  } catch (error) {
    console.error('Update email error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
