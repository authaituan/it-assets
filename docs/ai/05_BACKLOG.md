# 📝 BACKLOG — Việc tiếp theo

> File "sống". CTO AI cập nhật sau mỗi vòng báo cáo. Sắp xếp theo THỨ TỰ THỰC HIỆN
> (có phụ thuộc), không chỉ theo ưu tiên — vì nhiều mục cùng chạm `server/index.js`,
> làm sai thứ tự sẽ phải sửa lại 2 lần. Mỗi bước = 1 branch riêng, merge xong mới sang bước sau.

## ✅ VÒNG 1 — HOÀN TẤT (2026-08-12, main = `fe8aa3e`)

| # | Việc | PR | Dev AI phụ trách | Trạng thái |
|---|---|---|---|---|
| 1 | Sửa 2 drift (README Prisma, `package.json` seed script) | — | Claude Code — Haiku 4.5 | [x] Merged |
| 2 | Auth cơ bản + RBAC (STAFF đọc / khác STAFF ghi) | — | Claude Code — Opus 4.8 | [x] Merged |
| 3+4 | Soft-delete + transaction + validate input (gộp, xem `04_DECISIONS.md` mục 4) | #1 | Claude (Sonnet 5) | [x] Merged |
| 5 | 32 test tự động (`node:test`) | #2 | Claude Code — Sonnet 5 | [x] Merged |
| 6 | Frontend tích hợp đăng nhập + gắn token | #3 | Claude Code — Sonnet 5 | [x] Merged |
| 7 | Fix Dashboard đếm nhầm thiết bị đã xoá (phát sinh khi verify #6) | #4 | Claude (Sonnet 5) | [x] Merged |

Toàn bộ đã verify bằng `git fetch` + đọc code thật trên `main`, không dựa vào báo cáo.

## 🔵 VÒNG 2 — Đề xuất (chưa giao, PO chọn thứ tự ưu tiên)

| Việc | Mức độ | Ghi chú |
|---|---|---|
| Route quản trị user (tạo/đổi mật khẩu qua UI) | Nên làm sớm | Hiện phải chạy script tay, không có UI |
| Set `JWT_SECRET` thật qua biến môi trường ở production | Nên làm trước khi lên production | Đang dùng secret mặc định DEV |
| Refresh token / logout / rate-limit đăng nhập | Có thể để sau | Không ảnh hưởng vận hành hàng ngày |
| CI (tự động chạy `npm test` qua GitHub Actions) | Có thể để sau | Hiện phải tự gõ `npm test` |
| Tách `server/index.js` thành route files riêng | Khi file quá dài | Hiện ~730 dòng, còn quản lý được |

## ✅ Đã hoàn thành (tick khi CTO AI xác nhận có evidence)
- [x] CRUD Create/Read/Update/Delete (soft) cho Equipment.
- [x] Dashboard thống kê + cảnh báo (đã fix đếm đúng thiết bị chưa xoá).
- [x] Cây tổ chức 3 cấp + bộ lọc cascading.
- [x] Auto-mapping HRM theo tên chuẩn hoá.
- [x] 4 theme giao diện.
- [x] Bộ tài liệu AI (`docs/ai/`) — khởi tạo 2026-08-12.
- [x] Auth + RBAC (backend + frontend đầy đủ).
- [x] 32 test tự động.
