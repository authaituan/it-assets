# 📝 AI-Assisted Changes Changelog

Ghi lại các thay đổi được thực hiện với hỗ trợ của AI/Claude Code.

---

## [2026-08-12] - Authentication + RBAC cơ bản (feat/auth-rbac)

### Changes
- **server/auth.js** (mới): JWT sign/verify (`jsonwebtoken`), hash/verify password bằng `crypto.scrypt`, middleware `authRequired` + `requireManager`, helper `isManager`.
- **server/db.js**: Thêm cột `users.password_hash` (kèm migration ALTER TABLE idempotent cho DB đã tồn tại).
- **server/index.js**: Thêm route `POST /api/auth/login` (sinh JWT); gắn `authRequired + requireManager` cho 4 route ghi (`POST /api/equipments`, `PUT /api/equipments/:id`, `POST /api/device-types`, `POST /api/hrm/upload-and-map`).
- **package.json**: Thêm dependency `jsonwebtoken`.
- **docs/ai/**: Tạo `00_SNAPSHOT.md`, `03_ARCHITECTURE_MAP.md`, `README_AI.md`.

### Reason
Bổ sung authentication + phân quyền cơ bản. Nguyên tắc tạm thời: STAFF chỉ đọc, role quản lý (khác STAFF) mới được ghi — PO sẽ chốt ma trận quyền chi tiết sau.

### Tested
Test thủ công bằng curl (server local :5000): login sai mật khẩu → 401; login manager/staff → 200 + JWT; PUT status không token → 401, STAFF token → 403, manager token → 200; GET đọc vẫn mở → 200; token rác → 401.

---
