# DESIGN FLAT - TOKENS & TYPOGRAPHY

## 1. Design Tokens
Màu (Flat UI Colors – bảng French):
| Token Tailwind | Hex | Dùng cho |
|---|---|---|
| `primary` | #4a69bd | KPI chính, liên kết, focus ring, thanh biểu đồ chính |
| `accent` | #f6b93b | Nút chính (chữ `ink`), nhấn |
| `success` | #78e08f | Trạng thái tốt/Đang dùng, mục menu đang chọn |
| `danger` | #e55039 | Cảnh báo, thu hồi, xoá (chữ trắng, đậm ≥ 13px) |
| `info` | #60a3bc | Viền thẻ/đường kẻ chính, thanh biểu đồ phụ |
| `sky` | #82ccdd | Ô icon phụ |
| `ink` | #2D3436 | Chữ chính, nét icon |
| `muted` | #3B4A5A | Chữ phụ, label |
| `surface` | #FFFFFF | Nền trang, thẻ |
| `surface-alt` | #E9EEF2 | Ô input, đầu bảng, track biểu đồ, đường kẻ hàng |
| `sidebar` | #F1F4F8 | Nền sidebar |

Khai báo bằng Tailwind v4 `@theme { --color-primary: #4a69bd; ... }` trong src/index.css để dùng `bg-primary`, `text-ink`, `border-info`…
Quy tắc phẳng: **không** gradient, **không** shadow, **không** blur/glass, **không** bo góc (`rounded-none`, giữ bo tròn chỉ cho avatar/chấm trạng thái). Thẻ: nền trắng + viền 2px `info`. Đường kẻ bảng: 2px `surface-alt`.
Tương phản: chữ trắng chỉ đặt trên `primary`, `danger`; chữ `ink` đặt trên `accent`, `success`, `sky`, `surface-alt`. Chữ nhỏ (<13px) không đặt trên `danger`.

## 2. Typography
- Font duy nhất: **Be Vietnam Pro** (400, 600, 700, 800).
- body: 14px, màu `ink`. h1 30px/800, h2 17–18px/800. Label viết hoa: 12px/800, letter-spacing 0.05em, màu `muted`. Số KPI: 44px/800.

## 3. Bảng ánh xạ class (từ Dark/Glass cũ sang Flat mới)
Để các PR sau dùng chung, dưới đây là ánh xạ các class cần thay đổi:

| Class dark cũ | Thay bằng |
|---|---|
| `text-white`, `text-slate-100/200/300` | `text-ink` |
| `text-slate-400/500` | `text-muted` |
| `bg-slate-800/900/950`, `bg-white/5` | `bg-surface` (thẻ) hoặc `bg-surface-alt` (ô input, đầu bảng) |
| `border-slate-600/700/800`, `border-white/10` | `border-info` (thẻ) hoặc `border-surface-alt` (đường kẻ hàng) |
| `text-cyan-300/400`, `bg-cyan-500` (nút/gradient) | `text-primary`; nút chính `bg-accent text-ink font-bold` |
| `emerald-*` | `bg-success text-ink` |
| `rose-*`, `red-*` | `bg-danger text-white` |
| `amber-*`, `yellow-*` | `bg-accent text-ink` |
| `shadow-*`, `backdrop-blur*`, `bg-gradient-*`, `rounded-xl/2xl/lg` | bỏ (phẳng, vuông) |

Icon: giữ bộ lucide-react hiện có; trong menu/thao tác đặt icon trong ô vuông 32px nền `success`/`accent`/`sky`, nét `ink` 18px, stroke 2.

## 4. Mẫu thành phần dùng chung
- **Thẻ**: `bg-surface border-2 border-info`, padding 24px.
- **Tiêu đề trang**: h1 30px/800 `ink`, mô tả 14px `text-muted`.
- **Nút chính**: `bg-accent text-ink font-bold h-10 px-4`, hover `hover:bg-accent-hover`. **Nút phụ**: `bg-surface-alt text-ink font-bold h-10 px-4 hover:bg-sky`. **Nút nguy hiểm**: `bg-danger text-white font-bold h-10 px-4`. Disabled: `opacity-50 cursor-not-allowed`.
- **Ô nhập / select / textarea**: `bg-surface-alt text-ink text-[14px] h-10 px-3 w-full`, không viền, placeholder `text-muted`, focus `outline-2 outline-primary`. Nhãn: 12px/800 viết hoa tracking 0.05em `text-muted`, cách ô nhập 6px. Ô lỗi: thêm `outline-2 outline-danger`; dòng lỗi dưới ô: 13px/700 `text-danger`.
- **Khối thông báo**: lỗi `bg-danger text-white`; thành công `bg-success text-ink`; cảnh báo `bg-accent text-ink`; thông tin `bg-sky text-ink`; padding 12px, 13px/700, kèm icon lucide 18px.
- **Modal**: lớp phủ `bg-ink/50` (KHÔNG blur); hộp `bg-surface border-2 border-info`, `max-w` như hiện tại; thanh tiêu đề: tiêu đề 18px/800 `ink` + nút đóng vuông 32px `bg-surface-alt hover:bg-sky` icon X; đường kẻ dưới tiêu đề 2px `surface-alt`; chân modal: nút phụ "Hủy/Đóng" trái, nút chính bên phải, đường kẻ trên 2px `surface-alt`.
- **Bảng**: hàng đầu `bg-surface-alt`, chữ 12px/800 viết hoa tracking 0.05em `muted`, padding 12px 20px; hàng dữ liệu `border-t-2 border-surface-alt`, padding 14px 20px, chữ 14px `ink`; hover `bg-sidebar`; chữ phụ 12px `muted`. Không dùng `divide-slate-*`.
- **Huy hiệu trạng thái** (ô chữ nhật, không bo): 12px/800, padding 2px 10px — tốt/Đang dùng `bg-success text-ink`; thu hồi/lỗi `bg-danger text-white`; loại "Cá nhân" `bg-accent text-ink`; "Đơn vị" `bg-sky text-ink`.
- **Nút thao tác trong hàng**: ô vuông 32px `bg-success` (sửa) / `bg-surface-alt` (thu hồi/khôi phục), icon lucide 16px stroke `ink`, hover `bg-sky`; giữ nguyên `title` hiện có.
- **Phân trang / tổng số**: chữ 13px/700 `muted`, số in đậm `ink`; nút trang vuông `bg-surface-alt`, trang hiện tại `bg-primary text-white`.

