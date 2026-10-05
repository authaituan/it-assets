# 🚀 Hướng dẫn triển khai Production (deploy)

> File này dành cho khi anh chuyển từ chạy dev (`npm run dev` / `node server/index.js`
> trên máy cá nhân) sang chạy thật trên máy chủ. Không phải code, là các bước thao tác
> tay khi deploy — không AI nào có thể tự làm thay vì cần quyền truy cập máy chủ thật.

## 1. Set `JWT_SECRET` thật (bắt buộc — thiếu thì server KHÔNG khởi động)

**Vì sao quan trọng**: nếu biết secret, kẻ tấn công tự ký được token giả mạo bất kỳ quyền
nào (kể cả ADMIN) mà không cần mật khẩu. Vì vậy từ `feat/security-hardening-2`, thiếu
`JWT_SECRET` thì `server/auth.js` báo lỗi rõ và thoát, không còn secret mặc định. Chỉ máy
dev mới được đặt `ALLOW_INSECURE_DEV=1` để dùng secret mặc định (kèm cảnh báo) — KHÔNG
dùng trên máy chủ thật.

**Cách tạo 1 chuỗi bí mật đủ mạnh** (chạy 1 lần, lưu an toàn — không commit vào Git):
```
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**Cách set**:
- Chạy trực tiếp bằng `node`: tạo file `.env` ở thư mục gốc dự án (đã có trong
  `.gitignore`):
  ```
  JWT_SECRET=<dán_chuỗi_vừa_tạo_ở_trên>
  ```
  `server/index.js` tự nạp `.env` bằng `process.loadEnvFile()` (Node 20.12+/21.7+, không
  cần thư viện `dotenv`). Biến môi trường hệ thống đã set sẵn luôn thắng giá trị trong
  `.env`. Lưu ý: `.env` được tìm theo thư mục làm việc hiện tại — chạy `node` từ thư mục
  gốc dự án.
- PM2: set trong `ecosystem.config.js` mục `env`.
- Docker: `-e JWT_SECRET=...` hoặc `docker-compose.yml`.
- Cloud/VPS: mục "Environment Variables" của nền tảng.

**Xác nhận**: khởi động server không báo lỗi `[auth] Thiếu JWT_SECRET`.

⚠️ Đổi `JWT_SECRET` khi đang có người đăng nhập sẽ làm mọi token cũ mất hiệu lực (mọi
người bị đăng xuất). Nên đổi vào giờ ít người dùng.

## 2. Rate-limit đăng nhập (đã có sẵn, không cần làm gì thêm)
Đã cài từ Vòng 2: tối đa 5 lần sai trong 15 phút cho mỗi cặp (IP + mã HRM), lần thứ 6
trả về `429 Too Many Requests` kèm header `Retry-After`. Xem `04_DECISIONS.md`.

## 3. Checklist trước khi deploy production
- [ ] Đã set `JWT_SECRET` thật (mục 1 ở trên).
- [ ] Đã đổi mật khẩu tài khoản admin đầu tiên (nếu tạo bằng script tay lúc setup).
- [ ] `npm test` chạy pass đầy đủ trên bản deploy.
- [ ] Đã backup `data/ccdc.db` trước khi deploy bản mới (SQLite là 1 file, dễ backup:
  copy nguyên file `data/ccdc.db` sang nơi lưu trữ khác).

## 4. Đang chạy trên mạng LAN nội bộ (từ 2026-08-12)

**Trạng thái hiện tại**: hệ thống đang chạy trên máy PO làm server, phục vụ trong mạng
LAN nội bộ. Đã verify: máy khác trong cùng mạng truy cập được qua trình duyệt.

- **Địa chỉ truy cập** (chỉ dùng được từ máy trong CÙNG mạng Wi-Fi/LAN với máy chủ):
  `http://10.47.33.33:3000`
- **Backend** (API, không cần truy cập trực tiếp trừ khi debug): `http://10.47.33.33:5000`
- Đây là **IP nội bộ (private)**, không phải IP public — máy ở mạng khác/Internet KHÔNG
  truy cập được bằng địa chỉ này. Muốn truy cập từ ngoài mạng nội bộ cần thêm port
  forwarding trên router + rủi ro bảo mật cao hơn hẳn (chưa có HTTPS, chưa có refresh
  token) — **chưa nên làm cho tới khi dùng ổn định trong nội bộ trước**.

**Cách khởi động lại** (sau khi tắt máy/mất điện/restart):
```
# Terminal 1 — Backend (cổng 5000)
$env:JWT_SECRET="<chuỗi bí mật đã tạo ở mục 1>"
node server/index.js

# Terminal 2 — Frontend (cổng 3000, bản đã build production)
npx vite preview --host 0.0.0.0 --port 3000
```

