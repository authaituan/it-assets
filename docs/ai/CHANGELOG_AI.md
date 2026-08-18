# 📝 AI-Assisted Changes Changelog

Ghi lại các thay đổi được thực hiện với hỗ trợ của AI/Claude Code.

---

## [2026-08-18] - Bản Đồ Điểm Phục Vụ tương tác (feat/network-map-view)

### Changes
- **package.json**: thêm 2 dependency mới (lần đầu dùng trong dự án) `leaflet@^1.9.4` + `react-leaflet@^5.0.0`, nền OpenStreetMap (miễn phí, không cần API key).
- **src/components/NetworkMapView.jsx**: thay nội dung placeholder rỗng bằng bản đồ tương tác thật — gọi `GET /api/network?limit=2000`, lọc bỏ bưu cục chưa có toạ độ (hiện dòng cảnh báo "X bưu cục chưa có toạ độ"), mỗi bưu cục có toạ độ là 1 `CircleMarker` (màu theo `operational_status`: ACTIVE=xanh lá/khác=xám; bán kính theo `sqrt(equipment_count)`), click marker hiện popup đầy đủ thông tin + người phụ trách. Không sửa Sidebar.jsx/App.jsx/InventoryView.jsx/server (đúng phạm vi giao).
- **Tested**: `npm test` 118/118 pass, `npm run build` thành công. Test qua UI thật (Vite dev :3000 + backend thật :5000, tạo/xoá tài khoản ADMIN tạm để đăng nhập): 15/206 bưu cục có toạ độ hiện đúng marker, click marker xanh + marker xám (536752 Tân An, INACTIVE) đều đúng màu/nội dung popup, không lỗi console, không giật lag.
- Phạm vi: `package.json`, `src/components/NetworkMapView.jsx`. Không sửa `Sidebar.jsx`, `App.jsx`, `InventoryView.jsx`, `server/*.js`.

---

## [2026-08-18] - Tái cấu trúc Submenu Quản Lý Mạng Lưới + Redesign Danh Sách (feat/network-submenu-restructure)

### Changes
- **Đổi tên/tách file**: `UnitTreeView.jsx` (bảng CRUD) → `src/components/NetworkListView.jsx`. Khôi phục NGUYÊN VẸN code cây tổ chức READ-ONLY gốc (từ commit lịch sử `93cc342`, đã bị ghi đè ở `feat/network-management-frontend`) thành file mới `src/components/NetworkTreeView.jsx`. Thêm placeholder rỗng `src/components/NetworkMapView.jsx` ("đang phát triển").
- **src/components/Sidebar.jsx**: mục "Quản Lý Mạng Lưới" nay có thể mở rộng (pattern giống `isInventoryExpanded` của "Quản Lý CCDC", nhưng đây là submenu TĨNH 3 mục cố định "Danh Sách"/"Cây Thư Mục"/"Bản Đồ Điểm Phục Vụ", không fetch động).
- **src/App.jsx**: thêm state `networkSubView` ('list'|'tree'|'map', mặc định 'list'), render đúng 1 trong 3 component `NetworkListView`/`NetworkTreeView`/`NetworkMapView` khi `activeTab === 'unittree'`.
- **NetworkListView.jsx — thiết kế lại bảng "Danh Sách"**: ĐÚNG 5 cột gộp cell ("Mã & Tên Bưu Cục", "Địa Chỉ & Liên Hệ", "Toạ Độ & Bản Đồ" kèm link Google Maps, "Trạng Thái & CCDC", "Thao Tác" — 👁 Xem chi tiết/✏️ Sửa/🗑️ Xoá). Nạp toàn bộ danh sách 1 lần (`GET /api/network?limit=2000`, không phân trang server) rồi search/lọc/phân trang phía client để kết hợp được cả 5 điều kiện (search + 4 dropdown: Phường/Xã Mới, BĐX, Loại Hình, Tình Trạng — tất cả suy distinct động từ dữ liệu thật, không hardcode) mà không cần thêm route/param backend mới. Thêm modal "Xem chi tiết" chỉ đọc mới.
- **Autocomplete "Người Phụ Trách"**: thêm vào modal Thêm/Sửa bưu cục, copy đúng pattern autocomplete "Người Sử Dụng" của `EquipmentDetailModal.jsx` (`GET /api/personnel/search`, gợi ý "Mã HRM-Họ Tên-Mã BC-Mã BĐX"). Sửa dùng `PUT .../responsible_user_id`; Thêm mới dùng `POST /api/network/import` với field `maHrmNguoiPhuTrach` (mã HRM, khác key PUT).
- **server/index.js (ngoại lệ được PO cho phép)**: mở rộng WHERE clause `search` của `GET /api/network` khớp thêm `p.type`/`p.operational_status`, không chỉ mã/tên như trước.
- **Tested**: `npm test` 118/118 pass (không đổi hành vi backend ngoài search). Test qua UI thật (Vite dev :3000 proxy backend thật :5000 — đã xin phép PO restart backend production vì tiến trình cũ chưa nạp code mới + tạo 1 tài khoản ADMIN tạm để đăng nhập, xoá lại sau khi xong): submenu mở rộng đúng 3 mục; "Danh Sách" hiện đúng 5 cột gộp cell, link "Mở Google Maps" mở đúng toạ độ thật trên Google Maps, bưu cục chưa có toạ độ hiện "Chưa có toạ độ" không lỗi; 4 dropdown lọc + search mở rộng theo Loại hình ("PH2" → đúng 6 kết quả) đều lọc đúng; "Cây Thư Mục" hiện đúng cây phân cấp BĐT/TP→BĐX→Bưu cục như trước khi bị ghi đè; "Bản Đồ Điểm Phục Vụ" hiện placeholder không lỗi; Sửa bưu cục → gõ tên vào "Người Phụ Trách" → chọn gợi ý → Lưu → verify `GET /api/network` + modal "Xem chi tiết" trả đúng tên/HRM người phụ trách → đã gỡ gán lại (`responsible_user_id = null`) để trả dữ liệu thật về đúng baseline sau khi test xong.
- Phạm vi: `src/components/Sidebar.jsx`, `src/App.jsx`, `src/components/NetworkListView.jsx` (mới, thay `UnitTreeView.jsx`), `src/components/NetworkTreeView.jsx` (mới), `src/components/NetworkMapView.jsx` (mới), `server/index.js` (chỉ đúng phần mở rộng search `GET /api/network`, ngoại lệ PO cho phép). Không sửa `InventoryView.jsx`/`PersonnelView.jsx`/`EquipmentDetailModal.jsx`/`AddEquipmentModal.jsx`.

