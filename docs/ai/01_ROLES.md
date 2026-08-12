# 👥 VAI TRÒ TRONG DỰ ÁN

File này gần như tĩnh — chỉ sửa khi thêm/bớt thành viên hoặc đổi phân công.

## 1. PO — Chủ dự án (Tân)
- Người duy nhất **quyết định** hướng đi, độ ưu tiên, và duyệt việc "coi như xong".
- Không cần đọc code. Chỉ cần đọc báo cáo 3 phần từ CTO AI (xem `02_WORKFLOW.md`).
- Là người duy nhất được sửa `01_ROLES.md`, `02_WORKFLOW.md` (thay đổi quy trình).

## 2. CTO AI — Vai trò phản biện & báo cáo (do PO chỉ định mỗi phiên, vd. ChatGPT, Gemini...)
- **Không viết code.** Nhiệm vụ duy nhất: đọc `README_AI.md` → `00_SNAPSHOT.md` →
  kết quả Dev AI vừa nộp → phản biện → viết báo cáo 3 phần bằng ngôn ngữ **không kỹ thuật**.
- Phải chỉ ra được rủi ro/drift nếu có (không tô hồng kết quả).
- Không được tự chọn model cụ thể cho Dev AI — chỉ đề xuất, PO/CTO cùng quyết theo
  bảng thế mạnh ở mục 4.

## 3. Dev AI #1 — Antigravity (Google, các model Gemini)
| Model | Vai trò gợi ý | Vì sao |
|---|---|---|
| Gemini 3.6 Flash | Task lặp, nhanh, rẻ: sinh dữ liệu mẫu, viết script nhỏ, format lại file, seed data | Model nhanh/nhẹ nhất trong bộ 3 — phù hợp việc khối lượng lớn, ít suy luận sâu |
| Gemini 3.1 Pro | Việc code hàng ngày: sửa bug, viết component/route mới theo spec rõ ràng | Cân bằng tốc độ/chất lượng cho việc chuẩn, không cần kiến trúc lớn |
| Gemini 3.5 Pro | Việc cần suy luận nhiều hơn: thiết kế schema mới, refactor liên module, review logic phức tạp | Model mạnh nhất trong bộ Antigravity ở đây — dùng khi việc rủi ro cao hơn |

## 4. Dev AI #2 — Claude Code (Anthropic, các model Claude)
| Model | Vai trò gợi ý | Vì sao |
|---|---|---|
| Haiku 4.5 | Task lặp, nhanh, rẻ — tương tự Flash bên Antigravity | Nhanh, chi phí thấp, phù hợp việc rõ ràng không cần suy luận sâu |
| Sonnet 5 | Việc code chính hàng ngày: full-stack feature (API + UI), audit code, viết tài liệu | Cân bằng tốt nhất giữa chất lượng và tốc độ cho công việc lặp lại theo phiên |
| Opus 4.8 | Việc khó nhất: thiết kế lại kiến trúc, xử lý bug hệ thống khó tái hiện, quyết định
kỹ thuật ảnh hưởng nhiều module | Model có khả năng suy luận sâu nhất trong bộ Claude hiện có |
| Fable 5 | Việc cần soạn nội dung/tài liệu diễn giải dài, hoặc brainstorm phương án | Thiên về tạo nội dung mạch lạc, phù hợp tài liệu hoá và trình bày phương án |

> ⚠️ Lưu ý: bảng trên là khung gợi ý ban đầu dựa trên mô hình phổ biến
> "model nhỏ = việc lặp/rẻ, model lớn = việc khó/rủi ro cao". Đây **không phải** số liệu
> benchmark đã kiểm chứng cho từng phiên bản cụ thể — PO nên tinh chỉnh bảng này theo
> trải nghiệm thực tế sau vài lần giao việc, rồi cập nhật lại file này.

## 5. Nguyên tắc chọn AI cho 1 task (checklist nhanh cho CTO AI)
1. Task có rủi ro phá vỡ nhiều module / liên quan kiến trúc? → dùng model "mạnh nhất" (Opus / Gemini 3.5 Pro).
2. Task rõ spec, 1 module, ít rủi ro? → model "chính" (Sonnet / Gemini 3.1 Pro).
3. Task lặp lại, khối lượng lớn, ít suy luận (seed data, format, đổi tên hàng loạt)? → model "nhanh/rẻ" (Haiku / Flash).
4. Task là viết/diễn giải tài liệu dài? → Fable 5.
5. Nếu không chắc, chọn model "chính" trước — không mặc định dùng model mạnh nhất cho mọi việc (tốn quota).
