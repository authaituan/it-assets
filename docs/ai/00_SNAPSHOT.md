# 00 — SNAPSHOT Dự Án (it-assets / Quản lý CCDC Bưu điện Huế)

> Ảnh chụp nhanh hiện trạng hệ thống. Cập nhật gần nhất: **2026-08-12** (branch `feat/auth-rbac`).
> Nội dung được dựng từ code thực tế (`server/`, `package.json`, `scripts/`), không suy đoán.

## Tổng quan
- **Loại**: Fullstack web quản lý Công cụ Dụng cụ (CCDC) CNTT cho Bưu điện Tỉnh TT-Huế (Mã 53).
- **Backend**: Node.js + Express (`server/index.js`), SQLite qua `better-sqlite3` (`server/db.js`).
- **Frontend**: React 18 + Vite + TailwindCSS v4 (`src/`).
- **Data ingestion**: Python seeder `scripts/seed.py` từ `dulieu.xlsx`.
- **DB file**: `data/ccdc.db` (SQLite, WAL mode).

## Bảng dữ liệu chính (`server/db.js`)
- `province_post_offices` (BĐT/TP) → `commune_post_offices` (BĐX) → `post_offices` (MBC/Bưu cục).
- `users` (nhân sự chuẩn HRM; có cột `role` mặc định `STAFF`, và `password_hash` cho auth).
- `device_types`, `brands`, `equipments` (CCDC, specs dạng JSON), `asset_transfer_logs` (lịch sử).

## API hiện có (`server/index.js`)
- `POST /api/auth/login` — đăng nhập, trả JWT.
- `GET  /api/dashboard/stats` — KPIs & charts.
- `GET  /api/equipments`, `GET /api/equipments/:id` — đọc (mở, không cần token).
- `POST /api/equipments` — **ghi, cần token + role quản lý**.
- `PUT  /api/equipments/:id` — **ghi (gồm đổi status), cần token + role quản lý**.
- `GET  /api/organization/*`, `GET /api/device-types` — đọc.
- `POST /api/device-types` — **ghi, cần token + role quản lý**.
- `POST /api/hrm/upload-and-map` — **ghi, cần token + role quản lý**.

## Authentication & phân quyền (mới, `feat/auth-rbac`)
- JWT (`jsonwebtoken`), password hashing bằng `crypto.scrypt` built-in (không dùng bcrypt/native).
- Middleware: `authRequired` (bắt buộc token) + `requireManager` (chặn STAFF ghi) — `server/auth.js`.
- Nguyên tắc **tạm thời**: STAFF chỉ đọc; role khác STAFF (vd ADMIN/MANAGER) được ghi.

## Chưa có / rủi ro
- ⚠️ **Phân quyền chi tiết chưa chốt**: hiện dùng nguyên tắc thô "STAFF chỉ đọc, khác STAFF được ghi" — PO cần chốt ma trận quyền cụ thể theo từng route/role.
- ⚠️ **Chưa có cơ chế cấp/đổi mật khẩu qua UI**: `password_hash` phải set thủ công (script) — chưa có route quản trị user.
- ⚠️ **JWT_SECRET mặc định cho DEV**: cần set biến môi trường `JWT_SECRET` ở production.
- ⚠️ Chưa có refresh token / logout / rate-limit đăng nhập.
- ⚠️ Frontend chưa tích hợp luồng đăng nhập & gắn token vào request ghi.
- ⚠️ Chưa có test tự động (chỉ test thủ công bằng curl).
