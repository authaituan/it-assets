# 📝 AI-Assisted Changes Changelog

Ghi lại các thay đổi được thực hiện với hỗ trợ của AI/Claude Code.

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
