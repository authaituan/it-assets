# 🚀 Hướng dẫn triển khai Production (deploy)

> File này dành cho khi anh chuyển từ chạy dev (`npm run dev` / `node server/index.js`
> trên máy cá nhân) sang chạy thật trên máy chủ. Không phải code, là các bước thao tác
> tay khi deploy — không AI nào có thể tự làm thay vì cần quyền truy cập máy chủ thật.

## 1. Set `JWT_SECRET` thật (bắt buộc trước khi deploy)

**Vì sao quan trọng**: hiện tại nếu không set biến môi trường `JWT_SECRET`, server tự
dùng 1 chuỗi mặc định cố định (`server/auth.js:12`) — bất kỳ ai đọc được mã nguồn (kể
cả trên GitHub công khai... dù repo này đang private) đều biết được chuỗi đó, và có thể
tự ký ra token giả mạo bất kỳ quyền nào (kể cả ADMIN) mà không cần mật khẩu.

**Cách tạo 1 chuỗi bí mật đủ mạnh** (chạy trên máy, 1 lần duy nhất, lưu lại an toàn — không
commit vào Git):
```
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**Cách set biến môi trường** (tuỳ máy chủ triển khai thật, ví dụ phổ biến):
- Nếu chạy trực tiếp bằng `node`: tạo file `.env` ở thư mục gốc dự án (đã có sẵn trong
  `.gitignore`, sẽ không bị commit nhầm):
  ```
  JWT_SECRET=<dán_chuỗi_vừa_tạo_ở_trên>
  ```
  rồi cần thêm thư viện đọc `.env` (ví dụ `dotenv`) nếu server chưa tự đọc — hiện
  `server/index.js`/`server/auth.js` CHƯA có `require('dotenv').config()`, cần Dev AI bổ
  sung nếu chọn hướng deploy này.
- Nếu deploy bằng PM2: set trong `ecosystem.config.js` mục `env`.
- Nếu deploy bằng Docker: set qua `-e JWT_SECRET=...` hoặc trong `docker-compose.yml`.
- Nếu deploy lên nền tảng cloud (Render, Railway, VPS có control panel...): set trong
  mục "Environment Variables" của nền tảng đó.

**Xác nhận đã set đúng**: khởi động server, KHÔNG được thấy dòng cảnh báo
`[auth] CẢNH BÁO: JWT_SECRET chưa được set...` trong log console.

⚠️ Lưu ý: nếu đổi `JWT_SECRET` trong khi hệ thống đang có người dùng đăng nhập, mọi
token cũ (ký bằng secret cũ) sẽ ngay lập tức không hợp lệ nữa — mọi người sẽ bị đăng
xuất và phải đăng nhập lại. Nên đổi vào giờ ít người dùng.

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
