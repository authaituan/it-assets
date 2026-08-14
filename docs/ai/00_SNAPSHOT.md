# 00 — SNAPSHOT Dự Án (it-assets / Quản lý CCDC Bưu điện Huế)

> Ảnh chụp nhanh hiện trạng hệ thống. Cập nhật gần nhất: **2026-08-12** — **Vòng 2 hoàn
> tất** (commit `666329a`) + **đang chạy thật trên mạng LAN nội bộ** tại
> `http://10.47.33.33:3000` (xem `06_DEPLOYMENT.md` mục 4) + thêm Submenu động cho Quản
> Lý CCDC (PR #8) + fix 1 lỗi nghiêm trọng phát sinh (server crash khi có `dist/`, xem
> `04_DECISIONS.md` mục 8).
> Nội dung được dựng từ code thực tế (`server/`, `package.json`, `scripts/`), không suy đoán.

## Tổng quan
- **Loại**: Fullstack web quản lý Công cụ Dụng cụ (CCDC) CNTT cho Bưu điện Tỉnh TT-Huế (Mã 53).
- **Backend**: Node.js + Express (`server/index.js`), SQLite qua `better-sqlite3` (`server/db.js`).
- **Frontend**: React 18 + Vite + TailwindCSS v4 (`src/`).
- **Data ingestion**: Python seeder `scripts/seed.py` từ `dulieu.xlsx`.
- **DB file**: `data/ccdc.db` (SQLite, WAL mode).

## Bảng dữ liệu chính (`server/db.js`)
- `province_post_offices` (BĐT/TP) → `commune_post_offices` (BĐX) → `post_offices` (MBC/Bưu cục).
- `users` (nhân sự chuẩn HRM; có cột `role` mặc định `STAFF`, `password_hash` cho auth, `deactivated_at` vô hiệu hoá).
- `device_types` (có `asset_prefix` — tiền tố sinh mã CCDC), `brands`, `equipments` (CCDC,
  specs JSON, có `deleted_at` soft-delete + `purchase_year` năm mua), `asset_transfer_logs` (lịch sử).

## API hiện có (`server/index.js`)
- `POST /api/auth/login` — đăng nhập, trả JWT.
- `GET  /api/dashboard/stats` — KPIs & charts.
- `GET  /api/equipments/category-raw-options` — lấy tuỳ chọn phân loại chi tiết (từ `specs.category_raw`).
- `GET  /api/equipments`, `GET /api/equipments/:id` — đọc (mở, không cần token), hỗ trợ lọc `categoryRaw`.
- `POST /api/equipments` — **ghi, cần token + role quản lý**. Validate input; **sinh
  `asset_tag` theo lược đồ mới** (xem mục "Lược đồ mã CCDC"); nhận thêm `purchase_year`
  (mặc định năm hiện tại nếu trống); bọc transaction (tính seq + insert + log cùng
  thành công/rollback). Chặn 400 nếu danh mục chưa cấu hình `asset_prefix`.
- `PUT  /api/equipments/:id` — **ghi (gồm đổi status), cần token + role quản lý**. Validate
  `status` enum. Nhận **đầy đủ** `hostname/ip/mac/serial/model/status/raw_user_name/notes/
  specs` + (mới) `device_type_id/brand_id/brand_name/post_office_id/purchase_year`. Đổi
  loại thiết bị **KHÔNG đổi lại `asset_tag`** (mã cố định từ lúc tạo). Loại trừ thiết bị
  đã soft-delete. Bọc transaction.
- `DELETE /api/equipments/:id` — **mới**: soft-delete (chỉ set `deleted_at`, không xoá
  cứng), cần token + role quản lý, bọc transaction, ghi log action `DELETE`.
- `GET  /api/organization/*`, `GET /api/device-types` — đọc. `GET /api/device-types` trả
  cả `asset_prefix` (dùng cho view Quản Lý Danh Mục).
