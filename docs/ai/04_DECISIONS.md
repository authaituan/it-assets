# 📋 Decisions & Technical Drift

## Drift phát hiện

### 1. README.md - Công Nghệ Sử Dụng
**Vấn đề**: Mục "Công Nghệ Sử Dụng" ghi "Prisma 3NF" nhưng package.json thực tế chỉ dùng `better-sqlite3`, không dùng Prisma ORM.

**Chi tiết**:
- Dòng 34 (cũ): `"Backend": Node.js, Express.js, SQLite / Prisma 3NF, OpenPyXL / ExcelJS parser.`
- Đúng: SQLite chỉ được gọi qua `better-sqlite3` driver, không thông qua Prisma.

**Trạng thái**: ✅ Đã xử lý 2026-08-12
- Sửa thành: `"Backend": Node.js, Express.js, SQLite (better-sqlite3), OpenPyXL / ExcelJS parser.`

---

### 2. package.json - Script "seed"
**Vấn đề**: Script `seed` trong package.json chỉ đến file `scripts/seed_from_excel.js` (không tồn tại), nhưng script thực tế là `scripts/seed.py` (Python).

**Chi tiết**:
- Dòng 12 (cũ): `"seed": "node scripts/seed_from_excel.js"`
- Thực tế: Script Python `scripts/seed.py` đang được sử dụng để seed dữ liệu từ `dulieu.xlsx`
- Đúng: `"seed": "python scripts/seed.py"`

**Trạng thái**: ✅ Đã xử lý 2026-08-12
- Cập nhật script để trỏ đúng file Python hiện có.

---

### 3. Thư mục `docs/ai/` bị viết đè, mất 4 file
**Vấn đề**: Khi làm bước `feat/auth-rbac`, Dev AI phụ trách đã viết đè toàn bộ thư mục
`docs/ai/` bằng cấu trúc/định dạng riêng, xoá mất `01_ROLES.md`, `02_WORKFLOW.md`,
`05_BACKLOG.md`, và toàn bộ thư mục `prompts/` — cũng làm mất luôn quyết định nghiệp vụ
đã chốt trước đó (mô hình phân quyền) từng được ghi ở file này.

**Trạng thái**: ✅ Đã khôi phục 2026-08-12 — 4 file/thư mục trên đã được thêm lại, kèm
quy tắc mới trong `README_AI.md` cấm viết đè toàn bộ file dưới danh nghĩa "cập nhật".

---

### 4. Bước `feat/soft-delete-transactions` chưa từng được merge trước khi bước 4 bắt đầu
**Vấn đề**: Nhánh `feat/input-validation` được tạo từ commit ngay sau `feat/auth-rbac`,
tức là TRƯỚC KHI bước soft-delete + transaction tồn tại trên GitHub. 2 bước này lẽ ra
phải làm tuần tự (theo `05_BACKLOG.md`) nhưng bị chạy chồng lấn ngoài dự kiến.

**Trạng thái**: ✅ Đã xử lý 2026-08-12 — Claude gộp thủ công code của cả 2 bước vào 1
bản, test end-to-end lại toàn bộ (10 kịch bản, xem `CHANGELOG_AI.md`), không phát hiện
xung đột logic. PO cần push bản gộp này thay vì merge riêng từng nhánh cũ.

---

### 5. Dashboard stats đếm cả thiết bị đã soft-delete
**Vấn đề**: `GET /api/dashboard/stats` (server/index.js) — TOÀN BỘ 8 câu query trong
route này (`totalAssets`, `activeAssets`, `allEquipments`/`lowSpecCount`/`win7Count`,
`assetsByCommune`, `assetsByType`, `assetsByBrand`, `missingMac`, `missingIp`) đều
KHÔNG có điều kiện `deleted_at IS NULL`, trong khi `GET /api/equipments` và
`GET /api/equipments/:id` đều đã lọc đúng. Phát hiện khi test UI thật (`feat/frontend-auth`):
thêm 1 thiết bị rồi xoá (soft-delete) ngay sau đó — tổng "TỔNG THIẾT BỊ CCDC" trên
Dashboard vẫn tăng thêm 1 và không giảm lại. Khi Claude verify lại, phát hiện phạm vi
thực tế rộng hơn báo cáo ban đầu (báo cáo chỉ nêu `totalAssets`, thực tế cả 8 query).