**Lưu ý IP có thể đổi**: `10.47.33.33` là IP do router DHCP cấp cho máy tại thời điểm
2026-08-12 — nếu máy chủ khởi động lại hoặc router cấp lại IP khác, địa chỉ này có thể
đổi. Kiểm tra lại bằng `ipconfig` (tìm IPv4 Address) nếu máy khác không truy cập được
nữa. Muốn cố định lâu dài, có thể đặt DHCP reservation cho máy này trên router (thao
tác trên router, không phải trong dự án).

**Firewall**: đã mở 2 rule `CCDC Backend` (5000) và `CCDC Frontend` (3000) trong Windows
Firewall — nếu đổi máy chủ khác, cần mở lại 2 rule này trên máy mới.

## 5. Lọc IP truy cập (từ `feat/ip-allowlist-security`)

**Cơ chế**: chỉ máy có IP nằm trong `CMS_ALLOWED_IPS` mới vào được hệ thống (cả giao
diện lẫn API). Máy khác thấy trang **404 Không tìm thấy trang** — không biết là có hệ
thống ở đây. Mỗi lần bị chặn, đăng nhập đúng/sai được ghi vào `data/security.log`.

| Biến | Ý nghĩa | Ví dụ |
|---|---|---|
| `CMS_ALLOWED_IPS` | IP đơn hoặc dải CIDR IPv4, cách nhau dấu phẩy. **Để trống = chỉ chính máy chủ** (127.0.0.1, ::1). `*` = mọi IP (chỉ để thử). | `127.0.0.1,::1,10.47.33.33,10.47.33.41` |
| `TRUSTED_PROXIES` | IP của proxy đứng trước backend. Chỉ khi đặt biến này backend mới đọc IP thật trong header `X-Forwarded-For`. | `127.0.0.1,::1` |
| `LOGIN_IP_MAX_FAILS` | Số lần đăng nhập sai tối đa / 15 phút từ 1 IP (cộng dồn mọi tài khoản). Mặc định 20. | `20` |
| `SECURITY_LOG` | File nhật ký bảo mật. Mặc định `data/security.log`. | |

Sai cú pháp trong danh sách IP → server **không khởi động** và báo rõ mục sai (cố ý: thà
không chạy còn hơn chạy với danh sách bị hiểu sai).

**Cách chạy hiện tại trên máy Windows (2 cổng: Vite preview :3000 + backend :5000)**:
Vite đã được cấu hình gửi kèm IP thật của máy khách (`xfwd: true` trong
`vite.config.mjs`), nên phải khai báo Vite (chạy trên chính máy chủ) là proxy tin cậy.
```
# BẮT BUỘC sau khi cập nhật bản này: build lại giao diện (giao diện cũ gọi API đọc
# không kèm token -> bị 401, màn hình trống)
npm run build

# Terminal 1 — Backend
$env:JWT_SECRET="<chuỗi bí mật>"
$env:CMS_ALLOWED_IPS="127.0.0.1,::1,10.47.33.33,<IP máy 1>,<IP máy 2>"
$env:TRUSTED_PROXIES="127.0.0.1,::1"
node server/index.js

# Terminal 2 — Frontend (khởi động lại để nhận cấu hình xfwd mới)
npx vite preview --host 0.0.0.0 --port 3000
```
- Giữ `127.0.0.1,::1` trong danh sách để chính máy chủ vẫn dùng được.
- Máy không có trong danh sách: vào `:5000` thấy trang 404; vào `:3000` vẫn thấy khung
  trang đăng nhập (Vite phục vụ file tĩnh) nhưng đăng nhập và mọi API đều bị chặn 404.
  Muốn chặn kín cả giao diện: dùng mô hình 1 cổng bên dưới.

**Mô hình 1 cổng (khuyên dùng, và là mô hình sẽ dùng khi đưa lên NAS/Docker)**:
`npm run build` rồi chỉ chạy `node server/index.js` — backend tự phục vụ giao diện trong
`dist/`. Truy cập `http://<IP máy chủ>:5000`, không cần `TRUSTED_PROXIES` (trừ khi có
reverse proxy phía trước), đóng rule firewall cổng 3000.

**Kiểm tra sau khi bật**:
1. Từ máy có trong danh sách: đăng nhập, mở Tổng quan / Quản lý CCDC — dữ liệu hiện đủ.
2. Từ máy KHÔNG có trong danh sách: mở `http://<IP máy chủ>:5000` → trang 404.
3. Mở `data/security.log` — thấy dòng `"event":"ip_denied"` kèm IP máy ở bước 2.
