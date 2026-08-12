# 00 — SNAPSHOT Dự Án (it-assets / Quản lý CCDC Bưu điện Huế)

> Ảnh chụp nhanh hiện trạng hệ thống. Cập nhật gần nhất: **2026-08-12** (gộp bước
> `feat/soft-delete-transactions` + `feat/input-validation`, đã test end-to-end, đang
> chờ PO push lên nhánh mới và merge vào `main`).
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
- `POST /api/equipments` — **ghi, cần token + role quản lý**. Có validate input (độ dài,
  SELECT xác nhận `device_type_id`/`post_office_id` tồn tại), bọc transaction (insert +
  log audit cùng thành công/rollback).
- `PUT  /api/equipments/:id` — **ghi (gồm đổi status), cần token + role quản lý**. Validate
  `status` theo đúng 5 giá trị enum. Loại trừ thiết bị đã soft-delete. Bọc transaction.
- `DELETE /api/equipments/:id` — **mới**: soft-delete (chỉ set `deleted_at`, không xoá
  cứng), cần token + role quản lý, bọc transaction, ghi log action `DELETE`.
- `GET  /api/organization/*`, `GET /api/device-types` — đọc.
- `POST /api/device-types` — **ghi, cần token + role quản lý**. Validate tên (1-100 ký
  tự, regex chặn ký tự đặc biệt).
- `POST /api/hrm/upload-and-map` — **ghi, cần token + role quản lý**. Validate fail-fast
  `fullName`/`hrmCode` trước khi ghi DB. Cả đợt import bọc trong 1 transaction lớn (lỗi
  1 dòng → rollback toàn bộ đợt, xem lưu ý ở mục rủi ro).

## Soft-delete & Transaction (mới, gộp từ `feat/soft-delete-transactions`)
- Cột `equipments.deleted_at` (migration idempotent trong `server/db.js`).
- `GET /api/equipments` và `GET /api/equipments/:id` mặc định loại trừ thiết bị đã xoá.
- Đã test end-to-end: create → list (thấy) → delete → list (không thấy) → detail 404 →
  xoá lần 2 → 404 → xoá không token → 401 → request lỗi giữa transaction không để lại
  log rác.

## Input Validation (mới, gộp từ `feat/input-validation`)
- Đã test: tạo thiết bị với `device_type_id` giả → 400; hostname > 255 ký tự → 400;
  status sai enum → 400; tên danh mục có ký tự đặc biệt → 400; HRM `fullName` sai kiểu
  → 400 (chặn trước khi mở transaction ghi DB).

## Authentication & phân quyền (mới, `feat/auth-rbac`)
- JWT (`jsonwebtoken`), password hashing bằng `crypto.scrypt` built-in (không dùng bcrypt/native).
- Middleware: `authRequired` (bắt buộc token) + `requireManager` (chặn STAFF ghi) — `server/auth.js`.
- Nguyên tắc **tạm thời**: STAFF chỉ đọc; role khác STAFF (vd ADMIN/MANAGER) được ghi.

## Chưa có / rủi ro
- ✅ ~~Phân quyền chi tiết chưa chốt~~ — PO đã chốt giữ mô hình nhị phân (STAFF đọc / khác
  STAFF ghi), xem `04_DECISIONS.md`.
- ✅ ~~Chưa có DELETE/soft-delete~~ — đã có, xem mục trên.
- ✅ ~~Chưa bọc transaction~~ — đã có, xem mục trên.
- ✅ ~~Chưa validate input backend~~ — đã có, xem mục trên.
- ⚠️ **Chưa có cơ chế cấp/đổi mật khẩu qua UI**: `password_hash` phải set thủ công (script) — chưa có route quản trị user.
- ⚠️ **JWT_SECRET mặc định cho DEV**: cần set biến môi trường `JWT_SECRET` ở production.
- ⚠️ Chưa có refresh token / logout / rate-limit đăng nhập.
- ⚠️ Frontend chưa tích hợp luồng đăng nhập & gắn token vào request ghi.
- ⚠️ Chưa có test tự động (chỉ test thủ công bằng curl) — xem bước 5 trong `05_BACKLOG.md`.
- ⚠️ Import HRM cả đợt chạy trong 1 transaction: lỗi 1 dòng cuối → rollback toàn bộ, phải
  chạy lại từ đầu (đánh đổi có chủ đích, PO đã được thông báo).
