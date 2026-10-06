# 📝 BACKLOG — Việc tiếp theo

> File "sống", chỉ giữ VIỆC CÒN LẠI. Lịch sử đã làm: `CHANGELOG_AI.md`. Trạng thái hiện tại: `00_SNAPSHOT.md`.
> Mỗi việc = 1 branch riêng, merge xong mới sang việc sau (nhiều việc cùng chạm `server/index.js`).
> Cập nhật lần cuối: 2026-10-06, main = `fd86207`, 158/158 test pass.

## ✅ Đã hoàn tất (tóm tắt, không làm lại)
Auth + RBAC, soft-delete, transaction, validate, User Admin, rate-limit · Mã CCDC theo loại ·
"Phân loại chi tiết" · Người sử dụng (CRUD/import/autocomplete) · Import/Export Excel CCDC ·
Quản lý mạng lưới (Danh sách/Cây/Bản đồ, Người phụ trách, danh mục chuẩn) · dọn 21 bưu cục rác ·
Governance V2 · Sidebar Sentence case · Lọc IP truy cập + header bảo mật + trang 404 ·
bắt buộc `JWT_SECRET`/`.env` · giới hạn body đăng nhập · tách `server/index.js` thành routes/lib ·
CI GitHub Actions · Quản lý email (backend + danh sách + thêm/sửa/thu hồi/kích hoạt lại + Import/Export Excel).

## 🔴 Nên làm tiếp (theo thứ tự)

| # | Việc | Ai làm | Ghi chú |
|---|---|---|---|
| 1 | Bổ sung toạ độ cho bưu cục thiếu (mới 15/206 có vĩ/kinh độ) | PO + dev nhỏ | PO gửi Excel có Vĩ độ/Kinh độ; đưa vào bằng Import mạng lưới (đã có cột), không cần code mới |

## 🟡 Có thể để sau

| Việc | Ghi chú |
|---|---|
| Vô hiệu hoá token tức thời + logout/refresh token phía server | Hiện token tài khoản bị khoá còn dùng được tới khi hết hạn (`JWT_EXPIRY`, 8h) |
| Content-Security-Policy cho app chính | Cần thử trên UI thật vì Leaflet tải ảnh bản đồ ngoài |
| Sửa `GET /api/organization/tree` trả 500 khi DB chưa có BĐT/TP | Có từ trước, chỉ gặp với DB rỗng |
| HTTPS cho LAN | Token/mật khẩu đang đi dạng chữ rõ trong mạng nội bộ |
| Xoay vòng `data/security.log` | Chưa tự giới hạn dung lượng |
| Sửa `normalizeStr` dùng chung (`server/lib/helpers.js`) cho chữ `đ`/`Đ` | Hiện chỉ trang Email xử lý riêng; tìm "dong ha" ở Người sử dụng/CCDC/mạng lưới chưa ra "Đông Hà" |
| Ô tìm kiếm trên thanh đầu trang khi đang ở Quản lý email | Placeholder còn ghi "Tìm kiếm máy tính, IP..." và dùng chung nội dung với ô tìm trong trang email |
| Ô tìm kiếm đầu trang giữ chữ khi đổi tab | Chuyển tab sang Quản lý email có thể còn từ khoá cũ của tab trước |
| Vào Quản lý CCDC từ Dashboard/tìm kiếm đầu trang sau khi dùng bộ lọc "Xem thiết bị tại đây" | Có thể còn bộ lọc BĐX/bưu cục cũ |

## 🟢 Vận hành (PO tự làm, không cần dev)
- Đặt DHCP reservation trên router cho máy chủ và các máy trong danh sách `CMS_ALLOWED_IPS` (IP đổi là bị 404).
- Backup `data/ccdc.db` định kỳ; xoá `data/ccdc.db.backup-*` cũ sau vài ngày.
- Chuyển hẳn sang mô hình 1 cổng (:5000), đóng firewall cổng 3000.
- Tuỳ chỉnh qua "Quản lý danh mục": trùng prefix `SCA` (SCANNER + SCALE), 2 danh mục gộp
  (Máy tính & POS, Thiết bị mạng).
- Đổi mật khẩu admin đầu tiên nếu còn mật khẩu setup.
- Dọn nhánh GitHub đã merge (Settings → Branches, hoặc trang Branches).