---

## [2026-08-17] - Backend Người Phụ Trách bưu cục (feat/network-responsible-person-backend)

### Changes
- **server/db.js**: migration idempotent thêm cột `post_offices.responsible_user_id TEXT` (cả CREATE TABLE gốc lẫn ALTER TABLE). KHÔNG FOREIGN KEY cứng — validate ở tầng ứng dụng, giống `equipments.assigned_user_id`.
- **server/index.js**: `GET /api/network` JOIN thêm `users` trả `responsible_user_id`/`responsible_user_name`/`responsible_user_hrm` (mẫu từ `assigned_user_name`/`assigned_user_hrm` của `GET /api/equipments`). `PUT /api/network/post-offices/:id` nhận thêm `responsible_user_id` (nullable, validate tồn tại — copy `PUT /api/equipments/:id`). `GET /api/network/export-data`/`POST /api/network/import` thêm field `maHrmNguoiPhuTrach`, resolve qua `resolveOrCreateOrgChain()` mở rộng (tra `users.hrm_code`, throw lỗi rõ ràng nếu không tồn tại, chặn cả dòng).
- **tests/network.test.js**: thêm 7 test case (gán hợp lệ, gán ID không tồn tại → 400, gỡ gán null, GET trả đúng tên/HRM, import resolve đúng, import resolve lỗi → 400 không ghi gì, export trả đúng field) — 24 test trong file này.
- **Tested**: `npm test` 118/118 pass. Test thêm bằng curl trên DB tạm (port 5921, monkey-patch, KHÔNG chạm `data/ccdc.db` — verify MD5 trước/sau giống hệt, có server production đang chạy): gán người phụ trách hợp lệ → lưu đúng + GET trả đúng tên/HRM; gán ID không tồn tại → 400; export đúng `maHrmNguoiPhuTrach`; import bưu cục mới kèm mã HRM hợp lệ → resolve đúng; import mã HRM không tồn tại → 400, không tạo bưu cục.
- **Field JSON mới** (cho 2 hạng mục frontend sau dùng đúng): export/import Excel key `maHrmNguoiPhuTrach`; `GET /api/network` response key `responsible_user_id`/`responsible_user_name`/`responsible_user_hrm`; `PUT /api/network/post-offices/:id` request body key `responsible_user_id` (khác key Excel, khớp tên cột DB).
- Phạm vi: CHỈ `server/db.js`, `server/index.js`, `tests/network.test.js`. Không sửa `server/auth.js`, không đụng file `.jsx` nào.

---

## [2026-08-17] - Frontend Quản Lý Mạng Lưới (feat/network-management-frontend)

