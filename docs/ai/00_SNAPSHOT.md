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
- `GET/POST/PUT /api/personnel*` — **mới** (`feat/personnel-backend`), thay thế hẳn route
  HRM cũ `POST /api/hrm/upload-and-map` (đã xoá). Xem mục "Personnel API" bên dưới.

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

## Personnel API (mới, `feat/personnel-backend`, CHỈ BACKEND)
- Thay thế hẳn route HRM cũ `POST /api/hrm/upload-and-map` (đã xoá khỏi
  `server/index.js`). Bảng `users` dùng chung 2 mục đích: tài khoản đăng nhập
  (`role`, `password_hash`) VÀ nguồn "Người Sử Dụng" gán cho thiết bị
  (`equipments.assigned_user_id`); route personnel CHỈ thao tác 4 field
  `hrm_code/full_name/post_office_code/commune_code`, không bao giờ đụng
  `role`/`password_hash`.
- `GET /api/personnel` — cần token + role quản lý: danh sách nhân sự, hỗ trợ
  `search` (khớp `hrm_code` HOẶC `full_name`, chuẩn hoá bỏ dấu/không phân biệt
  hoa thường), lọc `postOfficeCode`/`communeCode`, phân trang (cùng pattern
  `GET /api/equipments`).
- `GET /api/personnel/search?q=...` — cần token + role quản lý: tối đa 10 kết
  quả khớp `hrm_code`/`full_name` đã chuẩn hoá, dùng cho autocomplete (UI làm ở
  hạng mục sau).
- `POST /api/personnel` — cần token + role quản lý: thêm nhân sự thủ công,
  `hrm_code` bắt buộc + unique, `full_name` bắt buộc.
- `PUT /api/personnel/:id` — cần token + role quản lý: sửa 4 field trên,
  `hrm_code` (nếu đổi) vẫn phải unique.
- `DELETE /api/personnel/:id` — **mới**: soft-delete (vô hiệu hoá) nhân sự. 
  Set `deactivated_at = CURRENT_TIMESTAMP`. Bị chặn nếu người dùng đang có tài khoản đăng nhập (`password_hash IS NOT NULL`).
- `POST /api/personnel/import` — cần token + role quản lý: import hàng loạt
  `{ personnel: [{hrmCode, fullName, postOfficeCode, communeCode}] }`. Validate
  fail-fast TRƯỚC khi ghi DB (1 dòng lỗi → chặn cả batch). Hợp lệ hết → UPSERT
  theo `hrm_code` trong 1 `db.transaction()` — khác route HRM cũ (khớp theo
  `hrm_code OR full_name`), route mới CHỈ khớp theo `hrm_code`. **KHÔNG** mang
  theo tính năng "Auto-Match Equipment by Raw User Name" của route cũ — gán
  thiết bị nay làm tường minh qua `assigned_user_id`, xem mục dưới.
- `GET /api/users` — sửa: thêm `WHERE password_hash IS NOT NULL` để không lẫn
  nhân sự thuần (thêm qua `/api/personnel`, không có `password_hash`) vào danh
  sách tài khoản đăng nhập.
- `POST /api/equipments` và `PUT /api/equipments/:id` — nhận thêm field
  `assigned_user_id` (optional, nullable, validate tồn tại trong `users` nếu
  có → 400 nếu không). `raw_user_name` giữ nguyên hành vi cũ, độc lập với
  `assigned_user_id`.
- ⚠️ **Drift đã biết**: `src/components/HrmMappingView.jsx` (frontend) vẫn gọi
  route cũ đã xoá → sẽ lỗi 404 nếu còn render. Hạng mục này CHỈ backend theo
  đúng phạm vi giao; frontend sẽ được 2 hạng mục sau xử lý. Chi tiết xem
  `04_DECISIONS.md` mục 10.
- Test: 79/79 test tự động pass (`npm test`), gồm `tests/personnel.test.js`
  mới (thay `tests/hrm.test.js` đã xoá) phủ đủ 5 route personnel + 2 thay đổi
  ở equipments/users. Chưa test qua curl trên server production thật (đang
  chạy sống tại cổng 5000 khi làm hạng mục này) để tránh ghi dữ liệu test vào
  353 thiết bị thật.

