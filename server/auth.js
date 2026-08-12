// ==========================================
// AUTH MODULE - JWT + RBAC (Role-Based Access Control)
// Nguyên tắc tạm thời (PO sẽ chốt chi tiết sau):
//   - STAFF: chỉ đọc (read-only)
//   - Role quản lý (khác STAFF, vd ADMIN/MANAGER): được ghi (write)
// Dùng crypto built-in cho password hashing (scrypt) - KHÔNG thêm native dep.
// ==========================================
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Secret lấy từ ENV; có fallback cho môi trường dev (cảnh báo nếu thiếu).
const JWT_SECRET = process.env.JWT_SECRET || 'dev-ccdc-buudien-secret-change-me';
if (!process.env.JWT_SECRET) {
  console.warn('[auth] CẢNH BÁO: JWT_SECRET chưa được set trong ENV, đang dùng secret mặc định cho DEV. KHÔNG dùng cho production.');
}
const TOKEN_EXPIRY = process.env.JWT_EXPIRY || '8h';

// ------------------------------------------
// Password hashing (scrypt) — lưu dạng "salt:hash" hex
// ------------------------------------------
function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(plain), salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(plain, stored) {
  if (!stored || typeof stored !== 'string' || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const derived = crypto.scryptSync(String(plain), salt, 64).toString('hex');
  const hashBuf = Buffer.from(hash, 'hex');
  const derivedBuf = Buffer.from(derived, 'hex');
  if (hashBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(hashBuf, derivedBuf);
}

// ------------------------------------------
// JWT sign
// ------------------------------------------
function signToken(user) {
  const payload = {
    id: user.id,
    hrm_code: user.hrm_code || null,
    full_name: user.full_name || null,
    role: user.role || 'STAFF'
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

// ------------------------------------------
// Role helper: quản lý = bất kỳ role nào KHÁC 'STAFF'
// ------------------------------------------
function isManager(role) {
  return !!role && role !== 'STAFF';
}

// ------------------------------------------
// Middleware: bắt buộc có token hợp lệ (dùng cho route ghi POST/PUT)
// ------------------------------------------
function authRequired(req, res, next) {
  const header = req.headers['authorization'] || '';
  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Thiếu hoặc sai định dạng token (Authorization: Bearer <token>)' });
  }
  try {
    const decoded = jwt.verify(parts[1], JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

// ------------------------------------------
// Middleware: bắt buộc role quản lý (chạy SAU authRequired)
// STAFF chỉ đọc -> chặn ghi tại đây.
// ------------------------------------------
function requireManager(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Chưa xác thực' });
  }
  if (!isManager(req.user.role)) {
    return res.status(403).json({ error: 'Không đủ quyền: chỉ role quản lý mới được thao tác ghi (STAFF chỉ đọc)' });
  }
  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  isManager,
  authRequired,
  requireManager,
  JWT_SECRET,
  TOKEN_EXPIRY
};
