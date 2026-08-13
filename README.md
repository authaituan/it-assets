# 📦 IT Assets Management System (Hệ Thống Quản Lý CCDC CNTT Bưu Điện)

Hệ thống **Quản Lý Công Cụ Dụng Cụ CNTT Bưu Điện** được thiết kế phục vụ quản lý, giám sát, luân chuyển và bảo trì thiết bị hạ tầng CNTT toàn diện cho Bưu điện Thành Phố Huế (`Mã 53`).

---

## 🌟 Tính Năng Nổi Bật

1. **Phân Cấp Đơn Vị Chuẩn Bưu Điện Xã (BĐX)**:
   - Phân cấp 3 tầng chính: **Bưu điện Tỉnh (BĐT/TP) ➔ Bưu điện Xã (BĐX) ➔ Bưu cục (MBC)**.
   - Quản lý 44 Bưu điện Xã và 206 Bưu cục/Điểm giao dịch.
2. **Bộ Lọc Phân Cấp Cascading Filters**:
   - Chọn **Bưu điện Xã (BĐX)** ➔ Tự động lọc danh sách **Bưu cục (MBC)** tương ứng.
3. **Quản Lý CCDC Đa Thiết Bị CNTT (Multi-Device IT Assets)**:
   - Hỗ trợ mọi loại thiết bị: **Máy tính & POS, Máy in Bưu chính, Máy quét mã vạch, Thiết bị Mạng, Bộ lưu điện (UPS), Camera an ninh, Cân điện tử**.
   - Cấu hình thông số kỹ thuật động lưu dưới dạng JSON (`cpu`, `ram`, `storage`, `os`).
4. **Module Tự Động Auto-Mapping File HRM Nhân Sự**:
   - Thuật toán Smart Matching loại bỏ dấu tiếng Việt & tự động map tên thô từ Excel (`raw_user_name`) với file HRM (`Mã HRM`, `Họ và Tên`, `Mã Bưu cục`, `Mã BĐX`) để gán chính xác `assigned_user_id`.
5. **Chế Độ Xem Chi Tiết & Chỉnh Sửa Tức Thì (Edit Mode)**:
   - Xem chi tiết thông số, vị trí, người bàn giao và lịch sử luân chuyển thiết bị.
   - Nút `[✏️ Chỉnh Sửa]` sửa ngay Tên máy, IP, MAC, Serial, Người sử dụng, Trạng thái và Specs.
6. **Thêm Danh Mục CCDC Lớn (Custom Categories)**:
   - Nút `[Thêm Danh Mục CCDC]` hỗ trợ tạo thêm các loại thiết bị lớn mới (Máy chiếu, Máy Kiosk, Máy Scan 3D...).
7. **Bộ Chuyển Đổi Giao Diện 4 Template (Live Theme Switcher)**:
   - 🌌 **Cyberpunk Neon**: Thủy tinh Kính Dark Cyan hiện đại.
   - 👑 **Bưu Điện Hoàng Gia**: Xanh Mực Bưu Điện & Vàng Kim sang trọng.
   - ❇️ **Obsidian Emerald**: Đen Tuyền & Ngọc Lục Bảo Tech.
   - ☀️ **Nordic Light Crisp**: Giao Diện Sáng Sang Trọng Tối Giản.

---

## 🛠️ Công Nghệ Sử Dụng

- **Backend**: Node.js, Express.js, SQLite (better-sqlite3), OpenPyXL / ExcelJS parser.
- **Frontend**: React 18, Vite, TailwindCSS v4, Lucide Icons, Recharts data visualization.
- **Data Ingestion**: Python data parser & automated SQLite seeder script from `dulieu.xlsx`.

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Cục Bộ

### 1. Cài Đặt Dependencies:
```bash
npm install
```

### 2. Khởi Tạo Dữ Liệu Từ `dulieu.xlsx`:
```bash
python scripts/seed.py
```

### 3. Chạy Ứng Dụng Fullstack (Vite + Express Server):
```bash
npm run dev
```
- **Frontend App**: `http://localhost:3000`
- **Backend API**: `http://localhost:5000`

---

## 📝 Thông Tin Repository
- **GitHub Repository**: [https://github.com/authaituan/it-assets](https://github.com/authaituan/it-assets)
- **Đơn vị quản lý**: Bưu điện Thành Phố Huế (Mã 53)
