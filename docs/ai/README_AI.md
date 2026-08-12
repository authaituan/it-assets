# README_AI — Chỉ mục tài liệu AI (it-assets)

> Thư mục `docs/ai/` chứa tài liệu ngữ cảnh cho Dev AI làm việc trên dự án **Quản lý CCDC Bưu điện Huế**.
> Đọc các file này trước khi thực hiện thay đổi để nắm hiện trạng (evidence-based).

## Danh mục
| File | Nội dung |
|------|----------|
| [00_SNAPSHOT.md](00_SNAPSHOT.md) | Ảnh chụp nhanh hiện trạng: stack, bảng dữ liệu, API, "Chưa có / rủi ro". |
| [03_ARCHITECTURE_MAP.md](03_ARCHITECTURE_MAP.md) | Bản đồ kiến trúc tầng, file map, luồng phân quyền RBAC. |
| [04_DECISIONS.md](04_DECISIONS.md) | Các quyết định kỹ thuật & drift đã phát hiện/xử lý. |
| [CHANGELOG_AI.md](CHANGELOG_AI.md) | Nhật ký thay đổi có hỗ trợ AI. |

## Nguyên tắc làm việc
1. **Evidence-based**: đọc lại chính file đã sửa để xác nhận, không giả định.
2. **Phạm vi hẹp**: chỉ sửa đúng hạng mục được giao.
3. **Không đổi** database engine, không thêm ORM mới.
4. Ghi lại thay đổi vào `CHANGELOG_AI.md` và cập nhật `00_SNAPSHOT.md` khi trạng thái hệ thống đổi.
