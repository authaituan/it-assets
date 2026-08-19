# 🚪 CỔNG CHÀO AI — it-assets (Quản lý CCDC Bưu điện Huế)

> File này là **điểm vào duy nhất** cho bất kỳ AI nào (CTO AI, Antigravity, Claude Code...)
> khi bắt đầu một phiên làm việc. Đọc đúng thứ tự bên dưới — KHÔNG tự ý đọc toàn bộ repo.

## Danh mục đầy đủ (10 file — KHÔNG được xoá/gộp/viết đè bất kỳ file nào dưới đây)
| File | Nội dung | Ai được sửa |
|------|----------|------|
| [00_SNAPSHOT.md](00_SNAPSHOT.md) | **Trạng thái HIỆN TẠI CHỈ** — stack, API, business rules, frontend, rủi ro. KHÔNG chứa lịch sử/tường thuật test | Dev AI (cập nhật trạng thái, KHÔNG thêm mục "mới, feat/X" tường thuật — xem quy tắc 7) |
| [01_ROLES.md](01_ROLES.md) | Vai trò PO/CTO AI/Dev AI + bảng chọn model theo thế mạnh | **Chỉ PO** |
| [02_WORKFLOW.md](02_WORKFLOW.md) | Quy trình báo cáo CTO → PO, mẫu báo cáo 3 phần | **Chỉ PO** |
| [03_ARCHITECTURE_MAP.md](03_ARCHITECTURE_MAP.md) | Bản đồ kiến trúc — chỉ trỏ đường tới file, không dump code | Dev AI |
| [04_DECISIONS.md](04_DECISIONS.md) | Quyết định & drift & lịch sử quan trọng, append-only, đánh số | Dev AI (chỉ thêm dòng) |
| [05_BACKLOG.md](05_BACKLOG.md) | Việc tiếp theo, có thứ tự phụ thuộc | Dev AI / CTO AI |
| [CHANGELOG_AI.md](CHANGELOG_AI.md) | **Lịch sử chi tiết đầy đủ từng PR** (kể cả bước test UI) — mới nhất ở đầu, append-only | Dev AI (chỉ thêm ở đầu) |
| [prompts/antigravity_prompt_template.md](prompts/antigravity_prompt_template.md) | Khung prompt tái dùng cho Antigravity | **Chỉ PO** |
| [prompts/claude_code_prompt_template.md](prompts/claude_code_prompt_template.md) | Khung prompt tái dùng cho Claude Code | **Chỉ PO** |
| [06_DEPLOYMENT.md](06_DEPLOYMENT.md) | Hướng dẫn deploy production (JWT_SECRET, checklist) | **Chỉ PO** (thao tác vận hành, không phải code) |

## 📖 Ngân sách đọc — CHỈ đọc đúng thứ cần, không đọc tràn lan
**Bắt buộc mọi task**: `README_AI.md` (file này) + `00_SNAPSHOT.md`. 2 file này đã ĐỦ
để hiểu route/schema/business rule hiện tại cho phần lớn task — không cần đọc thêm gì
khác trừ khi task cụ thể chỉ định.
- **Cần chi tiết route/frontend cụ thể chưa đủ trong `00_SNAPSHOT.md`?** → đọc thêm
  `03_ARCHITECTURE_MAP.md` (chỉ mục liên quan, không cần đọc hết).
- **Cần biết field JSON chính xác của 1 route cụ thể (vd export/import Excel)?** →
  `grep` đúng tên route trong `CHANGELOG_AI.md` hoặc `03_ARCHITECTURE_MAP.md`, KHÔNG đọc
  cả file từ đầu.
- **Cần biết "vì sao" 1 quyết định nghiệp vụ được chốt thế này?** → `grep` từ khoá trong
  `04_DECISIONS.md`, không đọc hết 300+ dòng.
- **KHÔNG BAO GIỜ cần đọc hết `CHANGELOG_AI.md`** — chỉ dùng để tra cứu 1 mục cụ thể
  khi có tham chiếu rõ ràng từ prompt hoặc từ `00_SNAPSHOT.md`.

## ⚠️ Quy tắc bắt buộc — đọc trước khi sửa bất kỳ file nào trong `docs/ai/`
1. **KHÔNG viết đè toàn bộ file** dưới danh nghĩa "cập nhật". Chỉ thêm/sửa đúng phần
   liên quan tới hạng mục đang làm. Nếu thấy cấu trúc file hiện tại không hợp lý, ghi
   đề xuất vào `04_DECISIONS.md`, KHÔNG tự ý viết lại — đây từng là nguyên nhân khiến
   `01_ROLES.md`, `02_WORKFLOW.md`, `05_BACKLOG.md`, `prompts/` bị xoá mất khỏi repo
   ngày 2026-08-12 khi 1 Dev AI viết đè cả thư mục.
2. **Evidence-based**: mọi claim về code phải trỏ được `path:line`. Không đoán.
3. **Không dump code vào chat/báo cáo** — chỉ trích dẫn `file:line` + mô tả ngắn.
4. **Không tự ý mở rộng phạm vi** — chỉ làm đúng 1 hạng mục được giao trong prompt.
4b. **Không dùng `git add .` một cách vô thức** — luôn `git status` đọc kỹ từng dòng
   trước khi add, chỉ `git add <đúng file thuộc phạm vi>`. Đã 2 lần file thừa (script
   debug tạm, file dữ liệu bị chạm nhầm) lọt vào commit vì thói quen `git add .`, xem
   `04_DECISIONS.md` mục 9.
5. Sau khi xong việc, PHẢI thêm 1 dòng vào `CHANGELOG_AI.md` (ở ĐẦU file) — không cập
   nhật = coi như chưa xong. Đây là nơi DUY NHẤT nên viết tường thuật chi tiết đầy đủ
   (bước test, số liệu...).
6. Nếu phát hiện README/comment/code lệch nhau (semantic drift) → ghi vào
   `04_DECISIONS.md` mục "Drift phát hiện", không tự sửa nếu chưa được PO duyệt hướng xử lý.
7. **`00_SNAPSHOT.md` PHẢI luôn ở dạng "trạng thái hiện tại", KHÔNG được thêm mục "mới,
   feat/X" kiểu tường thuật cho từng PR** (lỗi này đã khiến file phình từ ~150 lên 665
   dòng, phải nén lại ngày 2026-08-18 — xem `04_DECISIONS.md` mục 16). Khi cập nhật:
   SỬA đúng đoạn mô tả route/rule/component liên quan tới thay đổi (viết đè giá trị mới
   lên đúng chỗ cũ), KHÔNG thêm đoạn mới bên cạnh. Tường thuật đầy đủ ("đã test qua UI
   thế nào", "số liệu trước/sau"...) CHỈ viết vào `CHANGELOG_AI.md`, không viết vào đây.

## Liên kết ổn định (dùng khi cần gửi cho AI khác)
```
https://raw.githubusercontent.com/authaituan/it-assets/main/docs/ai/README_AI.md
```