## Frontend Người Sử Dụng (mới, `feat/personnel-frontend`)
- `src/components/PersonnelView.jsx` — layout theo đúng pattern
  `InventoryView.jsx` (glass-panel/glass-input, bảng + phân trang). Cột bảng:
  Mã HRM, Tên Nhân Viên, Mã BC, Mã BĐX — 2 cột sau tự tra tên thật qua
  `GET /api/organization/post-offices` / `GET /api/organization/communes`
  (khớp theo `code`), hiện thẳng mã nếu không tra được tên. Thêm nút "Sửa" và "Xoá"
  (vô hiệu hoá) trên mỗi dòng. Xoá có xác nhận và hiện lỗi nếu người đó có tài khoản đăng nhập.
- `src/components/AddPersonnelModal.jsx` (đã nâng cấp): hỗ trợ cả chế độ Thêm mới và Sửa.
  Sử dụng prop `editingPersonnel` để tự điền dữ liệu, chuyển API từ POST sang PUT.
- `src/components/ImportPersonnelModal.jsx` (mới): đọc file `.xlsx` THẬT
  bằng `exceljs` ngay trên trình duyệt (`ExcelJS.Workbook().xlsx.load()` từ
  `file.arrayBuffer()`, KHÔNG qua backend) — đọc đúng 4 cột A-D, bỏ qua dòng
  tiêu đề, hiện bảng xem trước + chặn Import nếu có dòng thiếu Mã HRM/Tên,
  gọi `POST /api/personnel/import` sau khi xác nhận.
- `src/components/Sidebar.jsx`: mục "Tích Hợp HRM Nhân Sự" đổi thành "Người
  Sử Dụng" (id đổi từ `hrm` → `personnel`); `src/App.jsx` render
  `PersonnelView` thay `HrmMappingView`.
- ⚠️ **Cố ý KHÔNG sửa** `src/components/Header.jsx`: nút "Upload File HRM" ở
  header vẫn gọi `onOpenHrmModal` (định nghĩa trong `App.jsx`, nay trỏ sang
  tab `personnel`) — nút vẫn hoạt động đúng (mở đúng view mới) nhưng NHÃN chữ
  "Upload File HRM" nay không còn khớp nội dung thật, vì `Header.jsx` nằm
  ngoài phạm vi hạng mục này (tránh đụng file hạng mục khác đang làm). Xem
  `04_DECISIONS.md` mục 11.
- Đã test qua UI thật (Vite dev server thật :3000 + backend thật :5000, KHÔNG
  phải server production đang chạy sống — thời điểm làm hạng mục này server
  production không chạy, xác nhận bằng `netstat` trước khi khởi động):
  tạo 1 tài khoản ADMIN tạm để đăng nhập (xoá lại sau khi xong) → import file
  `.xlsx` thật 3 dòng (bỏ qua header) → xem trước đúng → Import → 3 tạo mới →
  xuất hiện đúng trong danh sách kèm tên BC/BĐX tra được → thêm 1 người thủ
  công → xuất hiện đúng → "Quản Lý Người Dùng" xác nhận KHÔNG thấy 4 nhân sự
  vừa tạo (đúng vì chưa có mật khẩu) → xoá sạch toàn bộ dữ liệu test (tài
  khoản tạm + 4 dòng personnel) khỏi `data/ccdc.db` thật sau khi xong, verify
  lại bằng query còn đúng 2 tài khoản gốc.
- ⚠️ **Phát hiện khi verify** (không phải do hạng mục này gây ra): 1 thiết bị
  test còn sót trong `data/ccdc.db` thật (`asset_tag = PC-24-001`,
  `hostname = TEST-NEW-001`, tạo lúc 2026-08-14 03:34:36, KHÔNG soft-delete)
  — đã tồn tại TRƯỚC khi hạng mục này bắt đầu (xác nhận qua dashboard baseline
  354 thiết bị hoạt động lúc mới đăng nhập). Nghi là dữ liệu test sót lại từ
  hạng mục song song (`AddEquipmentModal`/`EquipmentDetailModal`) chưa dọn.
  KHÔNG tự xoá (ngoài phạm vi + không chắc chắn về ngữ cảnh), báo PO xem lại.
  **Cập nhật (`feat/personnel-autocomplete`)**: thiết bị này đã được soft-delete
  (`deleted_at` có giá trị) bởi 1 phiên làm việc khác trong lúc hạng mục
  autocomplete đang chạy — xác nhận không phải do hạng mục này xử lý.