### Changes
- **src/components/Sidebar.jsx**: đổi nhãn menu "Sơ Đồ BĐX & Bưu Cục" → "Quản Lý Mạng Lưới" (giữ nguyên id `unittree`, không đụng App.jsx).
- **src/components/UnitTreeView.jsx**: viết lại hoàn toàn (giữ nguyên path để không sửa App.jsx) — từ cây READ-ONLY thành bảng CRUD đầy đủ (search + lọc BĐX + phân trang, nút Sửa/Xoá) + 3 modal nội bộ trong cùng file: Thêm/Sửa bưu cục (Thêm dùng `POST /api/network/import` 1 dòng vì không có route tạo đơn lẻ; Sửa dùng `PUT /api/network/post-offices/:id` với bộ key khác — tên cột DB thật + `communeId`), Export Excel, Import Excel (kèm "Tải Template Mẫu" tự dựng 2 sheet bằng exceljs). Xoá hiện đúng message backend (400 khi còn thiết bị/nhân sự liên kết) qua alert, không phải lỗi JSON thô.
- Field JSON dùng chung key với backend (`feat/network-management-backend`).
- **Tested**: `npm test` 111/111 pass (không đổi backend). Test qua UI thật (Vite dev :3000 + backend thật :5000): Template Mẫu đúng 2 sheet/20 cột; import 1 bưu cục hoàn toàn mới (đủ 9 field mới) → tạo đúng, hiện trong danh sách; sửa SĐT + toạ độ → lưu đúng, field khác giữ nguyên; xoá bưu cục (chưa có thiết bị) → xoá được; kiểm tra ngược sang Quản Lý CCDC → import thiết bị với mã bưu cục không tồn tại → bị chặn rõ ràng, không tạo bưu cục "ma". Đã xoá sạch dữ liệu test, verify lại baseline (353 thiết bị/44 BĐX/206 bưu cục/3 tài khoản gốc).
- **Phát hiện lặp lại**: server production đang chạy lúc bắt đầu là tiến trình cũ (trước khi `feat/network-management-backend` merge) — `/api/network` trả HTML fallback. Đã xin phép PO restart trước khi test (xem `00_SNAPSHOT.md`).
- Phạm vi: CHỈ `src/components/Sidebar.jsx` + `src/components/UnitTreeView.jsx`. Không sửa `server/*.js`, không đụng file khác.

---

## [2026-08-17] - Backend Quản Lý Mạng Lưới + Equipment Import hết quyền tự tạo tổ chức (feat/network-management-backend)

### Changes
- **server/db.js**: migration idempotent thêm 9 cột vào `post_offices` (`old_ward_code`, `old_ward_name`, `district_name`, `new_ward_code`, `new_ward_name`, `phone`, `operational_status` mặc định `'ACTIVE'`, `latitude` REAL, `longitude` REAL) — cả trong CREATE TABLE lẫn ALTER TABLE riêng.
- **server/index.js**: tách helper dùng chung `resolveOrCreateOrgChain()` (tự tạo Tỉnh→BĐX→Bưu cục + 9 cột mới, CHỈ cho Quản Lý Mạng Lưới) và `requireExistingPostOffice()` (chỉ tra, không tạo). **Phương án B (PO chốt)**: `POST /api/equipments/import` KHÔNG còn tự tạo tổ chức — chặn 400 nếu mã bưu cục chưa có; `provincesCreated/communesCreated/postOfficesCreated` luôn = 0. Thêm 5 route mới: `GET /api/network`, `POST /api/network/import`, `GET /api/network/export-data`, `PUT /api/network/post-offices/:id`, `DELETE /api/network/post-offices/:id` (xoá cứng, bắt lỗi FK `SQLITE_CONSTRAINT_FOREIGNKEY` → 400 nếu còn thiết bị/nhân sự liên kết).
- **tests/equipment-import-export.test.js**: viết lại test "tạo mới toàn bộ chuỗi tổ chức" cũ → "mã bưu cục chưa tồn tại → 400, không tự tạo, không ghi dòng nào" + thêm test mã bưu cục đã có vẫn tạo thiết bị (3 field org = 0).
- **tests/network.test.js** (mới, port 5906): 17 test phủ 5 route mạng lưới (import tạo mới/update, fail-fast, sửa, xoá chặn-FK vs xoá-được, export, RBAC).
- **Tested**: `npm test` **111/111 pass**. Test thêm bằng curl trên DB tạm (port 5920, monkey-patch, KHÔNG chạm `data/ccdc.db` — verify MD5 trước/sau giống hệt, có server production đang chạy): import mạng lưới mới từ đầu (9 cột mới lưu đúng gồm lat/long), import CCDC mã bưu cục không có → 400 chặn + không tự tạo, mã bưu cục có sẵn → tạo được (org=0), xoá bưu cục có thiết bị → 400 chặn, xoá bưu cục trống → 200.
- **docs**: cập nhật `00_SNAPSHOT.md` (section Quản Lý Mạng Lưới + note đổi hành vi Equipment Import), `03_ARCHITECTURE_MAP.md` (5 route + bảng 20 field + helper + test), `04_DECISIONS.md` mục 14 (quyết định Phương án B + lý do).
- Phạm vi: `server/db.js` (chỉ thêm migration), `server/index.js`, `tests/equipment-import-export.test.js` (sửa 1 test), `tests/network.test.js` (mới), `package.json` (thêm test file). KHÔNG sửa `server/auth.js`, KHÔNG sửa file `.jsx` nào.