- `POST /api/device-types` — **ghi, cần token + role quản lý**. Validate tên (1-100 ký
  tự, regex chặn ký tự đặc biệt); nhận thêm `asset_prefix` (optional, regex `^[A-Z0-9]{2,5}$`).
- `PUT /api/device-types/:id` — **mới**: sửa `name`/`asset_prefix`/`description` của danh
  mục đã có. `asset_prefix` bắt buộc khi sửa (regex `^[A-Z0-9]{2,5}$`).
- `POST /api/hrm/upload-and-map` — **ghi, cần token + role quản lý**. Validate fail-fast
  `fullName`/`hrmCode` trước khi ghi DB. Cả đợt import bọc trong 1 transaction lớn (lỗi
  1 dòng → rollback toàn bộ đợt, xem lưu ý ở mục rủi ro).

## Lược đồ mã CCDC (mới, `feat/asset-tag-scheme`)
- Định dạng: `<PREFIX>-<YY>-<seq 3 chữ số>`, vd `PC-24-001`, `LAP-26-001`.
  - `PREFIX` = `device_types.asset_prefix` của loại thiết bị (2-5 ký tự IN HOA/số).
  - `YY` = 2 số cuối `purchase_year` (năm mua; mặc định năm hiện tại nếu không nhập).
  - `seq` = MAX số thứ tự hiện có của cặp (PREFIX, YY) **+1** (dùng MAX chứ không COUNT →
    không trùng khi có khoảng trống do xoá; LIKE `PREFIX-YY-%` KHÔNG lọc `deleted_at` →
    không tái dùng số của thiết bị đã xoá mềm). Tính TRONG transaction tạo thiết bị.
- **QUAN TRỌNG**: chỉ áp dụng cho thiết bị TẠO MỚI. **353 thiết bị thật cũ giữ nguyên mã
  cũ `CCDC-<mã bưu cục>-<seq>`** — migration KHÔNG đổi (xem `04_DECISIONS.md`).
- Danh mục chưa có `asset_prefix` → tạo thiết bị bị chặn 400 với thông báo rõ ràng, buộc
  quản lý vào "Quản Lý Danh Mục" đặt tiền tố trước.
- Migration seed `asset_prefix` cho 8 danh mục hiện có (1 lần, guard bởi cột mới) — vài
  danh mục gán TẠM, PO cần chỉnh lại, xem bảng chi tiết trong `04_DECISIONS.md`.
- Frontend: view mới `src/components/CategoryAdminView.jsx` ("Quản Lý Danh Mục", chỉ hiện
  với role quản lý — sửa `asset_prefix` inline); `AddCategoryModal` thêm ô "Tiền Tố Mã
  CCDC"; `AddEquipmentModal` thêm ô "Năm Mua"; `EquipmentDetailModal` form Chỉnh Sửa bổ
  sung ô Model + Loại thiết bị + Hãng + BĐX/Bưu cục (cascading) + Năm Mua;
  `InventoryView` cột "Mã CCDC / Máy" đổi hiển thị `asset_tag` làm chữ đậm chính (hostname
  xuống dòng phụ). Thương hiệu đổi: "Hệ Thống Quản Lý CCDC" / "Bưu Điện Thành Phố Huế".

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

## User Administration (mới, `feat/user-admin`)
- `GET /api/users` — **ghi-cấp, cần token + role quản lý** (khác các route đọc khác vốn
  để mở): danh sách user, SELECT tường minh từng cột nên KHÔNG bao giờ trả `password_hash`.
- `POST /api/users` — cần token + role quản lý: tạo user (`hrm_code` bắt buộc + unique,
  `full_name` bắt buộc, `role` mặc định `STAFF`, `password` >= 6 ký tự, hash bằng
  `hashPassword()` có sẵn trong `server/auth.js` trước khi lưu).
- `PUT /api/users/:id` — cần token + role quản lý: sửa `full_name`/`role`. Chặn tự đổi
  `role` của chính mình (so `req.user.id` với `:id`) → 400, tránh tự khoá quyền quản lý.
  UI đã có ô sửa `full_name` inline (gộp chung với sửa role, cùng 1 nút "Sửa").
