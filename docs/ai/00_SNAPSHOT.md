# 00 — SNAPSHOT Dự Án (it-assets / Quản lý CCDC Bưu điện Huế)

> **File này CHỈ ghi trạng thái HIỆN TẠI** — không phải nhật ký. Lịch sử đầy đủ từng PR
> (bao gồm mọi bước test qua UI thật) nằm ở `CHANGELOG_AI.md` (mới nhất ở đầu file).
> Quyết định nghiệp vụ + drift phát hiện nằm ở `04_DECISIONS.md` (append-only, đánh số).
> File này được nén lại 2026-08-18 (từ 665 dòng xuống ~200) để tiết kiệm token đọc mỗi
> task — nếu thấy file này lại phình to dần theo mỗi PR, ĐÓ LÀ DẤU HIỆU SAI, hãy nén lại
> theo đúng tinh thần này thay vì thêm mục "mới, feat/X" cho từng PR.

**Baseline dữ liệu thật (cập nhật 2026-08-18)**: 332 thiết bị / 185 bưu cục / 44 BĐX /
3 tài khoản đăng nhập gốc (`admin`, `ADMIN01`, `00100397`). Hệ thống chạy thật trên LAN
nội bộ tại `http://10.47.33.33:3000` (xem `06_DEPLOYMENT.md` mục 4 — server cần restart
thủ công sau mỗi lần merge vào `main`, chưa có auto-deploy).

## Tổng quan
- **Loại**: Fullstack quản lý Công cụ Dụng cụ (CCDC) CNTT cho Bưu điện Tỉnh TT-Huế (Mã 53).
- **Backend**: Node.js + Express (`server/index.js`, ~1900 dòng), SQLite qua
  `better-sqlite3` (`server/db.js`). Auth: JWT (`jsonwebtoken`) + `crypto.scrypt` built-in.
- **Frontend**: React 19 + Vite + TailwindCSS v4 (`src/`). Bản đồ: `leaflet`+`react-leaflet`.
- **Test**: `node:test` built-in, **118 test case** trong `tests/*.test.js`, chạy
  `npm test`. DB test dùng bản tạm cô lập (`os.tmpdir()` hoặc monkey-patch), không đụng
  `data/ccdc.db` thật.
- **Data ingestion gốc**: Python seeder `scripts/seed.py` từ `dulieu.xlsx` (chạy 1 lần
  lúc khởi tạo dự án — **KHÔNG chạy lại**, sẽ xoá sạch DB thật, xem `04_DECISIONS.md`).

## Bảng dữ liệu chính (`server/db.js`)
- `province_post_offices` (BĐT/TP) → `commune_post_offices` (BĐX) → `post_offices`
  (MBC/Bưu cục — có 9 cột mở rộng: `old_ward_code/name`, `district_name`,
  `new_ward_code/name`, `phone`, `operational_status`, `latitude`, `longitude`, và
  `responsible_user_id` liên kết `users`, không có FK cứng).
- `users` — dùng CHUNG 2 mục đích: tài khoản đăng nhập (`role`, `password_hash`,
  `deactivated_at`) VÀ danh bạ "Người Sử Dụng" (`hrm_code/full_name/post_office_code/
  commune_code`, không có mật khẩu). Phân biệt: `password_hash IS NOT NULL` = tài khoản
  đăng nhập thật.
- `device_types` (`asset_prefix` — tiền tố sinh mã CCDC), `brands`,
  `equipments` (CCDC — `specs` JSON gồm `category_raw`/`cpu`/`ram`/`storage`/`os`,
  `deleted_at` soft-delete, `purchase_year`, `assigned_user_id` liên kết `users` không
  FK cứng), `asset_transfer_logs` (lịch sử, KHÔNG có soft-delete — xoá cứng equipment
  phải xoá log trước để tránh lỗi FK).

## API hiện có (`server/index.js`) — theo module