**Trạng thái**: ✅ Đã xử lý 2026-08-12 (Claude sửa trực tiếp trên branch
`feat/frontend-auth`) — thêm `deleted_at IS NULL` vào cả 8 câu query. Verify: chạy lại
32 test tự động (vẫn pass), test thủ công `GET /api/dashboard/stats` với 1 thiết bị đã
soft-delete → `totalAssets` = 0 (đúng), trước khi sửa sẽ ra 1 (sai).

---

---

### 6. File tooling `.claude/launch.json` lọt nhầm vào repo
**Vấn đề**: Commit `d574dde` (PR `feat/frontend-auth`) vô tình commit file cấu hình IDE
`.claude/launch.json` (dùng để chạy Vite dev server qua Antigravity lúc test UI). Báo
cáo lúc đó ghi "đã dọn file tạm" nhưng thực tế file vẫn còn trên `main` — không ai phát
hiện ra cho tới lần audit lại toàn bộ repo ở Vòng 2.

**Trạng thái**: ✅ Đã xử lý 2026-08-12 (Claude sửa trực tiếp) — xoá file, thêm `.claude/`
vào `.gitignore` để không lặp lại. Không ảnh hưởng gì tới ứng dụng (chỉ là config IDE).

---

### 7. Rate-limit đăng nhập
**Quyết định**: Thêm rate-limit chống brute-force cho `POST /api/auth/login`: tối đa 5
lần sai trong 15 phút, tính theo cặp (IP + mã HRM) — không tính theo IP đơn thuần để
tránh khoá oan nhiều người dùng chung mạng NAT/wifi công ty khi họ đăng nhập các tài
khoản khác nhau. Lưu trạng thái trong bộ nhớ tiến trình (`Map`), không dùng DB/Redis —
đơn giản, đủ cho quy mô 1 instance server hiện tại; sẽ mất khi restart (chấp nhận được).

**Trạng thái**: ✅ Đã triển khai 2026-08-12 (Claude sửa trực tiếp trên `server/index.js`).
Verify: 2 test tự động mới (`tests/auth.test.js`) + gọi API thật qua `curl` xác nhận lần
thứ 6 trả `429` kèm header `Retry-After: 900`, kể cả khi gửi đúng mật khẩu.

**Lưu ý cho tương lai**: nếu sau này scale ra nhiều instance server (load balancer), Map
trong bộ nhớ sẽ không đồng bộ giữa các instance — cần chuyển sang Redis hoặc tương tự
lúc đó. Chưa cần xử lý ở quy mô hiện tại.

## Quyết định nghiệp vụ đã chốt
- **2026-08-12 | QUYẾT ĐỊNH | PO (Tân), ghi nhận bởi Claude** — Giữ mô hình phân quyền
  nhị phân: `STAFF` = chỉ đọc, mọi role khác (`ADMIN`/`MANAGER`...) = quyền ghi đầy đủ,
  không tách quyền chi tiết theo từng role gốc (IT_ADMIN/ACCOUNTANT/WAREHOUSE_MANAGER)
  ở giai đoạn này. Áp dụng cho: `server/auth.js` (hàm `isManager`), middleware
  `requireManager` trong `server/index.js`. Có thể tách nhỏ hơn sau nếu phát sinh nhu
  cầu thực tế.

- **2026-08-12 | QUYẾT ĐỊNH | PO (Tân), ghi nhận bởi Claude** — CTO AI tự quyết chọn Dev
  AI (Antigravity hay Claude Code, model nào) theo đúng khung độ phức tạp/rủi ro ở
  `01_ROLES.md` mục 5, KHÔNG hỏi lại PO mỗi lần. Bỏ thói quen sai trước đó là mặc định
  giao mọi việc có giao diện cho Claude Code — cả 2 Dev AI đều có Browser tool riêng, tự
  chạy thử UI thật được như nhau, nên "có UI hay không" không phải tiêu chí phân công
  đúng. Áp dụng lâu dài, không cần PO xác nhận lại trừ khi PO chủ động đổi ý.

