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
- `POST /api/equipments`
- `PUT  /api/equipments/:id`  ← gồm đổi `status`
- `POST /api/device-types`
- `POST /api/hrm/upload-and-map`

## Ghi chú kỹ thuật
- Không dùng ORM; truy vấn SQL trực tiếp qua `db.prepare(...)`.
- Password hashing dùng `crypto.scryptSync` (built-in) — tránh thêm native dependency.
- `JWT_SECRET` lấy từ ENV, có fallback DEV (in cảnh báo nếu thiếu).