**Auth** (`server/auth.js` middleware: `authRequired`, `requireManager`)
- `POST /api/auth/login` — trả JWT. Rate-limit 5 lần sai/15 phút theo (IP+hrm_code) →
  429. Tài khoản `deactivated_at` bị chặn (401, message riêng, check SAU khi verify mật
  khẩu để không lộ trạng thái).
- `PUT /api/users/me/password` — chỉ cần token (mọi role), yêu cầu mật khẩu cũ đúng.

**Equipments** (CCDC)
- `GET /api/equipments`, `GET /api/equipments/:id` — mở, không cần token. Loại trừ
  `deleted_at`. Lọc: `search/communeId/postOfficeId/deviceTypeId/categoryRaw/status`.
- `GET /api/equipments/category-raw-options` — mở, danh sách `specs.category_raw` khác
  nhau (tuỳ chọn lọc `deviceTypeId`), dùng cho dropdown "Phân Loại Chi Tiết".
- `POST /api/equipments`, `PUT /api/equipments/:id` — cần token + quản lý. Sinh
  `asset_tag` mới `<PREFIX>-<YY>-<seq>` (xem mục Business Rules); nhận
  `assigned_user_id` (validate tồn tại), `purchase_year`, `category_raw`. Bọc transaction.
- `DELETE /api/equipments/:id` — cần token + quản lý. Soft-delete (`deleted_at`).
- `GET /api/equipments/export-data`, `POST /api/equipments/import` — cần token + quản
  lý. 31 field (24 cột gốc Excel A-X + 7 field mới: `maCcdc/danhMucCcdc/
  tienToDanhMucMoi/namMua/maHrmNguoiSuDung/trangThai/ghiChu`). Import: fail-fast
  (`maMbc` + (`tenMay` HOẶC `maCcdc`) bắt buộc); có `maCcdc` khớp → UPDATE (chỉ field
  không rỗng); không có → CREATE. **KHÔNG tự tạo Tỉnh/BĐX/Bưu cục** (phải đã có sẵn
  trong Quản Lý Mạng Lưới, xem Business Rules). Bảng field đầy đủ: `03_ARCHITECTURE_MAP.md`.

**Device Types (Danh Mục)**
- `GET /api/device-types` — mở. `POST`, `PUT /:id` — cần token + quản lý (`asset_prefix`
  regex `^[A-Z0-9]{2,5}$`).

**Users (Quản Lý Người Dùng — chỉ tài khoản có mật khẩu)**
- `GET/POST /api/users`, `PUT /api/users/:id` — cần token + quản lý. Chặn tự đổi role
  chính mình. `SELECT` tường minh, không bao giờ trả `password_hash`.
- `PUT /api/users/:id/reset-password`, `/deactivate`, `/reactivate` — cần token + quản
  lý. Chặn tự vô hiệu hoá chính mình.

**Personnel (Người Sử Dụng — toàn bộ bảng `users`, không lọc mật khẩu)**
- `GET/POST /api/personnel`, `PUT/DELETE /api/personnel/:id` — cần token + quản lý.
  `DELETE` = soft (`deactivated_at`), CHẶN nếu người đó có `password_hash` (bảo vệ tài
  khoản đăng nhập, hướng dẫn dùng "Quản Lý Người Dùng" thay thế).
- `GET /api/personnel/search?q=` — cần token + quản lý, tối đa 10 kết quả, dùng cho
  autocomplete gán "Người Sử Dụng" ở form thiết bị.
- `POST /api/personnel/import` — cần token + quản lý. UPSERT theo `hrm_code`, fail-fast.

**Network (Quản Lý Mạng Lưới — danh mục chuẩn BẮT BUỘC, xem Business Rules)**
- `GET /api/network` — cần token + quản lý. Join tên BĐX/Tỉnh + `equipment_count` +
  `responsible_user_name/hrm`. Lọc `search` (mã/tên/loại/tình trạng), `communeId`.
