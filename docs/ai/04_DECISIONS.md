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

## Ghi chú
- Cả 2 drift đầu tiên đều được phát hiện từ quá trình review và kiểm tra thực tế package.json + cấu trúc thư mục scripts.
- Mục đích: Đảm bảo tính nhất quán giữa tài liệu (README, package.json) và thực tế mã nguồn.