## Equipment Import/Export API (mới, `feat/equipment-import-export-backend`, CHỈ BACKEND)
> ⚠️ **HÀNH VI ĐÃ ĐỔI (2026-08-17, `feat/network-management-backend`, Phương án B):**
> `POST /api/equipments/import` **KHÔNG còn tự tạo mới Tỉnh/BĐX/Bưu cục**. Nếu
> `maMbc` chưa tồn tại → **chặn 400** ("Bưu cục {maMbc} chưa có trong hệ thống
> Quản Lý Mạng Lưới..."). Các field `provincesCreated/communesCreated/
> postOfficesCreated` vẫn có trong response nhưng **LUÔN = 0**. Chỉ "Quản Lý
> Mạng Lưới" mới được tạo tổ chức mới — xem section riêng bên dưới.
- `GET /api/equipments/export-data` — cần token + role quản lý: **TÁI SỬ DỤNG
  nguyên vẹn** logic WHERE clause của `GET /api/equipments` (`search`,
  `communeId`, `postOfficeId`, `deviceTypeId`, `categoryRaw`, `status`),
  KHÔNG phân trang (trả `{ items, total }`, toàn bộ dòng khớp filter cùng
  lúc). Mỗi dòng trả đủ 24 field khớp thứ tự cột Excel gốc A-X (key tiếng
  Việt không dấu, vd `maBdtTp`, `tenMay`, `maBdx`...) CỘNG 7 field mới:
  `maCcdc` (asset_tag), `danhMucCcdc` (device_types.name thật, khác cột L
  `loaiMay` vốn chỉ là `specs.category_raw`), `tienToDanhMucMoi` (LUÔN `""`
  lúc export — chỉ có ý nghĩa lúc import), `namMua` (purchase_year),
  `maHrmNguoiSuDung` (users.hrm_code qua assigned_user_id), `trangThai`
  (status), `ghiChu` (notes). Bảng field đầy đủ: `03_ARCHITECTURE_MAP.md`.
- `POST /api/equipments/import` — cần token + role quản lý: nhận
  `{ rows: [{...31 field cùng key với export...}] }`. Validate fail-fast
  TRƯỚC khi mở transaction: mỗi dòng phải có `maMbc` VÀ (`tenMay` HOẶC
  `maCcdc`) — thiếu 1 trong 2 → 400 kèm `errors: [{row, message}]` liệt kê
  TẤT CẢ dòng lỗi, KHÔNG ghi dòng nào (kể cả dòng hợp lệ đứng trước).
  **KHÔNG có route nào khác cho phép tạo mới `province_post_offices` /
  `commune_post_offices` / `post_offices`** (chỉ `scripts/seed.py` lúc đầu
  dự án) — route này TỰ resolve/tạo mới cả 3 cấp theo `code` (nếu đã có,
  chỉ cập nhật `name` nếu khác, không tạo trùng); tạo mới `brands` theo tên
  (upsert theo `name`); resolve/tạo mới `device_types` theo `danhMucCcdc`
  (tên THẬT, khác cột `loaiMay`) — danh mục mới BẮT BUỘC kèm
  `tienToDanhMucMoi` hợp lệ (regex `^[A-Z0-9]{2,5}$`, dùng chung
  `ASSET_PREFIX_REGEX` với `PUT /api/device-types/:id`) **CHỈ KHI** dòng đó
  đang tạo thiết bị MỚI (không có `maCcdc`) — dòng chỉ cập nhật thiết bị
  đã có thì không bắt buộc. Có `maCcdc` khớp thiết bị tồn tại (theo
  `asset_tag`, chưa soft-delete) → CẬP NHẬT, CHỈ ghi đè field có giá trị
  KHÔNG RỖNG trong dòng import (field rỗng/vắng mặt = giữ nguyên giá trị
  cũ, kể cả sub-field trong `specs`) — hỗ trợ export/import theo từng
  trường cần thiết mà không mất dữ liệu; KHÔNG đổi lại `asset_tag`. Có
  `maCcdc` nhưng KHÔNG khớp thiết bị nào → 400 rõ ràng (không tự tạo mới
  bằng mã đó). KHÔNG có `maCcdc` → TẠO MỚI, sinh `asset_tag` theo đúng cơ
  chế đã có (`<asset_prefix>-<YY>-<seq>`, dùng `namMua` hoặc năm hiện tại).
  Toàn bộ đợt bọc trong 1 `db.transaction()` — 1 dòng lỗi ở bất kỳ bước nào
  (b-f) → `throw` → better-sqlite3 tự rollback toàn bộ → 400. Trả về
  `{ provincesCreated, communesCreated, postOfficesCreated, brandsCreated,
  deviceTypesCreated, equipmentsCreated, equipmentsUpdated, errors: [] }`.
- Test: `tests/equipment-import-export.test.js` (mới, 93/93 test tự động
  pass tổng cộng `npm test`), phủ export đúng field, import tạo mới toàn bộ
  chuỗi tổ chức từ bưu cục hoàn toàn mới (kèm chạy lại lần 2 xác nhận không
  tạo trùng), import cập nhật qua `maCcdc` không mất field vắng mặt (kể cả
  sub-field `specs`), danh mục mới thiếu tiền tố → 400 rõ ràng + rollback
  không tạo device_type rác, thiếu `maMbc` → fail-fast không ghi dòng nào,
  và 1 test export rồi import lại chính dữ liệu đó → idempotent (0 created,
  toàn bộ thành updated, không tăng số lượng bản ghi tổ chức).
- Đã test thêm bằng curl trên DB tạm riêng (`os.tmpdir()`, kỹ thuật
  monkey-patch `better-sqlite3` giống `tests/helpers/serverHarness.js`) —
  xác nhận CÓ server production đang chạy sống (cổng 5000/3000) trước khi
  bắt đầu nên dùng port 5910 + DB tạm riêng, KHÔNG chạm `data/ccdc.db`
  (verify MD5 trước/sau giống hệt nhau): import bưu cục hoàn toàn mới →
  đúng số liệu tạo mới; export → đúng field; import lại NGUYÊN VẸN dữ liệu
  vừa export → 0 tạo mới, toàn bộ thành cập nhật, số lượng tỉnh/BĐX/bưu
  cục/thiết bị không đổi (idempotent); danh mục mới thiếu tiền tố → 400 rõ
  ràng; thiếu `maMbc` kèm 1 dòng hợp lệ đứng trước → 400 fail-fast, không
  ghi dòng nào (verify lại tổng số thiết bị không đổi).

## Frontend Import/Export Excel CCDC (mới, `feat/equipment-import-export-frontend`)
- `src/components/InventoryView.jsx`: thêm 2 nút "Export Excel" (glass-input,
  icon `Download`) và "Import Excel" (glass-input, icon `Upload`) cạnh nút
  "+ Thêm Thiết Bị CCDC" trong header. State modal (`showExportModal`/
  `showImportModal`) quản lý ngay trong component, không đụng `App.jsx`.
  Thêm 3 hàm `fetchCommunes`/`fetchDeviceTypes`/`fetchPostOffices` tách ra
  từ effect mount để gọi lại sau khi Import thành công (tạo mới bưu cục/
  danh mục cần cập nhật ngay các dropdown lọc).
- `src/components/ExportEquipmentModal.jsx` (mới): modal 2 phương án —
  "Đầy đủ" (31 cột đúng thứ tự chuẩn A-X + 7 cột mới) và "Theo từng trường
  cần thiết" (checkbox 31 cột tên tiếng Việt có dấu, cột "Mã CCDC" luôn
  tick + disable, kèm ghi chú "(bắt buộc — dùng để cập nhật khi import
  lại)"). Cả 2 phương án dùng ĐÚNG bộ lọc đang áp dụng trên `InventoryView`
  (search/BĐX/Bưu cục/Loại thiết bị/Phân loại chi tiết/Trạng thái) khi gọi
  `GET /api/equipments/export-data`. Dựng file `.xlsx` bằng `exceljs`
  (sheet "Dữ Liệu", dòng 1 header tiếng Việt có dấu) → tải xuống qua
  `Blob` + `<a download>`, hoàn toàn client-side.
- `src/components/ImportEquipmentModal.jsx` (mới): nút "Tải Template Mẫu"
  tự dựng `.xlsx` bằng `exceljs` ngay lúc bấm (không phải file tĩnh) — sheet
  "Dữ Liệu" (31 cột chuẩn + 2 dòng ví dụ minh hoạ TẠO MỚI/CẬP NHẬT) + sheet
  "Hướng Dẫn" (giải thích từng cột: tên, bắt buộc hay không, ý nghĩa, ví
  dụ). Input chọn file `.xlsx` → đọc bằng `exceljs`, map cột theo TÊN
  HEADER (không theo vị trí cột cố định) — hỗ trợ đọc lại cả file export
  dạng "rút gọn" (ít cột hơn 31, chỉ có cột đã tick + Mã CCDC) mà vẫn map
  đúng field. Hiện bảng xem trước tối đa 20 dòng (kèm tổng số dòng) trước
  khi cho Import thật. Gọi `POST /api/equipments/import` → hiện đủ 7 số
  liệu báo cáo (tỉnh/BĐX/bưu cục/hãng/danh mục mới tạo, thiết bị tạo mới/
  cập nhật) và liệt kê rõ từng dòng lỗi (`errors: [{row, message}]`) nếu
  validate fail-fast chặn cả file.
- Field JSON export ⇄ import dùng CHUNG key với backend
  (`GET /api/equipments/export-data` / `POST /api/equipments/import`,
  `feat/equipment-import-export-backend`) — copy chính xác từ báo cáo
  backend, không tự đặt tên khác. Bảng field đầy đủ: `03_ARCHITECTURE_MAP.md`.
- Đã test qua UI thật (Vite dev server thật port **3001** — port 3000 lúc
  này đang bị chiếm bởi `vite preview` phục vụ bản production build cũ,
  KHÔNG phải `vite dev`; backend thật port 5000). **Phát hiện quan trọng**:
  tiến trình backend production (`node server/index.js`, PID cũ 39260)
  tại thời điểm bắt đầu hạng mục này là bản CŨ khởi động TRƯỚC khi
  `feat/equipment-import-export-backend` merge vào main — dù file
  `server/index.js` trên đĩa đã có route mới, tiến trình Node đang chạy
  không tự nạp lại code (không có watch/nodemon) nên `GET
  /api/equipments/export-data` trả 404 trên server "thật". Đã xin phép PO
  qua `AskUserQuestion` trước khi restart (được đồng ý) — dừng PID cũ,
  chạy lại `node server/index.js` (cùng code, không đổi gì), xác nhận route
  hoạt động (200) trước khi tiếp tục test. **PO cần lưu ý**: server production
  cần được restart mỗi khi có code mới merge vào main (chưa có
  auto-deploy/watch).
  Test cụ thể: Tải Template Mẫu → capture Blob qua `URL.createObjectURL`
  hook + đọc lại bằng `exceljs` (Node) → xác nhận đúng 2 sheet, đúng 31 cột
  theo thứ tự chuẩn, sheet Hướng Dẫn có đủ nội dung. Export phương án Đầy
  Đủ (không lọc) → file tải về (60401 bytes, 354 dòng = header + 353 thiết
  bị thật) → đối chiếu 1 dòng thật (`CCDC-531130-6670`) khớp đúng dữ liệu
  DB. Export phương án Theo Trường (chỉ tick Tên Máy/Model/Trạng Thái) →
  file chỉ có đúng 4 cột (3 cột tick + Mã CCDC bắt buộc). Import 1 dòng bưu
  cục HOÀN TOÀN MỚI (`TESTPOIE01`/`TESTBDXIE01`, không có Mã CCDC) → tạo
  đúng 1 BĐX mới + 1 bưu cục mới + 1 hãng mới + 1 thiết bị mới (asset_tag
  tự sinh `PC-24-002`), xuất hiện ngay trong dropdown lọc (44→45 BĐX).
  Export lại chính thiết bị đó rồi Import lại CHỈ với 3 cột (Mã MBC/Mã
  CCDC/Model đổi giá trị) → CẬP NHẬT đúng 1 thiết bị (không tạo trùng),
  `asset_tag` không đổi, các field KHÔNG có trong dòng import
  (`hostname/serial_number/specs/notes/purchase_year`) giữ nguyên y hệt.
  Xoá sạch dữ liệu test (thiết bị + bưu cục + BĐX + hãng + tài khoản admin
  tạm) khỏi `data/ccdc.db` thật sau khi xong, verify lại đúng 353 thiết
  bị/44 BĐX/206 bưu cục/3 tài khoản gốc như trước khi bắt đầu.
- `npm test`: 93/93 pass (không đổi backend).

## Quản Lý Mạng Lưới API (mới, `feat/network-management-backend`, CHỈ BACKEND)
- **Quyết định Phương án B (PO chốt 2026-08-17)**: "Quản Lý Mạng Lưới" (đổi tên
  từ "Sơ Đồ BĐX & Bưu Cục") là danh mục chuẩn BẮT BUỘC. CHỈ các route mạng lưới
  (qua `resolveOrCreateOrgChain()`) mới được tạo mới Tỉnh/BĐX/Bưu cục. Equipment
  Import đổi sang CHẶN — xem `04_DECISIONS.md` mục 14.
- **Migration schema** (`server/db.js`): thêm **9 cột** vào `post_offices`
  (idempotent, cùng pattern các migration cũ): `old_ward_code`, `old_ward_name`,
  `district_name`, `new_ward_code`, `new_ward_name`, `phone`, `operational_status`
  (TEXT mặc định `'ACTIVE'`), `latitude` (REAL), `longitude` (REAL). Bưu cục cũ
  (353 bưu cục seed) có giá trị NULL ở cột mới — PO cập nhật dần qua Import.
- **Helper dùng chung** (`server/index.js`): `resolveOrCreateOrgChain(row, report,
  rowNum)` chứa NGUYÊN VẸN logic tự tạo Tỉnh→BĐX→Bưu cục (tách từ Equipment Import
  cũ), mở rộng lưu 9 cột mới khi tạo/cập nhật `post_offices` (update chỉ ghi đè
  field không rỗng). `requireExistingPostOffice(maMbc)` chỉ SELECT, KHÔNG tạo mới,
  throw lỗi rõ ràng nếu không thấy — dùng cho Equipment Import.
- `GET /api/network` — cần token + role quản lý: danh sách bưu cục (join
  commune/province lấy tên + `equipment_count`), hỗ trợ `search` (mã HOẶC tên),
  lọc `communeId`, phân trang (pattern `GET /api/equipments`).
- `POST /api/network/import` — cần token + role quản lý: nhận `{ rows: [...20 field] }`,
  validate fail-fast (thiếu `maMbc` → 400, không ghi gì), gọi `resolveOrCreateOrgChain`
  bọc `db.transaction()`. Trả `{ provincesCreated, communesCreated, postOfficesCreated,
  postOfficesUpdated, errors }`. ĐƯỢC PHÉP tạo mới tổ chức.
- `GET /api/network/export-data` — cần token + role quản lý: xuất toàn bộ bưu cục
  theo 20 field (cùng key với import), không phân trang. Bảng field: `03_ARCHITECTURE_MAP.md`.
- `PUT /api/network/post-offices/:id` — cần token + role quản lý: sửa 1 bưu cục
  (gồm 9 cột mới). Chỉ ghi đè field CÓ GỬI (undefined = giữ nguyên; '' = null,
  trừ `name` không cho rỗng, `communeId` validate tồn tại nếu đổi).
- `DELETE /api/network/post-offices/:id` — cần token + role quản lý: thử XOÁ CỨNG.
  FK enforcement bật sẵn (better-sqlite3 mặc định `foreign_keys=ON`) → nếu còn
  `equipments`/`users` tham chiếu → bắt `SQLITE_CONSTRAINT_FOREIGNKEY` → 400 "Bưu
  cục này đang có thiết bị/nhân sự liên kết, không thể xoá." KHÔNG thêm cột
  soft-delete mới cho `post_offices`.
- **20 field JSON** (import ⇄ export dùng CHUNG key): `maBdtTp/tenBdtTp` (tỉnh),
  `maBdx/tenBuuDienXa/buuDienXaTrungTam` (BĐX), `maMbc` (bắt buộc) `/tenBuuCuc/loai/
  diaChiChiTiet/maBdkv/tenBdkv` + 9 field mới `maPhuongXaCu/tenPhuongXaCu/tenQuanHuyen/
  maPhuongXaMoi/tenPhuongXaMoi/soDienThoai/tinhTrangHoatDong/viDo/kinhDo`.
- Test: `tests/network.test.js` (mới, port 5906, 17 test) + sửa 1 test trong
  `tests/equipment-import-export.test.js` (test "tạo mới toàn bộ chuỗi tổ chức" cũ →
  đổi thành "mã bưu cục chưa tồn tại → 400, không tự tạo, không ghi dòng nào").
  `npm test`: **111/111 pass**.
- Đã test thêm bằng curl trên DB tạm riêng (`os.tmpdir()`, port 5920, monkey-patch
  `better-sqlite3` giống test harness) — xác nhận CÓ server production đang chạy
  sống (cổng 5000/3000) trước khi test nên KHÔNG chạm `data/ccdc.db` (verify MD5
  trước/sau giống hệt): import mạng lưới mới từ đầu (2 bưu cục + 1 tỉnh + 1 BĐX, 9
  cột mới lưu đúng gồm latitude/longitude REAL); import CCDC với mã bưu cục KHÔNG
  có sẵn → 400 chặn rõ ràng + xác nhận KHÔNG tự tạo bưu cục; import CCDC với mã bưu
  cục CÓ sẵn → tạo được, provincesCreated/postOfficesCreated = 0; xoá bưu cục đang
  có thiết bị → 400 chặn, bưu cục vẫn còn; xoá bưu cục không tham chiếu gì → 200 xoá
  được; export 20 field đúng key.
- ✅ Drift READ-ONLY của `UnitTreeView.jsx` đã được xử lý ở `feat/network-management-frontend`
  (xem section "Frontend Quản Lý Mạng Lưới" ngay bên dưới).

## Frontend Quản Lý Mạng Lưới (mới, `feat/network-management-frontend`)
- `src/components/Sidebar.jsx`: đổi nhãn menu "Sơ Đồ BĐX & Bưu Cục" → "Quản Lý Mạng
  Lưới" (giữ nguyên `id: 'unittree'` + icon `Network`, không đổi gì khác trong
  `App.jsx` — component vẫn import từ đúng path cũ).
- `src/components/UnitTreeView.jsx`: **viết lại hoàn toàn** (giữ nguyên tên file/path
  để không phải sửa `App.jsx`) — từ cây tổ chức READ-ONLY thành bảng quản lý đầy đủ
  CRUD, theo đúng pattern `PersonnelView.jsx`/`InventoryView.jsx` (search + lọc BĐX +
  phân trang + nút Sửa/Xoá trên mỗi dòng). GỘP toàn bộ logic (list + 3 modal: Thêm/Sửa,
  Export, Import) vào 1 file để giữ đúng phạm vi giao (chỉ 2 file: Sidebar.jsx +
  UnitTreeView.jsx).
  - **"+ Thêm Bưu Cục"**: KHÔNG có route `POST /api/network/post-offices` riêng —
    dùng lại `POST /api/network/import` với `rows: [1 dòng]` (đúng 20 key Excel,
    `resolveOrCreateOrgChain()` tự tạo Tỉnh/BĐX nếu cần).
  - **"Sửa"**: `PUT /api/network/post-offices/:id` dùng bộ key KHÁC hẳn (tên cột DB
    thật: `name/type/address/communeId/bdkv_code/bdkv_name/old_ward_code/.../
    latitude/longitude`) — KHÔNG đổi được `code` (Mã MBC), KHÔNG tự tạo/đổi tên
    Tỉnh/BĐX, chỉ gán lại BĐX đã có sẵn qua dropdown `communeId`.
  - **"Xoá"**: `DELETE /api/network/post-offices/:id` — nếu backend trả 400 (còn
    thiết bị/nhân sự liên kết), hiện đúng message đó qua `alert()`, không phải lỗi
    JSON thô.
  - **Export/Import Excel**: theo đúng phong cách `ExportEquipmentModal.jsx`/
    `ImportEquipmentModal.jsx` — dùng `exceljs` client-side, map cột theo TÊN HEADER
    (không theo vị trí). "Tải Template Mẫu" tự dựng `.xlsx` 2 sheet ("Dữ Liệu" 20
    cột chuẩn + 2 dòng ví dụ TẠO MỚI/CẬP NHẬT, "Hướng Dẫn" giải thích từng cột).
  - Sau Sửa/Xoá/Import thành công: refetch danh sách + refetch `/api/organization/communes`
    (Import có thể tạo BĐX mới cần cập nhật ngay dropdown lọc).
- Field JSON Export/Import dùng CHUNG key với backend (`feat/network-management-backend`)
  — copy chính xác từ `03_ARCHITECTURE_MAP.md`, không tự đặt tên khác.
- Đã test qua UI thật (Vite dev port 3000 + backend thật port 5000). **Phát hiện quan
  trọng (lặp lại tình huống đã gặp ở `feat/equipment-import-export-frontend`)**: server
  production đang chạy lúc bắt đầu hạng mục là tiến trình CŨ, khởi động TRƯỚC khi
  `feat/network-management-backend` merge vào main — `GET /api/network` trả về HTML
  fallback (SPA catch-all) thay vì JSON dù route đã có trên đĩa. Đã xin phép PO qua
  `AskUserQuestion` trước khi restart (đồng ý), xác nhận route hoạt động (200 + JSON
  đúng) rồi mới tiếp tục test. **PO cần lưu ý (nhắc lại)**: server production cần
  restart thủ công mỗi khi có code mới merge vào main.
  Test cụ thể: Tải Template Mẫu → capture Blob + đọc lại bằng `exceljs` (Node) → đúng
  2 sheet, đúng 20 cột, sheet Hướng Dẫn đủ nội dung (23 dòng). Import 1 bưu cục hoàn
  toàn mới (`TESTBDXNETFE01`/`TESTPONETFE01`, đủ 9 field mới: phường/xã cũ-mới, quận/
  huyện, SĐT, trạng thái, toạ độ) → tạo đúng 1 BĐX mới + 1 bưu cục mới, hiện đúng
  trong danh sách (SĐT `0234555666`, toạ độ `16.5, 107.6`). Sửa bưu cục đó (đổi SĐT
  → `0234000111`, toạ độ → `16.777, 107.888`) → verify DB lưu đúng, field không sửa
  (`old_ward_code`...) giữ nguyên. Xoá bưu cục đó (chưa có thiết bị) → verify đã xoá
  cứng khỏi DB. Kiểm tra ngược sang "Quản Lý CCDC" → Import 1 thiết bị với mã bưu cục
  KHÔNG tồn tại (`MBC_KHONG_TON_TAI_FE`) → hiện đúng message *"Bưu cục
  MBC_KHONG_TON_TAI_FE chưa có trong hệ thống Quản Lý Mạng Lưới..."* ngay trong bảng
  xem trước, verify DB không tạo bưu cục "ma" lẫn thiết bị nào — xác nhận đúng thay
  đổi hành vi từ `feat/network-management-backend`. Xoá sạch dữ liệu test (trừ bưu
  cục đã xoá ở bước test Xoá) khỏi `data/ccdc.db` thật sau khi xong, verify lại đúng
  baseline (353 thiết bị/44 BĐX/206 bưu cục/3 tài khoản gốc).
- `npm test`: 111/111 pass (không đổi backend).

## Autocomplete Gán Người Sử Dụng (mới, `feat/personnel-autocomplete`)
- `src/components/EquipmentDetailModal.jsx` (chế độ Sửa) và
  `src/components/AddEquipmentModal.jsx`: ô nhập text tự do "Người Sử Dụng"
  cũ thay bằng ô tìm kiếm gõ-để-gợi-ý (autocomplete) — debounce ~300ms gọi
  `GET /api/personnel/search?q=...` qua `apiFetchJson` (route yêu cầu token +
  role quản lý). Gợi ý hiện dạng `Mã HRM-Họ Tên-Mã BC-Mã BĐX`.
- State mới `assignedUserId` đi kèm `rawUserName` (ô hiển thị): chọn 1 gợi ý
  → set cả 2; gõ tự do (không chọn gợi ý) → tự gỡ `assignedUserId` về `null`
  (chỉ `raw_user_name` được lưu dạng text thô). Lưu (Thêm mới/Sửa) gửi cả
  `assigned_user_id` (null nếu để trống) VÀ `raw_user_name` lên
  `POST/PUT /api/equipments`. Thiết bị đang có `assigned_user_id` sẵn (mở
  form Sửa) hiện đúng tên người đang gán trong ô ngay từ đầu.
- Logic autocomplete được viết lặp lại (duplicate) ở cả 2 file thay vì tách
  component dùng chung — đúng theo phạm vi hạng mục chỉ được sửa 2 file này.
- Đã test qua UI thật (Vite :3000 + backend thật :5000, xác nhận không có
  server production nào đang chạy trước khi khởi động; đồng thời phát hiện
  branch bị tạo lệch trước khi `feat/personnel-frontend` merge vào `main` —
  đã xoá branch cũ tạo lại đúng từ `main` mới nhất, xem `04_DECISIONS.md`
  mục 13): tạo 2 nhân sự test qua `POST /api/personnel` (curl) → gõ tên vào ô
  Sửa của 1 thiết bị có sẵn → gợi ý đúng định dạng → chọn → Lưu → verify
  `GET /api/equipments` trả đúng `assigned_user_id` → tạo thiết bị MỚI kèm
  gán qua autocomplete → verify `assigned_user_id` đúng ngay từ lúc tạo → tạo
  thiết bị MỚI để trống ô Người Sử Dụng → không lỗi, `assigned_user_id: null`
  → xoá gán (clear ô) trên thiết bị đã Sửa trước đó → Lưu → verify
  `assigned_user_id` về `null` → xoá sạch 2 thiết bị test + 2 nhân sự test +
  tài khoản admin tạm khỏi `data/ccdc.db` thật, verify lại còn đúng 2 tài
  khoản gốc (`admin`, `ADMIN01`) và 355 thiết bị (353 thật +
  2 dòng soft-delete lịch sử đã biết).
- `npm test`: 79/79 pass (không đổi backend).

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