- `POST /api/network/import` — cần token + quản lý. **ĐƯỢC PHÉP** tạo mới Tỉnh/BĐX/Bưu
  cục (duy nhất route có quyền này). 21 field (20 cột gốc + `maHrmNguoiPhuTrach`).
- `GET /api/network/export-data`, `PUT /api/network/post-offices/:id`,
  `DELETE /api/network/post-offices/:id` — cần token + quản lý. DELETE xoá CỨNG, bắt lỗi
  FK nếu còn thiết bị/nhân sự liên kết (không có cột soft-delete riêng).
- Bảng 21 field đầy đủ: `03_ARCHITECTURE_MAP.md`.

**Dashboard & Organization**
- `GET /api/dashboard/stats` — mở. Toàn bộ 9 chỗ đếm/lọc đều có `deleted_at IS NULL`.
- `GET /api/organization/*` — mở (dùng cho dropdown BĐX/Bưu cục cascading).

## Business Rules quan trọng (áp dụng xuyên suốt, PHẢI biết trước khi sửa)
1. **Phân quyền**: nhị phân — `STAFF` = chỉ đọc, mọi role khác = ghi đầy đủ (không tách
   chi tiết theo role gốc). Quyết định cố định, xem `04_DECISIONS.md`.
2. **Lược đồ mã CCDC**: `<PREFIX>-<YY>-<seq 3 số>` (`PREFIX` = `device_types.asset_prefix`,
   `YY` = 2 số cuối `purchase_year`, `seq` = MAX hiện có +1, tính trong transaction, LIKE
   không lọc `deleted_at` để không tái dùng số cũ). Danh mục chưa có `asset_prefix` → 400
   khi tạo thiết bị mới. **Thiết bị cũ giữ nguyên mã cũ `CCDC-<mã bc>-<seq>`, KHÔNG migrate.**
3. **Soft-delete**: `equipments.deleted_at`, `users.deactivated_at` — cùng pattern, GET
   mặc định loại trừ (riêng `GET /api/users` vẫn hiện user đã khoá để quản lý thấy).
   `post_offices` KHÔNG có soft-delete, chỉ xoá cứng có bắt lỗi FK.
4. **Quản Lý Mạng Lưới = danh mục chuẩn bắt buộc (Phương án B)**: CHỈ route Network mới
   được tạo mới Tỉnh/BĐX/Bưu cục. Equipment Import CHẶN nếu bưu cục chưa có sẵn (400,
   không tự tạo). Xem `04_DECISIONS.md` mục 14.
5. **Transaction**: mọi thao tác ghi kép (insert/update + insert log, hoặc resolve tổ
   chức + insert thiết bị) đều bọc `db.transaction()` — lỗi giữa chừng tự rollback, không
   để lại dữ liệu/log rác.
6. **Update qua Excel chỉ ghi đè field CÓ giá trị** — field rỗng/vắng mặt trong dòng
   import = giữ nguyên dữ liệu cũ (áp dụng cả Equipment lẫn Network import), kể cả
   sub-field trong `specs` JSON.
7. **`git add <file>` cụ thể, KHÔNG BAO GIỜ `git add .`** — đã 2+ lần file thừa lọt vào
   commit vì thói quen này, xem `04_DECISIONS.md` mục 9.

## Frontend hiện có (`src/components/`)
- **Auth**: `LoginView.jsx`, `Header.jsx` (đăng xuất, đổi mật khẩu, đổi theme),
  `utils/api.js` (`apiFetchJson` tự gắn token, tự xử lý 401/403).
- **Sidebar**: submenu động (theo `device_types` thật) cho "Quản Lý CCDC"; submenu tĩnh
  3 mục cho "Quản Lý Mạng Lưới".
