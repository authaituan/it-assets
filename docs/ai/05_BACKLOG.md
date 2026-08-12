# 📝 BACKLOG — Việc tiếp theo

> File "sống". CTO AI cập nhật sau mỗi vòng báo cáo. Sắp xếp theo THỨ TỰ THỰC HIỆN
> (có phụ thuộc), không chỉ theo ưu tiên — vì nhiều mục cùng chạm `server/index.js`,
> làm sai thứ tự sẽ phải sửa lại 2 lần. Mỗi bước = 1 branch riêng, merge xong mới sang bước sau.

## Chuỗi xử lý Risk & Drift (chốt ngày 2026-08-12)

| # | Việc | Branch | Dev AI phụ trách | Phụ thuộc | Trạng thái |
|---|---|---|---|---|---|
| 1 | Sửa 2 drift (README Prisma, `package.json` seed script) | `fix/docs-drift` | Claude Code — Haiku 4.5 | — | [x] Đã merge vào main |
| 2 | Auth cơ bản + RBAC theo cột `role` có sẵn | `feat/auth-rbac` | Claude Code — Opus 4.8 | #1 | [x] Đã merge vào main (commit `9e5a94f`) |
| 3+4 | Soft-delete + transaction, gộp với validate input (2 bước bị chạy chồng lấn ngoài dự kiến, xem `04_DECISIONS.md` mục 4) | `combined-fix` (thay cho 2 nhánh cũ) | Claude (Sonnet 5, làm trực tiếp) | #2 | [x] Code + test xong (10 kịch bản), **chờ PO push nhánh này lên GitHub rồi merge** |
| 5 | Test cho route lõi (equipments, auth, hrm) | `test/core-routes` | Claude Code — Sonnet 5 | #2, #3+4 (chờ merge) | [ ] Chưa giao |

Prompt đầy đủ cho từng bước: xem báo cáo CTO AI ngày 2026-08-12 trong lịch sử trao đổi,
hoặc điền lại theo khung ở `prompts/`.

## ✅ Đã chốt
- Mô hình phân quyền: giữ đơn giản STAFF (đọc) vs quản lý (ghi) — xem `04_DECISIONS.md`.
- Bước 3 & 4 gộp lại thành `combined-fix` do bị làm chồng lấn thứ tự — không dùng lại
  2 nhánh `feat/soft-delete-transactions` / `feat/input-validation` cũ nữa.

## 🟢 Ưu tiên thấp / tương lai khi dự án lớn hơn
- [ ] Thêm CI (lint + test) qua GitHub Actions.
- [ ] Tách `server/index.js` (598 dòng) thành route files riêng khi số route tăng thêm.
- [ ] Cân nhắc thêm router phía frontend nếu số lượng tab/trang tăng lên.

## ✅ Đã hoàn thành (tick khi CTO AI xác nhận có evidence)
- [x] CRUD Create/Read/Update cho Equipment.
- [x] Dashboard thống kê + cảnh báo.
- [x] Cây tổ chức 3 cấp + bộ lọc cascading.
- [x] Auto-mapping HRM theo tên chuẩn hoá.
- [x] 4 theme giao diện.
- [x] Bộ tài liệu AI (`docs/ai/`) — khởi tạo 2026-08-12.