- **2026-08-13 | QUYẾT ĐỊNH | theo prompt PO, thực hiện bởi Claude (`feat/asset-tag-scheme`)**
  — Lược đồ mã CCDC mới `<PREFIX>-<YY>-<seq 3 chữ số>` (vd `PC-24-001`) **CHỈ áp dụng cho
  thiết bị TẠO MỚI** từ nay. **TUYỆT ĐỐI KHÔNG đổi `asset_tag` của 353 thiết bị thật đã có**
  (vẫn giữ định dạng cũ `CCDC-<mã bưu cục>-<seq>`) — các thiết bị này đang được dùng trên
  hệ thống LAN production (`06_DEPLOYMENT.md`), đổi mã hàng loạt sẽ phá vỡ tham chiếu thực
  tế. Migration chỉ THÊM cột (`device_types.asset_prefix`, `equipments.purchase_year`),
  không UPDATE `asset_tag` cũ. Đã verify sau migration + toàn bộ thao tác test: thiết bị
  thật `CCDC-530000-0018` giữ nguyên mã. Nếu sau này PO muốn đổi mã đồng loạt cho thiết bị
  cũ → phải là quyết định riêng của PO, có backup DB trước, KHÔNG Dev AI nào tự làm.

- **2026-08-13 | CẦN PO XEM LẠI | `asset_prefix` gán TẠM cho danh mục hiện có** — Migration
  đã tự seed `asset_prefix` cho 8 danh mục thật dựa theo `code`. Bảng dưới đây liệt kê rõ
  mức độ chắc chắn; **PO cần vào "Quản Lý Danh Mục" chỉnh lại các dòng ⚠️**:
  | Danh mục (name) | code | prefix đã gán | Đánh giá |
  |---|---|---|---|
  | Máy in Bưu chính | PRINTER | `PRN` | ✅ Khớp rõ (máy in) |
  | Máy tính & POS | COMPUTER | `PC` | ⚠️ Danh mục GỘP desktop+laptop+POS (352 thiết bị). Gán `PC` theo "máy tính". PO cân nhắc TÁCH thành 2 danh mục PC (bàn) + LAP (laptop) nếu cần phân biệt. |
  | Máy Chiếu & Kiosk | M_Y_CHI_U___KIOSK | `PRO` | ⚠️ Danh mục GỘP máy chiếu (PRO) + Kiosk. Gán `PRO` theo "máy chiếu". |
  | Thiết bị Mạng | NETWORK | `NET` | ⚠️ Danh mục GỘP switch(SW)+router(RTR)+wifi(AP). Không khớp 1 loại nào → tạm `NET` (3 ký tự code). |
  | Máy quét mã vạch | SCANNER | `SCA` | ⚠️ Không nằm trong 10 loại PO đưa → tạm 3 ký tự code. **TRÙNG prefix với "Cân điện tử"** (xem dưới) — PO nên đổi 1 trong 2. |
  | Cân điện tử | SCALE | `SCA` | ⚠️ Không nằm trong 10 loại → tạm 3 ký tự code. **TRÙNG prefix với "Máy quét mã vạch"**. |
  | Bộ lưu điện (UPS) | UPS | `UPS` | ⚠️ Không nằm trong 10 loại → tạm 3 ký tự code (đủ rõ nghĩa, PO xác nhận là được). |
  | Camera an ninh | CAMERA | `CAM` | ⚠️ Không nằm trong 10 loại → tạm 3 ký tự code (đủ rõ nghĩa). |

  Lưu ý kỹ thuật: prefix TRÙNG nhau (SCANNER+SCALE cùng `SCA`) KHÔNG gây trùng `asset_tag`
  (thuật toán MAX+1 theo cả namespace `SCA-YY-%` vẫn đảm bảo mã duy nhất), chỉ khiến 2
  danh mục dùng CHUNG dãy số thứ tự — về mặt nghiệp vụ nên tách, nhưng không phải lỗi dữ
  liệu. Cả 2 danh mục này hiện có 0 thiết bị nên đổi prefix bây giờ hoàn toàn an toàn.

---

### 8. `app.get('*', ...)` crash server khi thư mục `dist/` tồn tại (Express 5 + path-to-regexp mới)
**Vấn đề**: `server/index.js` (dòng ~953, phần "Serve frontend static files in production")
dùng cú pháp wildcard trần `app.get('*', ...)` để fallback SPA — cú pháp này **không còn
hợp lệ** với phiên bản `path-to-regexp` đi kèm Express hiện tại trong `node_modules`,
gây crash ngay lúc khởi động (`PathError: Missing parameter name at index 1: *`) bất cứ
khi nào thư mục `dist/` tồn tại (tức là sau khi chạy `npm run build` — chính là tình
huống thật của PO khi triển khai LAN nội bộ, xem `06_DEPLOYMENT.md` mục 4). Đây là lỗi
có sẵn từ code gốc ban đầu (scaffold trước cả Vòng 1), không phải do PR nào trong các
vòng vừa qua gây ra — chỉ bị "lộ" ra khi có `dist/`, mà trước giờ chưa ai build production
nên chưa từng gặp.

