# 📝 AI-Assisted Changes Changelog

Ghi lại các thay đổi được thực hiện với hỗ trợ của AI/Claude Code.

---

## [2026-08-13] - Sửa thông tin user + Vô hiệu hoá/Kích hoạt lại tài khoản (feat/user-edit-deactivate)

### Changes
- **server/db.js**: thêm cột `users.deactivated_at DATETIME DEFAULT NULL` vào CREATE
  TABLE gốc + migration ALTER TABLE idempotent riêng cho DB đã tồn tại (copy đúng
  pattern đã dùng cho `equipments.deleted_at`).
- **server/index.js**:
  - `GET /api/users`: thêm `deactivated_at` vào SELECT (vẫn trả về CẢ user đã khoá,
    không ẩn như equipments soft-delete — quản lý cần thấy để biết ai đang bị khoá).
  - `POST /api/auth/login`: chặn đăng nhập nếu `user.deactivated_at` có giá trị, kể cả
    đúng mật khẩu → 401 message riêng "Tài khoản đã bị vô hiệu hoá, vui lòng liên hệ
    quản trị viên" (khác message sai mật khẩu). Check đặt SAU khi verify mật khẩu đúng
    để tránh lộ trạng thái khoá cho người chưa chứng minh biết mật khẩu.
  - `PUT /api/users/:id/deactivate` (mới): set `deactivated_at = CURRENT_TIMESTAMP`.
    Chặn tự vô hiệu hoá chính mình (so `req.user.id` với `:id`) → 400, copy đúng
    pattern đã dùng để chặn tự đổi role.
  - `PUT /api/users/:id/reactivate` (mới): set `deactivated_at = NULL`.
  - `PUT /api/users/:id` (route cũ, không đổi logic) — chỉ cần UI gửi đúng `full_name`.
  - Không sửa `server/auth.js`, dùng lại `authRequired`/`requireManager` nguyên trạng.
- **src/components/UserAdminView.jsx**: viết lại — gộp "Sửa Role" thành nút "Sửa" sửa
  cả `full_name` + `role` inline cùng lúc (dropdown role tự disable khi sửa chính
  mình); thêm cột "Trạng Thái" (badge "Đang hoạt động"/"Đã khoá", hàng mờ khi khoá);
  thêm nút "Vô Hiệu Hoá"/"Kích Hoạt Lại" (tự disable với chính mình, xác nhận bằng
  `window.confirm` trước khi vô hiệu hoá). Tất cả request ghi qua `apiFetchJson`.
- **tests/users.test.js**: thêm 6 test case cho `deactivate`/`reactivate` + login khi
  đã bị khoá (kể cả đúng mật khẩu vẫn bị chặn, message khác message sai mật khẩu).

### Reason
`PUT /api/users/:id` backend đã nhận `full_name` từ trước nhưng UI chưa có ô sửa tên
(chỉ có "Sửa Role"). Cũng chưa có cách nào khoá/mở lại 1 tài khoản — chỉ có xoá cứng
qua script Node thủ công (rủi ro, không thể khôi phục). Đóng nốt vòng lặp quản trị
user còn thiếu.

### Tested
`npm test`: 49 test cũ vẫn pass + 6 test mới → **55/55 pass**. UI thật (Vite :3000 →
Express :5000, Chrome thật): sửa tên user khác → đúng trên danh sách → vô hiệu hoá →
badge đổi "Đã khoá", hàng mờ, nút đổi "Kích Hoạt Lại" → đăng xuất → đăng nhập lại bằng
CHÍNH tài khoản vừa khoá với ĐÚNG mật khẩu → bị chặn, message "Tài khoản đã bị vô hiệu
hoá..." khác hẳn message sai mật khẩu → đăng nhập lại bằng quản lý → Kích Hoạt Lại →
đăng nhập lại bằng tài khoản đó → vào bình thường → thử tự vô hiệu hoá chính tài khoản
đang đăng nhập (nút đã tự disable trên UI + gọi API trực tiếp qua console) → 400 bị
chặn cả 2 cách. Xoá 2 user test khỏi DB thật sau khi xong, verify `equipments`/
`device_types`/2 user thật của hệ thống không đổi.

---

