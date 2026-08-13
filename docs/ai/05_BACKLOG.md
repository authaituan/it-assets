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

## ✅ VÒNG 2 — HOÀN TẤT (2026-08-12, main = `666329a`)

| Việc | PR | Trạng thái |
|---|---|---|
| Route quản trị user (tạo/đổi mật khẩu qua UI) | #5 | [x] Merged |
| Rate-limit đăng nhập (chống brute-force) | #6 | [x] Merged |
| Set `JWT_SECRET` thật khi deploy production | #6 | [x] Hướng dẫn xong (`06_DEPLOYMENT.md`) |
| Dọn `.claude/launch.json` lọt vào repo | #6 | [x] Merged |
| Test tự động cho route user-admin | #6 | [x] Merged |
| Sửa tên user + Vô hiệu hoá/Kích hoạt lại tài khoản (phát sinh khi PO review UI) | #7 | [x] Merged |

Toàn bộ đã verify bằng `git fetch` + tự chạy test trên `main` thật, không dựa vào báo cáo.
Tổng test hiện tại: **55/55 pass**.

## 🔵 VÒNG 3 — Đề xuất (chưa giao)

| Việc | Mức độ | Ghi chú |
|---|---|---|
| Refresh token / logout phía server | Có thể để sau | Hiện token hết hạn phải đăng nhập lại thủ công, chưa có cơ chế tự làm mới |
| CI (tự động chạy `npm test` qua GitHub Actions) | Có thể để sau | Hiện phải tự gõ `npm test` |
| Tách `server/index.js` thành route files riêng | Khi file quá dài | Hiện ~960 dòng (tăng dần), cân nhắc khi thêm module mới |

## ✅ Đã hoàn thành (tick khi CTO AI xác nhận có evidence)
- [x] CRUD Create/Read/Update/Delete (soft) cho Equipment.
- [x] Dashboard thống kê + cảnh báo (đã fix đếm đúng thiết bị chưa xoá).
- [x] Cây tổ chức 3 cấp + bộ lọc cascading.
- [x] Auto-mapping HRM theo tên chuẩn hoá.
- [x] 4 theme giao diện.
- [x] Bộ tài liệu AI (`docs/ai/`) — khởi tạo 2026-08-12.
- [x] Auth + RBAC (backend + frontend đầy đủ).
- [x] User Administration đầy đủ: tạo, sửa tên/role, reset mật khẩu, vô hiệu hoá/kích
  hoạt lại — kèm rate-limit đăng nhập chống brute-force.
- [x] 55 test tự động.