---

## [2026-08-17] - Frontend Import/Export Excel CCDC (feat/equipment-import-export-frontend)

### Changes
- **src/components/InventoryView.jsx**: thêm 2 nút "Export Excel"/"Import Excel" cạnh "+ Thêm Thiết Bị CCDC"; mở `ExportEquipmentModal`/`ImportEquipmentModal`; refetch communes/device-types/post-offices sau khi Import thành công.
- **src/components/ExportEquipmentModal.jsx** (mới): 2 phương án Export (Đầy đủ 31 cột / Theo trường tự chọn, cột Mã CCDC luôn bắt buộc), dùng đúng bộ lọc đang áp dụng trên InventoryView, dựng `.xlsx` bằng `exceljs` client-side, tải qua Blob + `<a download>`.
- **src/components/ImportEquipmentModal.jsx** (mới): nút "Tải Template Mẫu" tự dựng file `.xlsx` 2 sheet (Dữ Liệu + Hướng Dẫn) bằng `exceljs`; đọc file `.xlsx` map cột theo TÊN HEADER (hỗ trợ cả file export rút gọn); xem trước tối đa 20 dòng; gọi `POST /api/equipments/import`, hiện đủ số liệu báo cáo + liệt kê lỗi từng dòng.
- Field JSON export/import dùng CHUNG key với backend (`feat/equipment-import-export-backend`), copy chính xác — bảng đầy đủ trong `03_ARCHITECTURE_MAP.md`.
- **Phát hiện quan trọng khi test**: server production (`node server/index.js`) đang chạy là tiến trình CŨ khởi động trước khi backend feature merge vào main — dù code trên đĩa đã có route mới, tiến trình không tự nạp lại (không watch/nodemon) nên 404. Đã xin phép PO qua `AskUserQuestion` trước khi restart tiến trình (đồng ý), xác nhận route hoạt động rồi mới tiếp tục test. Xem chi tiết + khuyến nghị PO trong `00_SNAPSHOT.md`.
- **Tested**: `npm test` 93/93 pass (không đổi backend). Test qua UI thật (Vite dev port 3001 vì port 3000 đang bị `vite preview` bản production build cũ chiếm + backend thật port 5000, sau khi restart): tải Template Mẫu → đọc lại bằng exceljs xác nhận đúng 2 sheet/31 cột; export Đầy Đủ đối chiếu đúng dữ liệu thật (353 thiết bị); export Theo Trường (tick 3 cột) → đúng 4 cột (3 tick + Mã CCDC); import 1 dòng bưu cục hoàn toàn mới → tạo đúng BĐX/bưu cục/hãng/thiết bị mới; export lại rồi sửa Model, import lại (file rút gọn 3 cột) → cập nhật đúng, các field khác không mất. Đã xoá sạch dữ liệu test khỏi `data/ccdc.db` thật, verify lại đúng baseline (353 thiết bị/44 BĐX/206 bưu cục/3 tài khoản gốc).
- Phạm vi: `src/components/InventoryView.jsx` (sửa) + 2 file mới `ExportEquipmentModal.jsx`/`ImportEquipmentModal.jsx`. Không sửa `server/*.js`, không đụng `PersonnelView.jsx`/`AddPersonnelModal.jsx`/`ImportPersonnelModal.jsx`.

---

## [2026-08-17] - Backend Export/Import CCDC (feat/equipment-import-export-backend)