## [2026-08-12] - Vòng 2: dọn tooling, thêm test user-admin, rate-limit đăng nhập, hướng dẫn deploy

### Changes
- **`.claude/launch.json`**: xoá (lọt nhầm vào repo từ PR `feat/frontend-auth`, xem
  `04_DECISIONS.md` mục 6), thêm `.claude/` vào `.gitignore`.
- **`tests/users.test.js`** (mới): 15 test cho 5 route User Administration — bao phủ
  RBAC (STAFF bị 403), validate (thiếu field, password ngắn, trùng hrm_code), self-lock
  prevention (400 khi tự đổi role mình), và verify mật khẩu thật sự đổi được (login lại
  bằng mật khẩu cũ → 401, mật khẩu mới → 200).
- **`server/index.js`**: thêm rate-limit cho `POST /api/auth/login` — tối đa 5 lần sai
  trong 15 phút theo cặp (IP + hrm_code), lần thứ 6 trả `429` + header `Retry-After`
  (xem `04_DECISIONS.md` mục 7 để biết lý do thiết kế).
- **`tests/auth.test.js`**: thêm 2 test cho rate-limit (bị chặn ở lần 6; không ảnh hưởng
  tài khoản khác).
- **`docs/ai/06_DEPLOYMENT.md`** (mới): hướng dẫn set `JWT_SECRET` thật khi deploy
  production + checklist trước khi deploy.
- **`package.json`**: cập nhật script `test` để chạy thêm `tests/users.test.js`.

### Reason
Xử lý 2 việc còn lại trong backlog Vòng 2 (rate-limit, hướng dẫn JWT_SECRET) + 2 việc
phát sinh khi audit lại toàn bộ repo (file tooling lọt vào git, route user-admin thiếu
test tự động dù là route nhạy cảm nhất về bảo mật).

### Tested
Chạy lại toàn bộ test: **49/49 pass** (32 cũ + 15 user-admin + 2 rate-limit). Test rate-
limit thêm bằng `curl` trực tiếp vào server thật: 5 lần sai → 401, lần 6 (kể cả gửi
đúng mật khẩu) → `429` kèm `Retry-After: 900`.

---

## [2026-08-12] - Quản trị người dùng: tạo/sửa role/reset mật khẩu + tự đổi mật khẩu (feat/user-admin)

### Changes
- **server/index.js**: thêm 5 route mới trong mục "5. USER ADMINISTRATION API" (không
  sửa route cũ nào): `GET /api/users` (danh sách, không lộ `password_hash`),
  `POST /api/users` (tạo user, `hrm_code` unique, `password` >=6 ký tự, hash bằng
  `hashPassword`), `PUT /api/users/:id` (sửa full_name/role, chặn tự đổi role của chính
  mình), `PUT /api/users/:id/reset-password` (quản lý reset cho user khác, không cần mật
  khẩu cũ), `PUT /api/users/me/password` (tự đổi mật khẩu — chỉ cần `authRequired`, verify
  `currentPassword` bằng `verifyPassword`). Import thêm `hashPassword` từ `server/auth.js`
  (dùng lại, không viết lại logic hash).
- **src/components/UserAdminView.jsx** (mới): view "Quản Lý Người Dùng" — bảng user, nút
  Thêm User, sửa role inline (dropdown + Lưu/Hủy), nút Reset Mật Khẩu.
- **src/components/AddUserModal.jsx, ResetUserPasswordModal.jsx** (mới): modal tạo user
  và reset mật khẩu (không cần mật khẩu cũ, nhập mật khẩu mới 2 lần xác nhận khớp).
- **src/components/ChangePasswordModal.jsx** (mới): tự đổi mật khẩu, mở từ nút "Đổi Mật
  Khẩu" cạnh "Đăng Xuất" trong Header — cho MỌI user đã đăng nhập kể cả STAFF.
- **src/components/Sidebar.jsx**: thêm mục "Quản Lý Người Dùng", chỉ hiện khi
  `authUser.role !== 'STAFF'`.
- **src/App.jsx**: render `UserAdminView` khi tab `useradmin` (double-guard role !==
  STAFF); reset `activeTab` về `dashboard` khi đăng xuất (tránh màn hình trắng nếu đăng
  nhập lại bằng user khác trong lúc đang ở tab bị ẩn theo role).