Phát hiện khi Claude verify PR `feat/inventory-submenu`: Dev AI phụ trách PR đó (báo cáo
2026-08-12) đã gặp lỗi này lúc chạy `npm test`, nhưng chỉ **né bằng cách xoá thư mục
`dist/`** trước khi test thay vì sửa gốc — nghĩa là lỗi vẫn còn nguyên trên `main` cho
tới khi Claude phát hiện lại và sửa dứt điểm.

**Trạng thái**: ✅ Đã xử lý 2026-08-12 (Claude sửa trực tiếp trên `main`) — đổi
`app.get('*', ...)` thành `app.use((req, res) => {...})` (middleware cuối cùng, không
cần path-to-regexp parse path pattern nào, tương đương ý nghĩa wildcard cũ). Verify: khởi
động server thật với `dist/` tồn tại → sống bình thường (trước đó crash ngay), gọi
`GET /api/device-types` và `GET /` đều đúng, chạy lại 55 test tự động vẫn pass (không
cần xoá `dist/` nữa như trước).

**Bài học quy trình**: khi Dev AI gặp lỗi ngoài phạm vi công việc được giao và chọn cách
"né" thay vì sửa, PHẢI ghi rõ vào `04_DECISIONS.md` mục "Drift phát hiện" theo đúng quy
tắc ở `README_AI.md` — không chỉ nhắc trong báo cáo miệng rồi thôi, vì báo cáo miệng dễ
bị đọc lướt qua và lỗi vẫn tồn tại trên `main` không ai theo dõi tiếp.

---

### 9. `git add .` nhiều lần gom nhầm file thừa vào commit (lặp lại 2 lần)
**Vấn đề**: Ít nhất 2 lần khác nhau, Dev AI dùng `git add .` (thay vì `git add
<file_cụ_thể>`) trước khi commit, vô tình gom theo các file KHÔNG thuộc phạm vi công
việc được giao:
1. PR `feat/category-raw-label` (lần đầu, 2026-08-12): kèm theo
   `scripts/reclassify_by_category_raw.js` (291 dòng, sót lại từ 1 prompt đã bị PO huỷ
   bỏ trước đó — xem lịch sử trao đổi) và làm đổi vài byte metadata của `dulieu.xlsx`
   (nội dung không đổi, đã verify từng dòng bằng script Python so sánh openpyxl).
2. Ngay ở commit "dọn dẹp" tiếp theo (923c8cf) sửa lỗi (1), lại vô tình thêm MỚI file
   `scripts/test_ui_behavior.js` (126 dòng, script debug dùng để mô phỏng gọi API test
   UI khi Browser tool bị lỗi hạ tầng) và làm `dulieu.xlsx` đổi byte thêm 1 lần nữa
   (lần thứ 3 tính từ đầu — nội dung vẫn không đổi, đã verify lại).

**Trạng thái**: ✅ Đã xử lý 2026-08-12 (Claude sửa trực tiếp trên `main`) — xoá
`scripts/test_ui_behavior.js`, khôi phục `dulieu.xlsx` về đúng byte gốc (đã so khớp với
bản tại commit `78cc83b`, trước khi bất kỳ PR nào trong Vòng 3 chạm vào), và thêm file
`.gitattributes` đánh dấu `*.xlsx binary` — ngăn Git tự ý xử lý/chuẩn hoá file này, vốn
là nguyên nhân nghi ngờ gây ra hiện tượng đổi byte lặp lại nhiều lần dù nội dung không đổi.

**Bài học quy trình**: Dev AI (và PO khi tự thao tác git) nên dùng `git add <file cụ
thể>` thay vì `git add .` khi biết rõ phạm vi thay đổi, đặc biệt với các nhánh có làm
việc thử nghiệm/debug tạo ra file tạm trong thư mục dự án. `git status` PHẢI được đọc kỹ
từng dòng trước khi `git add .`, không chỉ chạy theo quán tính.

---