- `PUT /api/users/:id/reset-password` — cần token + role quản lý: reset mật khẩu cho
  user khác, không cần biết mật khẩu cũ.
- `PUT /api/users/:id/deactivate` / `PUT /api/users/:id/reactivate` — **mới**
  (`feat/user-edit-deactivate`), cần token + role quản lý: set/xoá cột
  `users.deactivated_at` (migration idempotent trong `server/db.js`, cùng pattern với
  `equipments.deleted_at`). `deactivate` chặn tự vô hiệu hoá chính mình (so
  `req.user.id` với `:id`) → 400, copy đúng pattern chặn tự đổi role. Khác equipments
  soft-delete: `GET /api/users` **KHÔNG ẩn** user đã vô hiệu hoá khỏi danh sách (trả
  thêm field `deactivated_at` để UI hiện badge + nút Kích Hoạt Lại) — mục đích khác
  nhau, quản lý cần thấy ai đang bị khoá.
- `POST /api/auth/login` — user có `deactivated_at IS NOT NULL` bị chặn đăng nhập
  **kể cả đúng mật khẩu**, trả 401 message riêng "Tài khoản đã bị vô hiệu hoá, vui
  lòng liên hệ quản trị viên" (khác message sai mật khẩu). Kiểm tra SAU khi verify mật
  khẩu đúng (không phải trước) để tránh lộ trạng thái vô hiệu hoá cho người chưa chứng
  minh biết mật khẩu.
- `PUT /api/users/me/password` — **chỉ cần token** (KHÔNG cần role quản lý, mọi user kể
  cả STAFF tự đổi được mật khẩu của mình): yêu cầu `currentPassword` đúng (verify bằng
  `verifyPassword()`) mới cho đổi `newPassword`.
- Frontend: `src/components/UserAdminView.jsx` (mới, view "Quản Lý Người Dùng" — chỉ
  hiện trong Sidebar khi `authUser.role !== 'STAFF'`), `AddUserModal.jsx`,
  `ResetUserPasswordModal.jsx` (dùng bởi quản lý), `ChangePasswordModal.jsx` (tự đổi mật
  khẩu, mở từ nút cạnh "Đăng Xuất" trong Header — cho MỌI user đã đăng nhập).
- Bug CSS phát hiện + đã sửa khi test UI thật: `ChangePasswordModal` ban đầu bị "kẹt" ở
  góc trên màn hình vì render lồng trong `<header>` có `backdrop-blur-xl` (CSS
  `backdrop-filter` tạo containing block mới cho `position: fixed`) — sửa bằng
  `ReactDOM.createPortal` render thẳng vào `document.body`.
- Đã test qua UI thật: quản lý tạo user STAFF mới → đăng nhập user đó → không thấy mục
  Quản Lý Người Dùng → tự đổi mật khẩu (sai mật khẩu hiện tại → lỗi rõ ràng; đúng → đổi
  thành công) → đăng xuất → đăng nhập lại bằng mật khẩu MỚI xác nhận có tác dụng → quản
  lý reset mật khẩu + sửa role cho user đó → xoá user test khỏi DB thật sau khi xong.
