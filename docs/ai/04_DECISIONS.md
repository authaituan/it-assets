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

## Ghi chú
- Cả 2 drift đầu tiên đều được phát hiện từ quá trình review và kiểm tra thực tế package.json + cấu trúc thư mục scripts.
- Mục đích: Đảm bảo tính nhất quán giữa tài liệu (README, package.json) và thực tế mã nguồn.
