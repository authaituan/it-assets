# 🚪 CỔNG CHÀO AI — it-assets (Quản lý CCDC Bưu điện Huế)

> File này là **điểm vào duy nhất** cho bất kỳ AI nào (CTO AI, Antigravity, Claude Code...)
> khi bắt đầu một phiên làm việc. Đọc đúng thứ tự bên dưới — KHÔNG tự ý đọc toàn bộ repo.

## Danh mục đầy đủ (9 file — KHÔNG được xoá/gộp/viết đè bất kỳ file nào dưới đây)
| File | Nội dung | Ai được sửa |
|------|----------|------|
| [00_SNAPSHOT.md](00_SNAPSHOT.md) | Ảnh chụp nhanh hiện trạng: stack, bảng dữ liệu, API, rủi ro | Dev AI (cập nhật, không đổi cấu trúc) |
| [01_ROLES.md](01_ROLES.md) | Vai trò PO/CTO AI/Dev AI + bảng chọn model theo thế mạnh | **Chỉ PO** |
| [02_WORKFLOW.md](02_WORKFLOW.md) | Quy trình báo cáo CTO → PO, mẫu báo cáo 3 phần | **Chỉ PO** |
| [03_ARCHITECTURE_MAP.md](03_ARCHITECTURE_MAP.md) | Bản đồ kiến trúc — chỉ trỏ đường tới file, không dump code | Dev AI |
| [04_DECISIONS.md](04_DECISIONS.md) | Quyết định & drift, append-only | Dev AI (chỉ thêm dòng) |
| [05_BACKLOG.md](05_BACKLOG.md) | Việc tiếp theo, có thứ tự phụ thuộc | Dev AI / CTO AI |
| [CHANGELOG_AI.md](CHANGELOG_AI.md) | Nhật ký 1 dòng/phiên, append-only | Dev AI (chỉ thêm dòng) |
| [prompts/antigravity_prompt_template.md](prompts/antigravity_prompt_template.md) | Khung prompt tái dùng cho Antigravity | **Chỉ PO** |
| [prompts/claude_code_prompt_template.md](prompts/claude_code_prompt_template.md) | Khung prompt tái dùng cho Claude Code | **Chỉ PO** |
| [06_DEPLOYMENT.md](06_DEPLOYMENT.md) | Hướng dẫn deploy production (JWT_SECRET, checklist) | **Chỉ PO** (thao tác vận hành, không phải code) |

## ⚠️ Quy tắc bắt buộc — đọc trước khi sửa bất kỳ file nào trong `docs/ai/`
1. **KHÔNG viết đè toàn bộ file** dưới danh nghĩa "cập nhật". Chỉ thêm/sửa đúng phần
   liên quan tới hạng mục đang làm. Nếu thấy cấu trúc file hiện tại không hợp lý, ghi
   đề xuất vào `04_DECISIONS.md`, KHÔNG tự ý viết lại — đây từng là nguyên nhân khiến
   `01_ROLES.md`, `02_WORKFLOW.md`, `05_BACKLOG.md`, `prompts/` bị xoá mất khỏi repo
   ngày 2026-08-12 khi 1 Dev AI viết đè cả thư mục.
2. **Evidence-based**: mọi claim về code phải trỏ được `path:line`. Không đoán.
3. **Không dump code vào chat/báo cáo** — chỉ trích dẫn `file:line` + mô tả ngắn.
4. **Không tự ý mở rộng phạm vi** — chỉ làm đúng 1 hạng mục được giao trong prompt.
5. Sau khi xong việc, PHẢI thêm 1 dòng vào `CHANGELOG_AI.md` — không cập nhật = coi như
   chưa xong.
6. Nếu phát hiện README/comment/code lệch nhau (semantic drift) → ghi vào
   `04_DECISIONS.md` mục "Drift phát hiện", không tự sửa nếu chưa được PO duyệt hướng xử lý.

## Liên kết ổn định (dùng khi cần gửi cho AI khác)
```
https://raw.githubusercontent.com/authaituan/it-assets/main/docs/ai/README_AI.md
```