### 10. Xoá route HRM cũ, thay bằng Personnel API (`feat/personnel-backend`)
**Quyết định**: `POST /api/hrm/upload-and-map` bị xoá hẳn khỏi `server/index.js`, thay
bằng 5 route mới trong section "PERSONNEL API": `GET /api/personnel`,
`GET /api/personnel/search`, `POST /api/personnel`, `PUT /api/personnel/:id`,
`POST /api/personnel/import`. Logic UPSERT-theo-`hrm_code` và hàm `normalizeStr` (bỏ
dấu + viết thường) được copy nguyên sang route mới trước khi xoá route cũ — điểm khác
biệt duy nhất: route cũ khớp user hiện có theo `hrm_code OR full_name`, route mới CHỈ
khớp theo `hrm_code` (rõ ràng hơn, tránh gộp nhầm 2 người trùng tên). Route cũ còn có
tính năng "Auto-Match Equipment by Raw User Name" (tự gán `assigned_user_id` cho thiết
bị dựa trên khớp `raw_user_name`) — tính năng này **KHÔNG được mang sang** route
`/api/personnel/import` mới, vì nay đã có cơ chế gán tường minh qua field
`assigned_user_id` ở `POST/PUT /api/equipments` (validate tồn tại trong `users`), không
cần đoán/khớp mờ theo tên nữa.

**Drift phát sinh cần PO lưu ý**: `src/components/HrmMappingView.jsx` (frontend) vẫn
đang gọi `POST /api/hrm/upload-and-map` (`src/components/HrmMappingView.jsx:65`) — route
này đã xoá nên component sẽ nhận lỗi 404 nếu còn được render. Hạng mục
`feat/personnel-backend` **CHỈ backend** theo đúng phạm vi được giao (không đụng file
`.jsx`), 2 hạng mục sau (frontend, làm sau khi nhánh này merge vào `main`) cần cập nhật
`HrmMappingView.jsx` để gọi route mới hoặc thay bằng UI Personnel mới, nếu không app sẽ
có 1 màn hình chết trong lúc chờ.

**Bảng `users` dùng chung 2 mục đích**: tài khoản đăng nhập (`role`, `password_hash`
NOT NULL) và nhân sự thuần từ Personnel API (`password_hash` NULL). `GET /api/users`
được sửa thêm `WHERE password_hash IS NOT NULL` để không lẫn nhân sự thuần vào danh
sách tài khoản đăng nhập (UI Quản Lý Người Dùng).

**Trạng thái**: ✅ Đã xử lý 2026-08-14, 79/79 test tự động pass (`tests/personnel.test.js`
mới thay `tests/hrm.test.js` đã xoá). KHÔNG test qua curl trên server production thật
(đang chạy sống tại cổng 5000, phát hiện trong lúc làm hạng mục này) — cân nhắc rủi ro
ghi dữ liệu test vào 353 thiết bị thật, PO tự quyết định có cần verify thủ công qua UI
thật hay không trước khi merge.

---

### 11. Frontend Personnel (`feat/personnel-frontend`): nút Header "Upload File HRM" cố ý không sửa nhãn
**Bối cảnh**: Hạng mục chỉ được phép sửa `Sidebar.jsx`, `App.jsx` + thêm/xoá component
mới, KHÔNG được đụng `Header.jsx` (tránh trùng phạm vi với hạng mục khác). `Header.jsx`
có sẵn 1 nút riêng "Upload File HRM" gọi prop `onOpenHrmModal` — prop này được định nghĩa
trong `App.jsx` (`onOpenHrmModal={() => setActiveTab('personnel')}`), nên chỉ cần đổi
chuỗi id trong `App.jsx` là nút vẫn hoạt động đúng (mở đúng `PersonnelView` mới), không
cần chạm `Header.jsx`.

**Hệ quả**: Nhãn chữ "Upload File HRM" trên nút đó (`src/components/Header.jsx:116`)
không còn khớp ngữ nghĩa (giờ mở view "Người Sử Dụng" chứ không phải riêng upload). Đây
là drift chữ hiển thị (không phải lỗi logic) — để lại cho hạng mục sau (hoặc PO duyệt)
sửa nhãn, tránh đụng file ngoài phạm vi giao.

**Trạng thái**: Ghi nhận, chưa xử lý (chờ PO quyết định gộp vào hạng mục nào sửa
`Header.jsx` tiếp theo).

---