### Changes
- **server/index.js**:
  - `GET /api/equipments/export-data` (mới, authRequired + requireManager): tái sử dụng nguyên vẹn WHERE clause của `GET /api/equipments` (search/communeId/postOfficeId/deviceTypeId/categoryRaw/status), KHÔNG phân trang. Trả 24 field khớp cột Excel gốc A-X + 7 field mới (`maCcdc`, `danhMucCcdc`, `tienToDanhMucMoi` luôn rỗng, `namMua`, `maHrmNguoiSuDung`, `trangThai`, `ghiChu`) — key JSON tiếng Việt không dấu.
  - `POST /api/equipments/import` (mới, authRequired + requireManager): nhận `{ rows: [...] }` dùng CHUNG key với export. Validate fail-fast (bắt buộc `maMbc` + `tenMay`/`maCcdc`) trước khi mở transaction. Tự resolve/tạo mới `province_post_offices`/`commune_post_offices`/`post_offices` theo code (không route nào khác làm được việc này), `brands` theo tên, `device_types` theo tên thật (bắt buộc `tienToDanhMucMoi` khi tạo danh mục mới + tạo thiết bị mới). Có `maCcdc` khớp → UPDATE chỉ ghi đè field không rỗng (không mất dữ liệu field vắng mặt); không có `maCcdc` → CREATE, tự sinh `asset_tag` theo đúng cơ chế `<prefix>-<YY>-<seq>`. Bọc 1 `db.transaction()`, lỗi bất kỳ dòng nào → rollback toàn bộ, 400.
- **package.json**: thêm `tests/equipment-import-export.test.js` vào script `test`.
- **tests/equipment-import-export.test.js** (mới): 14 test case, tổng `npm test` 93/93 pass.
- **Tested**: `npm test` 93/93 pass. Đã test thêm bằng curl trên DB tạm (`os.tmpdir()`, port 5910, kỹ thuật monkey-patch `better-sqlite3` giống test harness) — xác nhận có server production đang chạy sống (cổng 5000/3000) trước khi bắt đầu, KHÔNG chạm `data/ccdc.db` thật (verify MD5 trước/sau giống hệt nhau): import bưu cục hoàn toàn mới, export đúng field, import lại nguyên vẹn dữ liệu vừa export → idempotent (0 tạo mới, toàn bộ thành cập nhật), danh mục mới thiếu tiền tố → 400 rõ ràng, thiếu `maMbc` → fail-fast không ghi dòng nào.
- Phạm vi: CHỈ `server/index.js` — không sửa `server/auth.js`/`server/db.js` (không cần đổi schema), không đụng file `.jsx` nào (CHỈ BACKEND theo đúng phạm vi giao).

---

## [2026-08-14] - Thêm chức năng Sửa/Xoá cho Người Sử Dụng (feat/personnel-edit-delete)

### Changes
- **server/index.js**:
  - `DELETE /api/personnel/:id`: Route mới (authRequired, requireManager). Chặn xoá (trả 400) nếu người dùng có tài khoản đăng nhập (`password_hash IS NOT NULL`). Set `deactivated_at = CURRENT_TIMESTAMP`.
  - `GET /api/personnel` và `GET /api/personnel/search`: Thêm filter `WHERE deactivated_at IS NULL` để không hiển thị người đã xoá.
- **src/components/PersonnelView.jsx**: 
  - Thêm nút thao tác "Sửa" và "Xoá" trên mỗi dòng.
  - Xử lý xác nhận xoá và hiển thị lỗi nếu API chặn (người có tài khoản đăng nhập).
- **src/components/AddPersonnelModal.jsx**:
  - Đổi chế độ Sửa/Thêm mới dựa vào prop `editingPersonnel`.
  - Cập nhật tiêu đề modal, nút Lưu Thay Đổi và gọi API (`PUT /api/personnel/:id` khi sửa).
- **Tested**: API tests passed (`npm test` 79/79). Test UI qua backend thật cho các logic xoá chặn tài khoản đăng nhập, sửa thông tin thành công và loại trừ người đã xoá khỏi API tìm kiếm.

### Reason
Bổ sung tính năng Sửa/Xoá (soft-delete tái sử dụng cột `deactivated_at`) còn thiếu cho module Người Sử Dụng theo yêu cầu của PO.

---

## [2026-08-14] - Autocomplete gán Người Sử Dụng cho thiết bị (feat/personnel-autocomplete)

### Changes
- `src/components/EquipmentDetailModal.jsx` (chế độ Sửa) & `src/components/AddEquipmentModal.jsx`:
  thay ô nhập text tự do "Người Sử Dụng" bằng ô tìm kiếm gõ-để-gợi-ý, debounce ~300ms gọi
  `GET /api/personnel/search` (qua `apiFetchJson`), gợi ý dạng `Mã HRM-Họ Tên-Mã BC-Mã BĐX`.
  Chọn gợi ý → set `assignedUserId` + `rawUserName`; gõ tự do → gỡ `assignedUserId`. Lưu gửi
  cả `assigned_user_id` (null nếu trống) và `raw_user_name` lên `POST/PUT /api/equipments`.
