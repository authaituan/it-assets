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

## ✅ VÒNG 2 — Gần hoàn tất (2026-08-12)

| Việc | Trạng thái | Ghi chú |
|---|---|---|
| Route quản trị user (tạo/đổi mật khẩu qua UI) | [x] Merged (PR #5) | 5 route + UI đầy đủ, 15 test tự động |
| Rate-limit đăng nhập (chống brute-force) | [x] Code xong, **chờ PO push + merge** | 5 lần sai/15 phút theo (IP+hrm_code), verify bằng test + curl thật |
| Set `JWT_SECRET` thật khi deploy production | [x] Hướng dẫn xong (`06_DEPLOYMENT.md`) | Thao tác vận hành, PO tự làm khi deploy thật, không phải code |
| Dọn `.claude/launch.json` lọt vào repo | [x] Code xong, **chờ PO push + merge** | Phát hiện khi audit lại toàn bộ repo |
| Test tự động cho route user-admin | [x] Code xong, **chờ PO push + merge** | `tests/users.test.js`, 15 test — tổng còn 49 test |
| Refresh token / logout phía server | [ ] Chưa giao | Còn lại duy nhất của Vòng 2, xem mục dưới |

**4 việc trên (rate-limit, dọn file, test mới, 06_DEPLOYMENT.md) đã code + test xong
trong sandbox Claude, đóng gói sẵn để PO áp vào máy — xem hướng dẫn ở tin nhắn kèm theo.**

## 🔵 VÒNG 3 — Đề xuất (chưa giao)

| Việc | Mức độ | Ghi chú |
|---|---|---|
| Refresh token / logout phía server | Có thể để sau | Hiện token hết hạn phải đăng nhập lại thủ công, chưa có cơ chế tự làm mới |
| CI (tự động chạy `npm test` qua GitHub Actions) | Có thể để sau | Hiện phải tự gõ `npm test` |
| Tách `server/index.js` thành route files riêng | Khi file quá dài | Hiện ~950 dòng (tăng dần), cân nhắc khi thêm module mới |

## ✅ Đã hoàn thành (tick khi CTO AI xác nhận có evidence)
- [x] CRUD Create/Read/Update/Delete (soft) cho Equipment.
- [x] Dashboard thống kê + cảnh báo (đã fix đếm đúng thiết bị chưa xoá).
- [x] Cây tổ chức 3 cấp + bộ lọc cascading.
- [x] Auto-mapping HRM theo tên chuẩn hoá.
- [x] 4 theme giao diện.
- [x] Bộ tài liệu AI (`docs/ai/`) — khởi tạo 2026-08-12.
- [x] Auth + RBAC (backend + frontend đầy đủ).
- [x] User Administration (tạo/sửa/xoá quyền, đổi mật khẩu) + rate-limit đăng nhập.
- [x] 49 test tự động.
