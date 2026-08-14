# 03 — ARCHITECTURE MAP (it-assets)

> Bản đồ kiến trúc dựng từ code thực tế. Cập nhật: **2026-08-12** (`feat/auth-rbac`).

## Sơ đồ tầng
```
[ Browser / React (src/, Vite :3000) ]
            |  HTTP JSON (fetch)
            v
[ Express API  server/index.js  :5000 ]
   ├─ Auth:   POST /api/auth/login  ──► server/auth.js (JWT + scrypt)
   ├─ Middleware ghi: authRequired → requireManager
   ├─ Dashboard/Equipments/Organization/HRM handlers
            |
            v
[ better-sqlite3  server/db.js ] ──► data/ccdc.db (SQLite, WAL)
            ^
            |  seed
[ Python  scripts/seed.py ] ◄── dulieu.xlsx
```

## File map
| File | Vai trò |
|------|---------|
| `server/index.js` | Định nghĩa toàn bộ REST route + gắn middleware auth cho route ghi. |
| `server/db.js` | Khởi tạo SQLite, schema (CREATE TABLE IF NOT EXISTS), migration `password_hash`. |
| `server/auth.js` | JWT sign/verify, hash/verify password (scrypt), middleware `authRequired`/`requireManager`, helper `isManager`. |
| `scripts/seed.py` | Nạp dữ liệu từ `dulieu.xlsx` vào SQLite. |
| `src/` | Frontend React (layout, themes, views, modals). |

## Luồng phân quyền (RBAC) — hiện tại
1. Client `POST /api/auth/login` với `{ hrm_code, password }`.
2. Server tra `users`, `verifyPassword` (scrypt) → nếu đúng, `signToken` trả JWT (payload: `id, hrm_code, full_name, role`).
3. Route ghi (POST/PUT): client gửi header `Authorization: Bearer <token>`.
4. `authRequired` verify token → set `req.user`. Sai/thiếu → **401**.
5. `requireManager`: `role === 'STAFF'` → **403**; khác STAFF → cho qua.
6. Route đọc (GET) không gắn middleware → mở.

## Route ghi được bảo vệ
- `POST /api/equipments`  ← nhận thêm `assigned_user_id` (feat/personnel-backend)
- `PUT  /api/equipments/:id`  ← gồm đổi `status`; nhận thêm `assigned_user_id`
- `POST /api/device-types`
- `POST /api/personnel`, `PUT /api/personnel/:id`, `POST /api/personnel/import`,
  `GET /api/personnel`, `GET /api/personnel/search`  ← thay thế
  `POST /api/hrm/upload-and-map` (đã xoá, `feat/personnel-backend`)

## Ghi chú kỹ thuật
- Không dùng ORM; truy vấn SQL trực tiếp qua `db.prepare(...)`.
- Password hashing dùng `crypto.scryptSync` (built-in) — tránh thêm native dependency.
- `JWT_SECRET` lấy từ ENV, có fallback DEV (in cảnh báo nếu thiếu).

## Test tự động (`tests/`, `node:test`)
- `tests/helpers/serverHarness.js`: khởi động server thật trong CÙNG tiến trình test,
  KHÔNG sửa `server/index.js`/`server/db.js`. Kỹ thuật:
  1. Monkey-patch `require.cache['better-sqlite3']` để mọi `new Database(anyPath)` bị
     redirect sang 1 file SQLite tạm (`os.tmpdir()`), bất kể path prod mà `db.js` tự tính.
  2. Monkey-patch `http.createServer` để bắt được `http.Server` thật mà `app.listen()`
     tạo ra bên trong (do `server/index.js` không export `app`), phục vụ đóng server
     đàng hoàng (`server.close()` + `closeAllConnections()`) sau khi test xong.
  3. `require('server/db.js')` rồi `require('server/index.js')` trong cùng tiến trình
     → dùng chung 1 kết nối DB, tránh SQLite lock đa tiến trình.
- `tests/helpers/fixtures.js`: seed tối thiểu (1 tỉnh/1 BĐX/1 bưu cục/1 device_type + user)
  qua chính `db` handle, dùng `hashPassword` thật từ `server/auth.js`.
- Mỗi file test (`auth`/`equipments`/`personnel`/`users`) chạy port riêng (5901-5904) +
  DB tạm riêng, cô lập hoàn toàn với nhau và với `data/ccdc.db` thật. `tests/hrm.test.js`
  (port 5903) đã xoá cùng route HRM cũ, thay bằng `tests/personnel.test.js` (giữ nguyên
  port 5903).