- Logic autocomplete lặp lại ở cả 2 file (không tách component dùng chung) — đúng phạm vi
  hạng mục chỉ được sửa 2 file này.
- Test qua UI thật: tạo 2 nhân sự test qua curl → gán qua autocomplete lúc Sửa (verify
  `assigned_user_id` đúng) → tạo thiết bị mới kèm gán ngay lúc tạo (verify đúng) → tạo/sửa
  để trống (verify không lỗi, `assigned_user_id: null`) → xoá gán đã có (verify về null) →
  dọn sạch dữ liệu test.
- `npm test`: 79/79 pass.
- Sự cố quy trình: branch bị tạo lệch do `main` nhận thêm merge `feat/personnel-frontend`
  giữa lúc code — đã xoá branch cũ (chưa push) và tạo lại đúng từ `main` mới nhất, không
  mất code đang sửa dở (`git stash`/`pop`). Chi tiết `04_DECISIONS.md` mục 13.

### Reason
Hoàn thiện trải nghiệm gán "Người Sử Dụng" cho thiết bị bằng ID thật (`assigned_user_id`)
thay vì chỉ text tự do, tận dụng Personnel API đã có sẵn từ 2 hạng mục trước.

---

## [2026-08-14] - UI Người Sử Dụng thay thế HRM cũ (feat/personnel-frontend)

### Changes
- Xoá `src/components/HrmMappingView.jsx`. Thêm `src/components/PersonnelView.jsx`
  (layout theo `InventoryView.jsx`, cột Mã HRM/Tên/Mã BC/Mã BĐX tự tra tên qua
  organization API), `src/components/AddPersonnelModal.jsx` (gọi `POST /api/personnel`),
  `src/components/ImportPersonnelModal.jsx` (parse `.xlsx` thật bằng `exceljs` ngay trên
  browser, preview trước khi gọi `POST /api/personnel/import`).
- `src/components/Sidebar.jsx`: đổi nhãn "Tích Hợp HRM Nhân Sự" → "Người Sử Dụng".
- `src/App.jsx`: render `PersonnelView` thay `HrmMappingView`.
- Test qua UI thật (Vite + backend thật, không phải server production đang chạy — xác
  nhận không có server sống trước khi khởi động): import Excel 3 dòng → preview đúng →
  Import → tạo mới đúng 3 → thêm 1 người thủ công → cả 4 xuất hiện đúng trong danh sách
  kèm tên BC/BĐX tra được → "Quản Lý Người Dùng" xác nhận KHÔNG thấy các nhân sự này
  (đúng, chưa có mật khẩu) → dọn sạch dữ liệu test khỏi `data/ccdc.db` thật.
- `npm test`: 79/79 pass (không đổi backend).
- Phát hiện (không do hạng mục này gây ra, xem `04_DECISIONS.md` mục 12): 1 thiết bị
  test sót lại trong DB thật (`PC-24-001`/`TEST-NEW-001`), đã có từ trước khi hạng mục
  này bắt đầu — báo PO, không tự xử lý.

### Reason
Hoàn thiện UI cho Personnel API đã có sẵn từ `feat/personnel-backend`, thay thế hẳn màn
hình "Tích Hợp HRM Nhân Sự" cũ (gọi route đã xoá) bằng luồng quản lý nhân sự + import
Excel thật.

---

## [2026-08-14] - Personnel API thay thế HRM cũ (feat/personnel-backend, CHỈ BACKEND)

### Changes
- **server/index.js**: Xoá hẳn `POST /api/hrm/upload-and-map`. Thêm 5 route mới:
  `GET /api/personnel`, `GET /api/personnel/search`, `POST /api/personnel`,
  `PUT /api/personnel/:id`, `POST /api/personnel/import` (UPSERT theo `hrm_code`,
  validate fail-fast trước khi ghi, bọc `db.transaction()`). Sửa `GET /api/users` thêm
  `WHERE password_hash IS NOT NULL`. `POST/PUT /api/equipments` nhận thêm
  `assigned_user_id` (optional, nullable, validate tồn tại trong `users`).