### 12. Phát hiện 1 thiết bị test sót lại trong `data/ccdc.db` thật (không phải do hạng mục này)
**Phát hiện**: Trong lúc verify dữ liệu sau khi dọn test của `feat/personnel-frontend`,
thấy thiết bị `asset_tag = PC-24-001`, `hostname = TEST-NEW-001`, `created_at =
2026-08-14 03:34:36`, `deleted_at = NULL` (đang hoạt động, KHÔNG soft-delete) trong DB
thật. Xác nhận **không phải do hạng mục này tạo ra** — thời điểm dashboard hiện baseline
"354 thiết bị hoạt động" ngay sau khi đăng nhập (trước khi làm bất kỳ thao tác nào của
hạng mục này) đã bao gồm sẵn thiết bị này.

**Nghi vấn**: Có thể là dữ liệu test sót lại từ 1 hạng mục song song đang sửa
`AddEquipmentModal.jsx`/`EquipmentDetailModal.jsx` (tên `TEST-NEW-001` gợi ý test tạo
thiết bị mới) chưa dọn sau khi test qua UI thật.

**Xử lý**: KHÔNG tự xoá (ngoài phạm vi hạng mục `feat/personnel-frontend`, và không chắc
chắn thiết bị này có đang được 1 phiên làm việc khác dùng dở hay không). Báo PO xem lại,
xoá thủ công nếu xác nhận là rác test.

**Cập nhật (`feat/personnel-autocomplete`, 2026-08-14)**: Thiết bị này đã được
soft-delete (`deleted_at` có giá trị) bởi 1 phiên làm việc khác trong lúc hạng mục
autocomplete đang chạy — xác nhận không phải do hạng mục `feat/personnel-autocomplete`
xử lý, chỉ tình cờ phát hiện khi verify lại số lượng thiết bị sau khi dọn dữ liệu test
của chính hạng mục này.

---

### 13. Branch `feat/personnel-autocomplete` bị tạo lệch (trước khi `feat/personnel-frontend` merge), phải xoá tạo lại
**Vấn đề**: Prompt giao việc chỉ yêu cầu kiểm tra `feat/personnel-backend` đã merge vào
`main` trước khi tạo branch `feat/personnel-autocomplete` (không đề cập
`feat/personnel-frontend`). Dev AI checkout `main` + tạo branch mới đúng lúc `main` mới
chỉ có `feat/personnel-backend` merge — sau đó, trong lúc Dev AI đang code (đọc file,
sửa 2 file JSX), PR `feat/personnel-frontend` được merge vào `main` (ngoài kiểm soát của
phiên làm việc này). Branch `feat/personnel-autocomplete` cũ vẫn trỏ ở commit CŨ (trước
merge đó) → nếu tiếp tục commit lên nhánh cũ sẽ thiếu toàn bộ thay đổi của
`feat/personnel-frontend` (UI Người Sử Dụng, PersonnelView...) khi merge sau này.

**Phát hiện**: Lúc mở trình duyệt test UI, Vite dev server serve code hiện tại trên đĩa
nhưng `git branch --show-current` bất ngờ báo `main` (không phải branch vừa tạo) — kiểm
tra `git log`/`git diff` xác nhận branch cũ trỏ ở `7c3b751` (chỉ có personnel-backend),
trong khi `main` đã tiến lên `d97342f` (có thêm personnel-frontend).

**Xử lý**: `git stash` 2 file đang sửa dở (`EquipmentDetailModal.jsx`,
`AddEquipmentModal.jsx`) → `git branch -D feat/personnel-autocomplete` (branch cũ CHƯA
từng push lên origin, xoá an toàn) → tạo lại branch mới cùng tên từ `main` mới nhất
(đã có personnel-frontend) → `git stash pop` để khôi phục 2 file đang sửa dở → verify lại
nội dung 2 file không mất gì trước khi tiếp tục.

**Bài học quy trình**: Khi 1 hạng mục kéo dài (đọc code + sửa nhiều file + test UI mất
nhiều phút), `main` có thể tiến thêm do PR khác merge song song — Dev AI nên `git status`
+ `git branch --show-current` kiểm tra lại trước khi commit cuối cùng, không chỉ tin vào
câu lệnh `git checkout -b` chạy ở đầu phiên.