- **src/components/Header.jsx**: thêm nút "Đổi Mật Khẩu" cạnh "Đăng Xuất".

### Reason
Bảng `users` đã có đủ cột nhưng chưa có route API nào để tạo/sửa user hay đổi mật khẩu —
phải chạy script Node thủ công, và chưa ai (kể cả người đang đăng nhập) tự đổi được mật
khẩu của chính mình. Đóng nốt vòng lặp quản trị user còn thiếu.

### Bug phát hiện + đã sửa khi test UI thật
`ChangePasswordModal` (`position: fixed inset-0`) bị "kẹt" ở góc trên màn hình thay vì
che toàn viewport — nguyên nhân: nút mở modal nằm trong `<header>` có class
`backdrop-blur-xl` (CSS `backdrop-filter` tạo containing block mới cho `position:
fixed`, một quirk CSS ít người biết). Sửa bằng `ReactDOM.createPortal` render thẳng vào
`document.body`, thoát khỏi mọi ancestor có thể gây containing-block tương tự.

### Tested
`npm test` (32 test cũ): vẫn 32/32 pass sau khi thêm route mới. UI thật (Vite :3000 →
Express :5000, Chrome thật): đăng nhập quản lý (`UA_MGR`) → vào Quản Lý Người Dùng → GET
/api/users trả đúng, verify bằng fetch thủ công không có `password_hash` trong response
→ tạo user STAFF mới (`UA_STAFF_TEST`) → đăng xuất → đăng nhập bằng user vừa tạo → vào
được, Sidebar KHÔNG có mục Quản Lý Người Dùng → tự đổi mật khẩu: sai mật khẩu hiện tại →
400 "Mật khẩu hiện tại không đúng" hiện rõ ràng; đúng → 200 thành công → đăng xuất →
đăng nhập lại bằng mật khẩu MỚI → vào được (xác nhận đổi thật có tác dụng) → đăng nhập
lại bằng `UA_MGR` → reset mật khẩu cho user test (200) → sửa role user test từ STAFF
sang MANAGER (200, badge cập nhật đúng) → xoá cả 3 user test (kể cả 1 user `TEST_LOGIN`
phát hiện sót từ phiên trước) khỏi DB thật sau khi xong, verify `users` table về 0 dòng.

---

## [2026-08-12] - Fix Dashboard đếm cả thiết bị đã soft-delete (trên branch feat/frontend-auth)

### Changes
- **server/index.js**: Thêm `deleted_at IS NULL` vào cả 8 câu query trong route
  `GET /api/dashboard/stats` (`totalAssets`, `activeAssets`, `allEquipments` dùng cho
  `lowSpecCount`/`win7Count`, `assetsByCommune`, `assetsByType`, `assetsByBrand`,
  `missingMac`, `missingIp`).

### Reason
Verify lại báo cáo `feat/frontend-auth` phát hiện drift #5 (`04_DECISIONS.md`) có phạm
vi rộng hơn báo cáo ban đầu — không chỉ `totalAssets` mà toàn bộ 8 query trong route.
Fix gọn, cùng 1 pattern, làm trực tiếp thay vì giao lại Dev AI khác.

### Tested
Chạy lại 32 test tự động hiện có (vẫn pass, không phá gì). Test thủ công: seed 1 thiết
bị rồi soft-delete → `GET /api/dashboard/stats` trả `totalAssets: 0` (đúng); xác nhận
trước khi sửa sẽ ra `totalAssets: 1` (sai, theo đúng mô tả drift).

---

## [2026-08-12] - Tích hợp Authentication vào Frontend (feat/frontend-auth)

### Changes
- **src/components/LoginView.jsx** (mới): form đăng nhập hrm_code + password, gọi
  `POST /api/auth/login`.
- **src/utils/api.js** (mới): helper `apiFetch`/`apiFetchJson` bọc fetch cho request ghi
  — tự gắn `Authorization: Bearer <token>`, tự xoá token + phát event khi 401 (quay về
  LoginView), gắn message tiếng Việt rõ ràng cho 403. Chỉ lưu token vào localStorage,
  không lưu password; tên/role hiển thị suy ra từ payload JWT (giải mã base64, không
  xác thực chữ ký phía client).