- **tests/**: Xoá `tests/hrm.test.js`, thêm `tests/personnel.test.js` (30 test case,
  cùng port 5903). `npm test`: 79/79 pass.
- **package.json**: script `test` trỏ `tests/personnel.test.js` thay `tests/hrm.test.js`.
- **docs/ai/**: cập nhật `00_SNAPSHOT.md`, `03_ARCHITECTURE_MAP.md`, thêm mục 10 vào
  `04_DECISIONS.md` (drift: `HrmMappingView.jsx` frontend vẫn gọi route đã xoá, để lại
  cho 2 hạng mục frontend sau xử lý).

### Reason
Bảng `users` cần tách rõ 2 mục đích (tài khoản đăng nhập vs. nhân sự nguồn gán thiết
bị) để chuẩn bị cho UI Personnel + autocomplete gán "Người Sử Dụng" ở các hạng mục
frontend sau.

---

## [2026-08-14] - Hiển thị & Lọc Phân Loại Chi Tiết (feat/category-raw-label)

### Changes
- **server/index.js**:
  - `GET /api/equipments/category-raw-options`: Route mới lấy danh sách các `category_raw` duy nhất.
  - `GET /api/equipments`: Thêm query `categoryRaw` lọc bằng `json_extract`.
  - `POST /api/equipments` & `PUT /api/equipments/:id`: Nhận thêm `category_raw` riêng rẽ và gộp vào object `specs` an toàn.
- **src/components/InventoryView.jsx**: 
  - Thêm dropdown lọc "Phân Loại Chi Tiết" bên cạnh "Loại Thiết Bị CCDC".
  - Bảng CCDC hiển thị label `category_raw` (badge).
- **src/components/EquipmentDetailModal.jsx** & **AddEquipmentModal.jsx**: Thêm ô `<input list="..."><datalist>` để nhập/chọn Phân Loại Chi Tiết (`category_raw`).

### Reason
Dữ liệu từ Excel ("Loại máy") lưu trong `specs.category_raw` nhưng chưa hiển thị/lọc/sửa được.

### Tested
Test trực tiếp UI (đã thay đổi các file trên branch `feat/category-raw-label`).

---

## [2026-08-13] - Lược đồ mã CCDC có nghĩa + sửa/mở rộng chỉnh sửa thiết bị + đổi thương hiệu (feat/asset-tag-scheme)

### Changes
- **server/db.js**: thêm cột `device_types.asset_prefix` + `equipments.purchase_year`
  (CREATE TABLE + migration idempotent). Khi thêm `asset_prefix` lần đầu, seed 1 lần
  prefix cho 8 danh mục hiện có theo `code` (PC/PRN/PRO/NET/SCA/UPS/CAM/SCA — vài cái
  tạm, xem `04_DECISIONS.md`). KHÔNG đổi asset_tag của thiết bị cũ.
- **server/index.js**: `POST /api/equipments` sinh `asset_tag` mới `<PREFIX>-<YY>-<seq>`
  (tính MAX+1 theo cặp prefix+năm, trong transaction; chặn 400 nếu danh mục chưa có
  prefix); nhận `purchase_year`. `PUT /api/equipments/:id` nhận thêm `device_type_id/
  brand_id/brand_name/post_office_id/purchase_year` (đổi loại KHÔNG đổi lại asset_tag).
  `POST /api/device-types` nhận `asset_prefix`; route mới `PUT /api/device-types/:id`
  (sửa name/asset_prefix/description, validate prefix `^[A-Z0-9]{2,5}$`).
- **src/components/CategoryAdminView.jsx** (mới): view "Quản Lý Danh Mục" — sửa
  `asset_prefix` inline (role quản lý). Wire vào Sidebar + App.jsx.
- **AddCategoryModal.jsx**: thêm ô "Tiền Tố Mã CCDC". **AddEquipmentModal.jsx**: thêm ô
  "Năm Mua". **EquipmentDetailModal.jsx**: form Chỉnh Sửa bổ sung Model + Loại thiết bị +
  Hãng + BĐX/Bưu cục (cascading, preselect đúng) + Năm Mua; hiển thị asset_tag làm tiêu
  đề. **InventoryView.jsx**: cột "Mã CCDC / Máy" hiển thị `asset_tag` làm chữ đậm chính.
- **Sidebar.jsx + LoginView.jsx + README.md**: đổi thương hiệu "CCDC POST"/"Bưu Điện Tỉnh
  Thừa Thiên Huế" → "Hệ Thống Quản Lý CCDC"/"Bưu Điện Thành Phố Huế".
- **tests/helpers/fixtures.js**: `seedMinimalOrg` thêm `asset_prefix='TST'` (nếu không
  POST equipment sẽ bị chặn 400 — sửa cho khớp lược đồ mới, không phải bug).
- **tests/equipments.test.js**: +5 test cho lược đồ mới (001/002 tăng dần, năm khác từ
  001, mặc định năm hiện tại, chặn khi thiếu prefix, PUT đổi loại giữ nguyên asset_tag).

### Reason
Mã `CCDC-<mã bưu cục>-<4 số cuối timestamp>` cũ vô nghĩa. Đổi sang mã có ý nghĩa
`<PREFIX>-<YY>-<seq>` cho thiết bị mới. Đồng thời sửa các thiếu sót: form Sửa thiếu ô
model/loại/hãng/bưu cục/năm; InventoryView hiển thị nhầm hostname thay vì mã CCDC; chưa
sửa được danh mục đã tạo.

### Tested
`npm test`: 55 test cũ + 5 mới → **60/60 pass**. UI thật (Vite :3000 → Express :5000):
tạo danh mục "TST" (prefix TST) → tạo 2 thiết bị cùng năm 2024 → `TST-24-001`, `TST-24-002`;
tạo năm 2025 → `TST-25-001` (bắt đầu lại từ 001); danh mục để trống prefix → tạo thiết bị
bị chặn 400 message rõ ràng; sửa prefix danh mục đó thành NPX qua UI Quản Lý Danh Mục →
tạo thiết bị → `NPX-24-001`; sửa 1 thiết bị đổi model+loại+bưu cục+năm mua → cả 4 lưu
đúng, asset_tag `TST-24-001` KHÔNG đổi dù đổi loại; InventoryView hiện đúng mã CCDC làm
chữ đậm; verify thiết bị THẬT `CCDC-530000-0018` giữ nguyên mã sau migration; màn đăng
nhập + Sidebar hiện tên đơn vị mới. Dọn sạch dữ liệu test (4 thiết bị, 2 danh mục, 1 user)
sau khi xong — active equipments về đúng 353, device_types về 8.

### PO cần xử lý tiếp
Vài `asset_prefix` gán tạm (COMPUTER=PC gộp desktop+laptop+POS; NETWORK=NET gộp SW/RTR/AP;
SCANNER+SCALE cùng `SCA`; UPS/CAM/PRO...) — PO vào "Quản Lý Danh Mục" chỉnh lại, xem bảng
chi tiết trong `04_DECISIONS.md`.

---

## [2026-08-12] - Fix server crash khi có thư mục dist/ (Express 5 + path-to-regexp)

### Changes
- **server/index.js**: đổi `app.get('*', (req, res) => {...})` (fallback SPA khi serve
  static `dist/`) thành `app.use((req, res) => {...})` — không cần path-to-regexp parse
  pattern `'*'` nữa, tránh crash `PathError: Missing parameter name at index 1: *`.

### Reason
Phát hiện khi Claude verify PR `feat/inventory-submenu` (build production + chạy server
thật với `dist/` tồn tại → crash ngay lúc khởi động). Lỗi có sẵn từ code gốc, chỉ bị lộ
ra khi có `dist/` — đúng tình huống thật của PO khi deploy LAN nội bộ (`06_DEPLOYMENT.md`
mục 4). Dev AI làm PR trước đó từng gặp lỗi này khi chạy `npm test` nhưng chỉ né bằng
cách xoá `dist/`, không sửa gốc — xem `04_DECISIONS.md` mục 8 để biết đầy đủ.

### Tested
Build production (`npm run build`) → chạy `node server/index.js` thật với `dist/` tồn
tại → server sống bình thường (trước đó crash). Gọi `GET /api/device-types` và `GET /`
đều đúng. Chạy lại 55 test tự động: pass, không cần xoá `dist/` như trước.

---

## [2026-08-13] - Submenu động cho Quản lý CCDC (feat/inventory-submenu)

### Changes
- **src/components/Sidebar.jsx**: Thêm chức năng fetch danh mục thiết bị động từ `/api/device-types` và render thành submenu dưới mục "Quản Lý CCDC". Thêm icon chevron để đóng/mở submenu.
- **src/App.jsx**: Thêm state `inventoryDeviceTypeId` để lưu lựa chọn từ submenu và truyền xuống `InventoryView` làm điều kiện lọc mặc định.
- **src/components/InventoryView.jsx**: Bổ sung `useEffect` lắng nghe `initialDeviceTypeId` từ props để tự động cập nhật dropdown "Loại Thiết Bị CCDC" mà không khoá UI.

### Reason
Tạo lối tắt điều hướng trực tiếp đến từng loại CCDC từ thanh Sidebar (dựa trên danh mục động thay vì hardcode), giúp người dùng không phải vào view tổng rồi mới lọc.

### Tested
`npm test`: 55/55 test tự động pass. Đã verify code đảm bảo khi click submenu sẽ filter danh sách CCDC đúng loại, click mục cha sẽ reset bộ lọc, và submenu tự cập nhật khi có danh mục mới được thêm (đều dựa trên state và data từ backend).

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
