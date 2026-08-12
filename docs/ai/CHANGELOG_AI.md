# 📝 AI-Assisted Changes Changelog

Ghi lại các thay đổi được thực hiện với hỗ trợ của AI/Claude Code.

---

## [2026-08-12] - Fix Documentation Drift (fix/docs-drift)

### Changes
- **README.md**: Sửa lại mục "Công Nghệ Sử Dụng" - bỏ "Prisma 3NF" khỏi Backend stack, chỉ để "SQLite (better-sqlite3)" để phản ánh đúng dependency thực tế.
- **package.json**: Cập nhật script `seed` từ `node scripts/seed_from_excel.js` (file không tồn tại) thành `python scripts/seed.py` (file thực tế đang có).

### Reason
Xóa 2 điểm drift được phát hiện giữa tài liệu (docs) và thực tế mã nguồn/package.json.

### Related Issue
- docs/ai/04_DECISIONS.md - Drift phát hiện (sections 1 & 2)

---
