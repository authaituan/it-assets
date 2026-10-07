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
thủ công sau mỗi lần merge vào `main`, chưa có auto-deploy). **Production (LAN) vẫn chạy bản
cũ (trước Soft UI) cho đến khi PO ra lệnh triển khai.**

## Tổng quan
- **Loại**: Fullstack quản lý Công cụ Dụng cụ (CCDC) CNTT cho Bưu điện Tỉnh TT-Huế (Mã 53).
- **Backend**: Node.js + Express (`server/index.js` chỉ bootstrap ~77 dòng; route ở `server/routes/*`, hàm dùng chung ở `server/lib/*`), SQLite qua
  `better-sqlite3` (`server/db.js`). Auth: JWT (`jsonwebtoken`) + `crypto.scrypt` built-in.
- **Frontend**: React 19 + Vite + TailwindCSS v4 (`src/`). Bản đồ: `leaflet`+`react-leaflet`.
  Giao diện **Soft UI**: token màu/font ở `src/index.css` (`@theme`: `--color-primary` v.v.,
  font Inter; nút chính dùng `#CC4A0A`, xem `04_DECISIONS.md` #17). Tên hệ thống: "Hệ thống
  Quản lý Danh mục và Tài nguyên CNTT" (`<title>` ở `index.html`, Sidebar, trang đăng nhập).
  Bundle JS chính ~1.9MB (chưa code-splitting, xem `05_BACKLOG.md`).
- **Test**: `node:test` built-in, **202 test case** (`npm run build` OK) trong `tests/*.test.js`, chạy
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
- `dashboard_widgets` (Dashboard động, cấu hình áp dụng cho MỌI người dùng): `kind` SYSTEM|CHART,
  `system_key` UNIQUE (KPI_SUMMARY, IT_WARNINGS, UPGRADE, RECENT_ACTIVITY, EMAIL_STATS; NULL với CHART),
  `title`, `source`/`group_by`/`chart_type`/`top_n`/`filters` (JSON) cho CHART, `size` S|M|L|XL|FULL
  (lưới 12 cột: 3/4/6/8/12), `position`, `visible`. Migration idempotent ở `db.js`; seed 9 ô mặc định
  (tái hiện Dashboard cũ) khi bảng RỖNG.
- `emails` (module Quản lý email): `email` UNIQUE NOCASE, `kind` UNIT|PERSONAL, `hrm_code`
  (liên kết LỎNG tới `users`, không FK), `full_name`, `phone`, `commune_id`/`post_office_id`
  (FK, NULL được), `job_title`, `created_date`, `revoked_date` (ISO). KHÔNG có cột status:
  `revoked_date` NULL = Đang sử dụng, có ngày = Đã thu hồi.

## API hiện có (`server/routes/*`, mount ở `server/index.js`) — theo module

**Lớp bảo mật** (`server/security.js`, gắn đầu `server/index.js` — `feat/ip-allowlist-security`)
- Lọc IP toàn hệ thống theo `CMS_ALLOWED_IPS` (IP/CIDR IPv4, phẩy; trống = chỉ máy chủ
  127.0.0.1/::1; `*` = mọi IP). IP bị chặn → trang 404 (`server/pages/404.html`, CSS
  nhúng + CSP mã băm) hoặc 404 JSON cho `/api/*`, không lộ hệ thống (404 thay vì 403).
- `TRUSTED_PROXIES`: chỉ tin `X-Forwarded-For` khi kết nối đến từ proxy khai báo, đọc từ
  phải sang trái (không giả được). IP thật ở `req.clientIp`.
- **Mọi `/api/*` trừ `POST /api/auth/login` bắt buộc token** (middleware toàn cục, mặc
  định chặn cả route thêm sau này). Không CORS; header nosniff/X-Frame-Options/
  Referrer-Policy/Permissions-Policy/COOP; `/api` `Cache-Control: no-store`; tắt X-Powered-By.
- `JWT_SECRET` bắt buộc: thiếu thì server không khởi động (trừ `ALLOW_INSECURE_DEV=1`, chỉ dev).
  `server/index.js` tự nạp `.env` bằng `process.loadEnvFile()` (biến hệ thống thắng `.env`).
- Body: `/api/auth/login` tối đa 10kb; `express.json(50mb)` chỉ áp sau lớp bắt buộc token.
  Trang 404 chuẩn hoá CRLF→LF trước khi băm CSP (`.gitattributes` ép LF cho `server/pages/*.html`).
- Nhật ký `data/security.log` (`SECURITY_LOG`): `ip_denied` (1 dòng/IP/phút),
  `login_ok/login_fail/login_limited/login_deactivated` — không ghi mật khẩu/token.

**Auth** (`server/auth.js` middleware: `authRequired`, `requireManager`)
- `POST /api/auth/login` — trả JWT. Rate-limit 5 lần sai/15 phút theo (IP+hrm_code), cộng
  trần theo IP `LOGIN_IP_MAX_FAILS` (mặc định 20 lần sai/15 phút, mọi tài khoản) → 429. Tài khoản `deactivated_at` bị chặn (401, message riêng, check SAU khi verify mật
  khẩu để không lộ trạng thái).
- `PUT /api/users/me/password` — chỉ cần token (mọi role), yêu cầu mật khẩu cũ đúng.

**Equipments** (CCDC)
- `GET /api/equipments`, `GET /api/equipments/:id` — cần token (mọi role). Loại trừ
  `deleted_at`. Lọc: `search/communeId/postOfficeId/deviceTypeId/categoryRaw/status`.
- `GET /api/equipments/category-raw-options` — cần token, danh sách `specs.category_raw` khác
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
- `GET /api/device-types` — cần token. `POST`, `PUT /:id` — cần token + quản lý (`asset_prefix`
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
  FK nếu còn thiết bị/nhân sự/email liên kết (không có cột soft-delete riêng).
- Bảng 21 field đầy đủ: `03_ARCHITECTURE_MAP.md`.

**Emails (Quản lý email — `server/routes/emails.js`)**
- `GET /api/emails` — mọi tài khoản đăng nhập (kể cả STAFF). `page/limit`, `search`
  (chuẩn hoá email/họ tên/HRM/SĐT, đ=d), `kind`, `status=ACTIVE|REVOKED`, `communeId`,
  `postOfficeId`; trả kèm `status` suy ra + `commune_*`/`post_office_*`.
- Ghi/import/export cần token + quản lý: `POST /api/emails`, `PUT /api/emails/:id`,
  `PUT /api/emails/:id/revoke` (`revoked_date` tuỳ chọn, mặc định hôm nay),
  `PUT /api/emails/:id/reactivate` (xoá ngày thu hồi), `POST /api/emails/import`
  (`{rows}`: email, loai, maHrm, hoTen, soDienThoai, maBdx, maBuuCuc, chucDanh, trangThai,
  ngayKhoiTao, ngayThuHoi), `GET /api/emails/export-data` (cùng bộ lọc, key Excel). Không xoá cứng.
- Quy tắc: email lowercase+trim, đúng định dạng, duy nhất; UNIT không HRM, PERSONAL bắt buộc
  HRM; ngày dd/mm/yyyy hoặc yyyy-mm-dd phải thật; thu hồi không trước khởi tạo.
- Import: kiểm tra toàn bộ trước (lỗi gom theo dòng, tối đa 100) → có lỗi thì không ghi gì →
  1 transaction; cập nhật theo email, ô trống = giữ cũ. Mã BĐX/bưu cục lạ → lỗi, KHÔNG BAO GIỜ
  tạo tổ chức (04_DECISIONS #14). Email cá nhân đang dùng có HRM chưa có → tạo `users`
  (không mật khẩu); HRM đã có → giữ nguyên + `warnings`; dòng đã thu hồi → không tạo nhân sự.
  `POST /api/emails`, `PUT /api/emails/:id` (khi sau sửa là cá nhân đang dùng có HRM) và `reactivate` dùng cùng logic (trả `personnelCreated` + `warnings`). Import trả `{created, updated, personnelCreated, warnings}`.

**Dashboard & Organization**
- `GET /api/dashboard/stats` — cần token. Toàn bộ 9 chỗ đếm/lọc đều có `deleted_at IS NULL`.
- **Dashboard động** (`server/routes/dashboardWidgets.js`, whitelist ở `server/lib/dashboardSources.js`,
  mặc định ở `server/lib/dashboardDefaults.js`): `GET /api/dashboard/widgets` (mọi người; ADMIN thấy cả ô
  ẩn, người khác chỉ `visible`), `GET /api/dashboard/widgets-data` (mọi người; dữ liệu mọi ô CHART đang
  hiện, lỗi 1 ô → `{error}` riêng; `?include_hidden=1` chỉ ADMIN mới tính thêm ô ẩn), `GET .../widgets-meta` (ADMIN; whitelist cho giao diện chỉnh sửa),
  `POST .../widgets-preview` (ADMIN; xem trước cấu hình CHƯA lưu, không ghi DB, trả
  `{data:{total,items,other?}}`), `POST .../widgets` (tối đa 30 ô), `PUT .../widgets/:id`, `DELETE .../widgets/:id`,
  `PUT .../widgets-order {ids}`, `POST .../widgets-reset` — **ghi = chỉ ADMIN** (`requireAdmin` ở `auth.js`,
  role khác kể cả MANAGER → 403). Nguồn: EQUIPMENT / EMAIL / POST_OFFICE; số liệu v1 chỉ COUNT; mọi
  `source`/`group_by`/`chart_type`/khóa lọc phải thuộc whitelist (khóa lạ → 400), giá trị lọc qua tham số
  `?`; NULL/rỗng → "Chưa xác định". Ô SYSTEM chỉ đổi `title`/`size`/`visible` (không xoá, key khác bị
  bỏ qua). `LINE` chỉ cho trường có thứ tự; `NUMBER` bắt buộc `group_by` null; `top_n` 3..30, phần dư
  gộp vào `other`. Chi tiết quyết định: `04_DECISIONS.md` #20–#24.
- `GET /api/organization/*` — cần token (dùng cho dropdown BĐX/Bưu cục cascading).

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
- **Auth**: `LoginView.jsx` (trang đăng nhập mới: 2 thẻ chồng — ảnh cà phê
  `public/login-hero.jpg` + form; logo `public/logo-vnpost.png`; font Montserrat CHỈ dùng ở
  trang này, lớp `.login-montserrat`), `Header.jsx` (ô tìm kiếm, đăng xuất, đổi mật khẩu),
  `utils/api.js` (`apiFetchJson` tự gắn token, tự xử lý 401/403).
- **Sidebar**: `Sidebar.jsx` (hiện tên hệ thống mới, menu Sentence case); submenu động (theo `device_types` thật) cho "Quản Lý CCDC"; submenu tĩnh
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
- **Quản Lý Email**: `EmailListView.jsx` (bảng quản lý email công vụ đơn vị/cá nhân, bộ lọc động 4 dropdown, Thêm/Sửa/Thu hồi/Kích hoạt lại + Import/Export Excel).

## Chưa có / rủi ro (còn lại — không khẩn cấp)
- ⚠️ **Máy chủ thật phải có `JWT_SECRET`** (biến môi trường hoặc `.env`, xem
  `06_DEPLOYMENT.md` mục 1) — thiếu thì server từ chối chạy sau khi merge nhánh này.
- ⚠️ Chưa có refresh token — token hết hạn phải đăng nhập lại thủ công.
- ⚠️ Import HRM/Equipment/Network cả đợt chạy 1 transaction — lỗi 1 dòng rollback toàn
  bộ, phải chạy lại từ đầu (đánh đổi có chủ đích).
- ⚠️ Chưa có Content-Security-Policy cho ứng dụng chính (Leaflet tải ảnh bản đồ ngoài) —
  cần ticket riêng, thử trên giao diện thật.
- ⚠️ Token của tài khoản đã vô hiệu hoá vẫn dùng được tới khi hết hạn (`JWT_EXPIRY`, 8h).
- ⚠️ `GET /api/organization/tree` trả 500 khi DB chưa có BĐT/TP nào (có từ trước, chưa sửa).
- ⚠️ Rate-limit đăng nhập lưu trong bộ nhớ tiến trình — không đúng nếu scale nhiều
  instance (cần Redis lúc đó, chưa cần ở quy mô hiện tại).


## ✅ Đã hoàn tất (không cần làm lại)
Vòng 1 (Auth/RBAC/soft-delete/transaction/validate/test/frontend-login/dashboard-fix),
Vòng 2 (User Admin/rate-limit), Lược đồ mã CCDC, Module Người Sử Dụng đầy đủ (CRUD +
import + autocomplete), Import/Export Excel CCDC 2 chiều, Quản Lý Mạng Lưới đầy đủ
(CRUD + Import/Export + 3 submenu + Người Phụ Trách + Bản Đồ), dọn 21 bưu cục rác baseline
(mục `04_DECISIONS.md` #15). Chi tiết từng bước + bằng chứng test: `CHANGELOG_AI.md`.