- **src/App.jsx**: thêm state `authUser`, đọc token đã lưu lúc khởi tạo (kiểm tra hết
  hạn qua claim `exp`), hiện LoginView thay Sidebar/Header/main content nếu chưa đăng
  nhập; lắng nghe event auto-logout.
- **src/components/Header.jsx**: thêm nút "Đăng Xuất" cạnh công tắc đổi theme; hiện tên/
  role thật thay vì text tĩnh.
- **src/components/AddCategoryModal.jsx, HrmMappingView.jsx, AddEquipmentModal.jsx,
  EquipmentDetailModal.jsx**: chuyển 4 chỗ gọi fetch ghi sang dùng `apiFetchJson`; thêm
  hiển thị lỗi trong UI (trước đây một số chỗ dùng `alert()`/không hiện lỗi).
- **EquipmentDetailModal.jsx**: thêm nút "Xoá Thiết Bị" (gọi `DELETE /api/equipments/:id`,
  route đã có sẵn ở backend nhưng UI chưa từng gọi tới).
- **.claude/launch.json** (mới, tooling): cấu hình chạy Vite dev server qua Browser tool
  để test UI thật (không phải app code).

### Reason
Backend đã yêu cầu JWT cho mọi route ghi từ bước `feat/auth-rbac`, nhưng frontend chưa
từng gọi `localStorage`/gắn header `Authorization` — mọi thao tác ghi trên UI (Thêm/Sửa/
Xoá thiết bị, Thêm danh mục, Import HRM) đang bị 401. Bước này đóng vòng lặp auth đầu-cuối.

### Tested (UI thật, không chỉ curl)
Chạy `npm run dev` (Vite :3000 proxy → Express :5000), thao tác qua Chrome thật:
đăng nhập sai mật khẩu → hiện lỗi "Mã HRM hoặc mật khẩu không đúng" (không phải JSON
thô); đăng nhập đúng (role quản lý) → vào Dashboard; thêm 1 thiết bị mới → 201 thành
công; sửa status thiết bị → 200 + badge "Đã lưu!"; xoá thiết bị → 200, biến mất khỏi
danh sách; đăng xuất → quay về LoginView, token xoá khỏi localStorage (verify bằng
`localStorage.getItem`); reload trang không token → bị chặn ngay, không thấy nội dung
chính; đăng nhập role STAFF → vào được app nhưng thao tác ghi (Thêm Danh Mục) → 403,
hiện banner lỗi tiếng Việt rõ ràng, không bị đá về LoginView (đúng vì 403 ≠ 401).

### Drift phát hiện (không tự sửa, xem `04_DECISIONS.md` mục 5)
Dashboard stats (`GET /api/dashboard/stats`) đếm cả thiết bị đã soft-delete vào
`totalAssets` — phát hiện khi test UI thật, ngoài phạm vi (không sửa `server/*.js`).

---

## [2026-08-12] - Test tự động cho 3 nhóm route quan trọng (test/core-routes)

### Changes
- **tests/helpers/serverHarness.js** (mới): harness khởi động server thật trong cùng
  tiến trình test, monkey-patch `better-sqlite3` (redirect DB sang file tạm) và
  `http.createServer` (bắt `http.Server` để đóng đàng hoàng sau test) — không sửa
  `server/index.js`/`server/db.js`/`server/auth.js`.
- **tests/helpers/fixtures.js** (mới): seed tối thiểu org tree + user (dùng `hashPassword`
  thật từ `server/auth.js`).
- **tests/auth.test.js** (mới, 13 case): login đúng/sai mật khẩu, route ghi không token/
  token rác → 401, role STAFF → 403, role quản lý → 200/201.
- **tests/equipments.test.js** (mới, 9 case): POST hợp lệ/thiếu field/device_type_id giả/
  hostname >255 ký tự, PUT status sai enum, vòng đời create→update→soft-delete→404→xoá
  lần 2 404, verify không phát sinh log rác khi request bị từ chối trước transaction.