- **Quản Lý CCDC**: `InventoryView.jsx` (bảng, lọc BĐX/Bưu cục/Loại/Phân Loại Chi
  Tiết/Trạng thái, nút Export/Import Excel), `AddEquipmentModal.jsx`/
  `EquipmentDetailModal.jsx` (autocomplete "Người Sử Dụng" qua `GET /api/personnel/search`),
  `ExportEquipmentModal.jsx`/`ImportEquipmentModal.jsx`, `AddCategoryModal.jsx`,
  `CategoryAdminView.jsx` ("Quản Lý Danh Mục", sửa `asset_prefix` inline).
- **Quản Lý Người Dùng**: `UserAdminView.jsx`, `AddUserModal.jsx`,
  `ResetUserPasswordModal.jsx`, `ChangePasswordModal.jsx`.
- **Người Sử Dụng**: `PersonnelView.jsx` (Sửa/Xoá inline), `AddPersonnelModal.jsx` (kiêm
  Sửa), `ImportPersonnelModal.jsx` (đọc `.xlsx` thật bằng `exceljs` client-side).
- **Quản Lý Mạng Lưới** (3 submenu qua state `networkSubView` trong `App.jsx`):
  `NetworkListView.jsx` (bảng gộp-cell 5 cột: Mã&Tên/Địa Chỉ&Liên Hệ/Toạ Độ&Bản Đồ
  (link Google Maps)/Trạng Thái&CCDC/Thao Tác — 4 dropdown lọc động + Export/Import +
  autocomplete "Người Phụ Trách"), `NetworkTreeView.jsx` (cây phân cấp READ-ONLY, khôi
  phục nguyên bản từ trước khi có bảng CRUD), `NetworkMapView.jsx` (bản đồ Leaflet thật,
  `CircleMarker` màu theo tình trạng + bán kính theo số thiết bị).

## Chưa có / rủi ro (còn lại — không khẩn cấp)
- ⚠️ **JWT_SECRET mặc định cho DEV** — hướng dẫn set thật ở `06_DEPLOYMENT.md`, PO tự
  làm khi deploy (thao tác vận hành, không phải code).
- ⚠️ Chưa có refresh token — token hết hạn phải đăng nhập lại thủ công.
- ⚠️ Import HRM/Equipment/Network cả đợt chạy 1 transaction — lỗi 1 dòng rollback toàn
  bộ, phải chạy lại từ đầu (đánh đổi có chủ đích).
- ⚠️ Chưa có CI (phải tự gõ `npm test`, không tự chạy trên GitHub).
- ⚠️ Rate-limit đăng nhập lưu trong bộ nhớ tiến trình — không đúng nếu scale nhiều
  instance (cần Redis lúc đó, chưa cần ở quy mô hiện tại).
- ⚠️ `NetworkMapView.jsx` chưa có nút "Xem thiết bị tại đây" (điều hướng sang CCDC lọc
  theo bưu cục) — `InventoryView.jsx` chưa hỗ trợ nhận `postOfficeId` lọc sẵn từ ngoài.
- ⚠️ Dự án nằm trong thư mục đồng bộ OneDrive (`E:\OneDrive\...`) — có thể gây xung đột
  khoá file giữa Git (tự dọn `.git/objects/` sau commit) và OneDrive đang đồng bộ cùng
  lúc. Chưa nghiêm trọng (chưa gây mất dữ liệu), cân nhắc chuyển dự án ra ngoài OneDrive
  nếu lặp lại nhiều.

## ✅ Đã hoàn tất (không cần làm lại)
Vòng 1 (Auth/RBAC/soft-delete/transaction/validate/test/frontend-login/dashboard-fix),
Vòng 2 (User Admin/rate-limit), Lược đồ mã CCDC, Module Người Sử Dụng đầy đủ (CRUD +
import + autocomplete), Import/Export Excel CCDC 2 chiều, Quản Lý Mạng Lưới đầy đủ
(CRUD + Import/Export + 3 submenu + Người Phụ Trách + Bản Đồ), dọn 21 bưu cục rác baseline
(mục `04_DECISIONS.md` #15). Chi tiết từng bước + bằng chứng test: `CHANGELOG_AI.md`.
