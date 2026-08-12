# 00 — SNAPSHOT Dự Án (it-assets / Quản lý CCDC Bưu điện Huế)

> Ảnh chụp nhanh hiện trạng hệ thống. Cập nhật gần nhất: **2026-08-12** — **Vòng 1
> hoàn tất**, đã merge vào `main` (commit `fe8aa3e`), verify bằng `git fetch` trực tiếp
> (không dựa vào báo cáo suông) cho từng bước.
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

## Test tự động (mới, `test/core-routes`)
- Framework: `node:test` (built-in Node, 0 dependency mới). Script `npm test`.
- 32 test case trong `tests/auth.test.js`, `tests/equipments.test.js`, `tests/hrm.test.js`
  — bao phủ auth/RBAC, equipments CRUD + soft-delete + rollback-không-log-rác, HRM
  auto-mapping. Chi tiết kỹ thuật harness: `03_ARCHITECTURE_MAP.md`.
- Chạy trên DB SQLite tạm riêng (`os.tmpdir()`), tự seed + tự dọn sau khi chạy, không
  đụng `data/ccdc.db` thật (đã verify bằng hash MD5 trước/sau).

## Frontend Auth (mới, `feat/frontend-auth`)
- `src/components/LoginView.jsx`: form đăng nhập (hrm_code + password), gọi
  `POST /api/auth/login`, không qua `src/utils/api.js` (route công khai).
- `src/App.jsx`: đọc token đã lưu lúc khởi tạo (`getInitialAuthUser`), hiện LoginView
  thay vì Sidebar/Header/main content nếu chưa có token hợp lệ hoặc token đã hết hạn
  (kiểm tra claim `exp` phía client trước, không cần đợi request 401). Lắng nghe event
  `AUTH_EXPIRED_EVENT` để tự quay về LoginView khi có request ghi bị 401.
- `src/components/Header.jsx`: nút "Đăng Xuất" cạnh công tắc đổi theme; hiện tên/role
  thật từ token thay vì text tĩnh "Quản Trị IT".
- `src/utils/api.js` (helper mới): `apiFetch`/`apiFetchJson` tự gắn header
  `Authorization: Bearer <token>` cho request ghi; tự xoá token + phát event khi 401;
  gắn message tiếng Việt rõ ràng cho 403 (STAFF không đủ quyền) thay vì lỗi JSON thô.
  CHỈ lưu token vào `localStorage`, không lưu password; thông tin tên/role hiển thị suy
  ra trực tiếp từ payload JWT (giải mã base64 phía client để hiển thị, không xác thực).
- 4 chỗ gọi fetch ghi đã chuyển qua `apiFetchJson`: `AddCategoryModal.jsx`,
  `HrmMappingView.jsx`, `AddEquipmentModal.jsx`, `EquipmentDetailModal.jsx` (PUT + nút
  Xoá thiết bị mới, gọi `DELETE /api/equipments/:id`).
- Đã test qua UI thật (Vite dev server + Chrome), không chỉ curl: đăng nhập sai mật
  khẩu → lỗi rõ ràng; đăng nhập đúng → vào được app; thêm/sửa/xoá thiết bị → thành công
  (không còn 401); đăng xuất → quay về LoginView, token bị xoá khỏi localStorage; reload
  không token → bị chặn ngay, không thấy nội dung; STAFF thao tác ghi → 403 với message
  "Không đủ quyền..." hiển thị rõ ràng, không văng lỗi JSON thô.

## Dashboard (`GET /api/dashboard/stats`)
- Đã fix drift: toàn bộ 9 chỗ đếm/lọc thiết bị trong route này giờ có `deleted_at IS
  NULL` (trước đó chỉ 4/9 route khác đã lọc đúng, riêng route Dashboard sót hoàn toàn).
  Verify bằng test thủ công (seed 1 thiết bị + soft-delete → `totalAssets` giảm đúng)
  và xác nhận trên dữ liệu thật qua UI (352 thay vì 353 sau khi xoá 1 thiết bị test).

## Chưa có / rủi ro (còn lại sau Vòng 1 — không khẩn cấp, nên xử lý trước production)
- ⚠️ **Chưa có cơ chế cấp/đổi mật khẩu qua UI**: `password_hash` phải set thủ công (script) — chưa có route quản trị user.
- ⚠️ **JWT_SECRET mặc định cho DEV**: cần set biến môi trường `JWT_SECRET` ở production.
- ⚠️ Chưa có refresh token / logout / rate-limit đăng nhập.
- ⚠️ Import HRM cả đợt chạy trong 1 transaction: lỗi 1 dòng cuối → rollback toàn bộ, phải
  chạy lại từ đầu (đánh đổi có chủ đích, PO đã được thông báo).
- ⚠️ Chưa có CI (test tự động chưa chạy tự động trên GitHub, phải tự gõ `npm test`).

## ✅ Vòng 1 — đã xử lý xong toàn bộ (5/5 hạng mục risk/drift ban đầu)
Chi tiết từng hạng mục xem các mục phía trên. Tổng kết: 2 drift tài liệu, Auth + RBAC,
Soft-delete + Transaction, Input Validation, 32 test tự động, Frontend tích hợp đăng
nhập, và 1 fix phát sinh (Dashboard đếm nhầm thiết bị đã xoá) — tất cả đã merge vào
`main`, verify bằng `git fetch` + đọc code thật cho từng bước, không dựa vào báo cáo.