- **tests/hrm.test.js** (mới, 10 case): input rỗng/không phải array → 400, fullName/hrmCode
  sai kiểu → 400 chặn fail-fast trước khi ghi DB, import tạo mới/cập nhật user + mapping
  đúng thiết bị theo tên chuẩn hoá, role STAFF → 403.
- **package.json**: thêm script `"test": "node --test tests/auth.test.js tests/equipments.test.js tests/hrm.test.js"`.
- **docs/ai/00_SNAPSHOT.md**: thêm mục "Test tự động", đánh dấu đã xử lý rủi ro "Chưa có
  test tự động". **docs/ai/03_ARCHITECTURE_MAP.md**: thêm mục mô tả kỹ thuật harness.

### Reason
Bổ sung test tự động cho 3 nhóm route quan trọng nhất (auth/RBAC, equipments CRUD +
soft-delete, HRM auto-mapping) theo yêu cầu PO, dùng `node:test` built-in thay vì Jest để
không thêm dependency mới. Framework chọn evidence-based: kiểm tra `package.json` trước,
xác nhận chưa có framework test nào.

### Tested
`npm test` (node --test): **32/32 test pass, 0 fail**, exit code 0, tự thoát sạch (không
cần kill tiến trình). Verify bằng hash MD5 `data/ccdc.db` trước/sau chạy suite — không đổi
(`00f62d3885510e1a25d2491fba33b1fe`) — xác nhận test không đụng DB thật. File DB tạm trong
`os.tmpdir()` được tự dọn sau mỗi lần chạy (kể cả file `-wal`/`-shm`).

---

## [2026-08-12] - Gộp bước Soft-delete+Transaction với Input Validation (combined-fix)

### Changes
- **server/db.js**: Thêm cột `equipments.deleted_at` (migration idempotent).
- **server/index.js**: Gộp thủ công 2 nhánh từng bị chạy chồng lấn ngoài dự kiến —
  soft-delete + transaction (route `DELETE /api/equipments/:id`, bọc `db.transaction()`
  cho create/update/delete equipment + cả đợt import HRM) VÀ input validation (giữ
  nguyên logic từ `feat/input-validation`, khớp với báo cáo gốc).
- **docs/ai/**: Khôi phục `01_ROLES.md`, `02_WORKFLOW.md`, `05_BACKLOG.md`, `prompts/`
  (bị mất khi `feat/auth-rbac` viết đè cả thư mục); viết lại `README_AI.md` để trỏ đủ
  9 file; thêm 2 mục drift + khôi phục quyết định phân quyền vào `04_DECISIONS.md`.

### Reason
`feat/input-validation` được tạo trước khi `feat/soft-delete-transactions` được merge,
nên 2 bước bị lệch thứ tự so với kế hoạch phụ thuộc trong `05_BACKLOG.md`. Gộp thủ công
để đưa cả 2 vào cùng 1 bản, tránh phải merge riêng rồi xử lý conflict trên GitHub.

### Tested
Test thủ công bằng curl (server local :5000), 10 kịch bản: create hợp lệ (201); create
device_type_id giả (400); create hostname >255 ký tự (400); update status sai enum
(400); update status hợp lệ (200, transaction vẫn chạy); tạo device-type tên có ký tự
đặc biệt (400); tạo device-type tên có dấu tiếng Việt hợp lệ (201); soft-delete (200);
list sau khi xoá không còn thấy; HRM import fullName sai kiểu bị chặn fail-fast trước
khi ghi DB (400). Tất cả đúng kỳ vọng.

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

## [2026-08-12] - Fix Documentation Drift (fix/docs-drift)

### Changes
- **README.md**: Sửa lại mục "Công Nghệ Sử Dụng" - bỏ "Prisma 3NF" khỏi Backend stack, chỉ để "SQLite (better-sqlite3)" để phản ánh đúng dependency thực tế.
- **package.json**: Cập nhật script `seed` từ `node scripts/seed_from_excel.js` (file không tồn tại) thành `python scripts/seed.py` (file thực tế đang có).

### Reason
Xóa 2 điểm drift được phát hiện giữa tài liệu (docs) và thực tế mã nguồn/package.json.

### Related Issue
- docs/ai/04_DECISIONS.md - Drift phát hiện (sections 1 & 2)

---