- **Sửa thông tin + vô hiệu hoá (mới, `feat/user-edit-deactivate`)**: bảng thêm cột
  "Trạng Thái" (badge "Đang hoạt động"/"Đã khoá", hàng bị mờ khi khoá). Nút "Sửa" sửa
  cả `full_name` + `role` cùng lúc inline (role tự disable khi sửa chính mình, giống
  cách nút "Vô Hiệu Hoá" tự disable với chính mình). Đã test qua UI thật: sửa tên user
  khác → đúng trên danh sách → vô hiệu hoá → badge đổi "Đã khoá" → đăng nhập lại bằng
  đúng mật khẩu của user đó → bị chặn với message riêng ("Tài khoản đã bị vô hiệu hoá,
  vui lòng liên hệ quản trị viên") khác hẳn message sai mật khẩu → quản lý bấm Kích
  Hoạt Lại → đăng nhập lại bình thường được → thử tự vô hiệu hoá chính tài khoản đang
  đăng nhập (cả qua UI nút đã disable, lẫn gọi API trực tiếp) → 400 bị chặn.

## Sidebar & Inventory (mới, `feat/inventory-submenu`)
- **Sidebar động**: Mục "Quản Lý CCDC" có thể expand/collapse hiển thị submenu chứa danh sách các loại thiết bị CCDC. Danh sách này được lấy động từ `GET /api/device-types`.
- **Lọc tự động**: Khi click vào 1 loại thiết bị trong submenu, `InventoryView` sẽ tự động lọc theo loại thiết bị đó (`initialDeviceTypeId`). Dropdown "Loại Thiết Bị CCDC" trong bảng tự cập nhật mà không bị khoá, cho phép user đổi loại tùy ý. Bổ sung thêm Dropdown "Phân Loại Chi Tiết" (động theo `category_raw`).
- **Reset lọc**: Click vào mục cha "Quản Lý CCDC" sẽ tự động reset dropdown về "-- Tất cả loại thiết bị --" và show đủ danh sách.

## Bảo mật đăng nhập (Vòng 2, 2026-08-12)
- **Rate-limit**: tối đa 5 lần sai trong 15 phút / (IP + mã HRM), lần thứ 6 trả `429`
  kèm header `Retry-After` — kể cả nếu gửi đúng mật khẩu ở lần thứ 6 vẫn bị chặn (chặn
  trước khi verify). Lưu trong bộ nhớ tiến trình (Map), không dùng DB/Redis — đủ cho 1
  instance hiện tại. Verify bằng test tự động (`tests/auth.test.js`) VÀ gọi API thật.
- **49 test tự động** (tăng từ 32): thêm `tests/users.test.js` (15 test cho 5 route
  User Administration) + 2 test rate-limit trong `tests/auth.test.js`.
- Đã dọn `.claude/launch.json` (file tooling IDE lọt nhầm vào repo từ PR trước) + thêm
  `.claude/` vào `.gitignore`.
- Hướng dẫn set `JWT_SECRET` thật khi deploy: xem `06_DEPLOYMENT.md` (thao tác vận hành
  tay khi lên production, không phải code).

## Chưa có / rủi ro (còn lại — không khẩn cấp)
- ⚠️ **JWT_SECRET mặc định cho DEV**: hướng dẫn đã có ở `06_DEPLOYMENT.md`, nhưng bước
  set thực tế PO phải tự làm khi deploy (không phải việc code).
- ⚠️ Chưa có refresh token — token hết hạn sau thời gian cố định (`TOKEN_EXPIRY` trong
  `server/auth.js`), người dùng phải đăng nhập lại thủ công.
- ⚠️ Import HRM cả đợt chạy trong 1 transaction: lỗi 1 dòng cuối → rollback toàn bộ, phải
  chạy lại từ đầu (đánh đổi có chủ đích, PO đã được thông báo).
- ⚠️ Chưa có CI (test tự động chưa chạy tự động trên GitHub, phải tự gõ `npm test`).
- ⚠️ Rate-limit lưu trong bộ nhớ tiến trình — không chính xác nếu sau này scale ra nhiều
  instance server (cần Redis lúc đó). Chưa cần xử lý ở quy mô hiện tại.

## ✅ Vòng 1 — đã xử lý xong toàn bộ (5/5 hạng mục risk/drift ban đầu)
Chi tiết từng hạng mục xem các mục phía trên. Tổng kết: 2 drift tài liệu, Auth + RBAC,
Soft-delete + Transaction, Input Validation, 32 test tự động, Frontend tích hợp đăng
nhập, và 1 fix phát sinh (Dashboard đếm nhầm thiết bị đã xoá) — tất cả đã merge vào
`main`, verify bằng `git fetch` + đọc code thật cho từng bước, không dựa vào báo cáo.