### 14. Phương án B: "Quản Lý Mạng Lưới" là danh mục chuẩn bắt buộc — Equipment Import hết quyền tự tạo tổ chức (`feat/network-management-backend`)
**Quyết định (PO chốt 2026-08-17)**: "Quản Lý Mạng Lưới" (đổi tên từ "Sơ Đồ BĐX & Bưu
Cục") trở thành **danh mục chuẩn BẮT BUỘC** cho toàn hệ thống. Danh sách Tỉnh/BĐX/Bưu cục
là "nguồn sự thật" (source of truth) duy nhất, được quản lý tập trung tại đây.

**Lý do đổi hành vi Equipment Import**: trước đây `POST /api/equipments/import` TỰ tạo mới
`province_post_offices`/`commune_post_offices`/`post_offices` khi gặp mã chưa có — tiện lúc
đầu nhưng dẫn tới rủi ro dữ liệu bẩn: gõ sai mã bưu cục trong file CCDC sẽ âm thầm sinh ra
bưu cục "ma" (sai chính tả, trùng lặp, thiếu 9 field mạng lưới). Phương án B chấm dứt điều
này: chỉ 1 cửa (Quản Lý Mạng Lưới) được tạo tổ chức; mọi import khác PHẢI tham chiếu tổ
chức đã có.

**Thay đổi kỹ thuật**:
- Tách logic tự tạo Tỉnh→BĐX→Bưu cục (cũ nằm trong route Equipment Import) thành hàm dùng
  chung `resolveOrCreateOrgChain()` — mở rộng lưu thêm 9 cột mới của `post_offices`. CHỈ
  route mạng lưới gọi hàm này.
- Equipment Import chuyển sang gọi `requireExistingPostOffice(maMbc)` — chặn 400 nếu mã bưu
  cục chưa tồn tại. Field report `provincesCreated/communesCreated/postOfficesCreated` GIỮ
  NGUYÊN trong response (để không phá frontend Import CCDC đã có) nhưng LUÔN = 0.
- Test cũ "import bưu cục hoàn toàn mới → tạo mới cả province/commune/post_office" trong
  `tests/equipment-import-export.test.js` bị SAI với hành vi mới → viết lại thành "mã bưu
  cục chưa tồn tại → 400, không tự tạo tổ chức, không ghi dòng nào" (fail-fast) + thêm test
  xác nhận mã bưu cục ĐÃ có vẫn tạo thiết bị bình thường với 3 field org = 0.

**Ảnh hưởng frontend (chưa xử lý, ngoài phạm vi hạng mục backend này)**: `UnitTreeView.jsx`
hiện READ-ONLY, cần nâng cấp thành "Quản Lý Mạng Lưới" có CRUD/Import/Export ở hạng mục sau.
Frontend Import CCDC hiện tại vẫn hoạt động (field report vẫn còn, chỉ = 0) — nhưng nếu file
CCDC chứa mã bưu cục mới sẽ nhận lỗi 400 thay vì tự tạo; đây là hành vi MONG MUỐN theo
Phương án B.

---

### 15. Dọn 21 bưu cục "ma" + 22 thiết bị rác bị gán nhầm mặc định BĐX 5300
**Vấn đề**: `scripts/seed.py` (script gốc, dùng 1 lần duy nhất lúc khởi tạo dự án) có logic
tự động gán bưu cục vào BĐX mặc định `"5300"` (Bưu điện phường Thuận An) nếu dòng Excel
gốc (`dulieu.xlsx`) thiếu Mã BĐX. PO phát hiện qua UI "Quản Lý Mạng Lưới" (submenu Danh
Sách) thấy nhiều bưu cục có hậu tố "(TD)" bị gán chung vào BĐX 5300 một cách bất thường.

Kiểm tra: 27 bưu cục đang gán vào BĐX 5300, mỗi bưu cục có đúng 1 thiết bị với
`hostname: null, model: null` (dòng rác không có dữ liệu thật, chỉ có mã CCDC tự sinh
kiểu cũ `CCDC-<mã bc>-<số>`). PO xác nhận GIỮ LẠI 6 mã (536750, 535370, 536751, 536730,
536740, 536752 — các bưu cục thật, có địa chỉ/BĐX hợp lý dù tạm thời cũng nằm nhầm 5300),
XOÁ 21 mã còn lại + 22 thiết bị đi kèm (phát hiện thêm 1 thiết bị "ma" phụ đã soft-delete
từ trước, `CCDC-531000-0338`, cùng loại rác, PO xác nhận xoá luôn).

**Trạng thái**: ✅ Đã xử lý 2026-08-18 (Claude soạn script, PO tự chạy trên máy sau khi
backup `data/ccdc.db`) — xoá theo đúng thứ tự tránh vi phạm FOREIGN KEY: `asset_transfer_logs`
(theo cả `equipment_id` lẫn `to_post_office_id`) → `equipments` → `post_offices`, bọc trong
1 `db.transaction()` để đảm bảo toàn vẹn (rollback tự động nếu có lỗi giữa chừng — đã thực
tế xảy ra 1 lần do sót thiết bị "ma" phụ, rollback đúng, không mất dữ liệu, sửa lại chạy
thành công lần 2).

**Kết quả xác nhận sau khi xoá**: BĐX 5300 chỉ còn đúng 6 bưu cục PO giữ lại. Tổng bưu cục:
206 → 185. Tổng thiết bị đang hoạt động: 353 → 332 (giảm 21, không phải 22, vì 1 thiết bị
đã soft-delete từ trước vốn không tính vào con số 353).

**⚠️ QUAN TRỌNG — cập nhật baseline cho các phiên sau**: mọi mốc "353 thiết bị thật" nhắc
tới trong tài liệu TRƯỚC ngày 2026-08-18 đã LỖI THỜI — baseline chính xác từ nay là
**332 thiết bị / 185 bưu cục / 44 BĐX**. Dev AI các hạng mục sau PHẢI dùng con số mới này
khi verify baseline dữ liệu thật, không dùng lại "353" nữa.

---

### 16. Nén `00_SNAPSHOT.md` từ 665 dòng xuống 161 dòng — chống phình to token
**Vấn đề**: `00_SNAPSHOT.md` được thiết kế ban đầu (2026-08-12) làm "ảnh chụp nhanh
hiện trạng", nhưng qua ~20 PR liên tiếp, mỗi hạng mục đều thêm 1 mục "mới, feat/X" kèm
tường thuật đầy đủ (bước test UI, số liệu trước/sau...) — trùng lặp gần như 100% nội
dung đã có sẵn trong `CHANGELOG_AI.md`. Hậu quả: mọi Dev AI phải đọc thêm ~500 dòng
không cần thiết ở MỌI task (3 file bắt buộc đọc tăng từ ~300 lên ~900 dòng), tốn token
đáng kể mà PO phản ánh trực tiếp.

**Trạng thái**: ✅ Đã xử lý 2026-08-18 (Claude viết lại toàn bộ) — nén còn 161 dòng,
GIỮ NGUYÊN mọi route/business rule/cấu trúc frontend hiện tại (tổ chức lại thành bảng/
danh sách gọn theo module, không theo PR), BỎ toàn bộ tường thuật lịch sử (đã có sẵn y
hệt trong `CHANGELOG_AI.md`, không mất thông tin gì). Đồng thời tăng cường
`README_AI.md`: thêm mục "Ngân sách đọc" hướng dẫn CHỈ đọc đúng file cần cho từng loại
câu hỏi (thay vì đọc tràn lan), và thêm quy tắc 7 CẤM viết lại `00_SNAPSHOT.md` theo
kiểu tường thuật từng PR — mọi cập nhật từ nay phải SỬA ĐÈ đúng đoạn liên quan, không
THÊM đoạn mới.

**Bài học quy trình**: đây là lỗi trôi dạt (drift) chậm, không xảy ra 1 lần mà tích luỹ
qua nhiều PR nhỏ hợp lý riêng lẻ — mỗi Dev AI làm đúng "thêm 1 dòng vào CHANGELOG +
cập nhật SNAPSHOT" như hướng dẫn, nhưng hướng dẫn cũ không đủ rõ ràng về việc SNAPSHOT
phải nén/sửa đè, không phải cộng dồn. PO nên định kỳ (vài tuần/lần, hoặc khi thấy
`00_SNAPSHOT.md` vượt ~250 dòng) nhắc CTO AI kiểm tra lại kích thước và nén nếu cần.

## Ghi chú
- Cả 2 drift đầu tiên đều được phát hiện từ quá trình review và kiểm tra thực tế package.json + cấu trúc thư mục scripts.
- Mục đích: Đảm bảo tính nhất quán giữa tài liệu (README, package.json) và thực tế mã nguồn.
