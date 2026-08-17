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
- `GET /api/equipments/export-data`, `POST /api/equipments/import`  ← mới
  (`feat/equipment-import-export-backend`), xem bảng field bên dưới.
  ⚠️ `POST /api/equipments/import` từ `feat/network-management-backend` (2026-08-17)
  KHÔNG còn tự tạo tổ chức — gọi `requireExistingPostOffice()`, chặn 400 nếu mã
  bưu cục chưa có; `provincesCreated/communesCreated/postOfficesCreated` luôn = 0.
- `GET /api/network`, `POST /api/network/import`, `GET /api/network/export-data`,
  `PUT /api/network/post-offices/:id`, `DELETE /api/network/post-offices/:id`  ← mới
  (`feat/network-management-backend`), CHỈ các route này (qua `resolveOrCreateOrgChain`)
  được tạo mới Tỉnh/BĐX/Bưu cục. Xem bảng 20 field bên dưới.

## Helper tổ chức dùng chung (`server/index.js`, `feat/network-management-backend`)
- `resolveOrCreateOrgChain(row, report, rowNum)`: resolve/tạo Tỉnh→BĐX→Bưu cục theo
  `code` (logic tách nguyên vẹn từ Equipment Import cũ), lưu thêm 9 cột mới của
  `post_offices`. Mutate `report` (provincesCreated/communesCreated/postOfficesCreated/
  postOfficesUpdated). Phải gọi trong `db.transaction()`. CHỈ dùng cho route mạng lưới.
- `requireExistingPostOffice(maMbc)`: chỉ SELECT theo `code`, KHÔNG tạo mới; throw
  lỗi rõ ràng nếu không thấy. Dùng cho Equipment Import (Phương án B).
- `parseFloatOrNull(v)`: parse latitude/longitude (rỗng/không hợp lệ → null).

## Quản Lý Mạng Lưới — bảng 20 field JSON (import ⇄ export dùng CHUNG key)
Nguồn: file Excel mạng lưới PO cung cấp. Dùng cho `POST /api/network/import`
(request `rows[]`) và `GET /api/network/export-data` (response `items[]`).

| Nhóm | Key JSON | Cột DB (`post_offices`/tổ chức) | Ghi chú |
|---|---|---|---|
| Tỉnh | `maBdtTp` | `province_post_offices.code` | resolve/tạo mới tỉnh |
| Tỉnh | `tenBdtTp` | `province_post_offices.name` | |
| BĐX | `maBdx` | `commune_post_offices.code` | resolve/tạo mới BĐX |
| BĐX | `tenBuuDienXa` | `commune_post_offices.name` | |
| BĐX | `buuDienXaTrungTam` | `commune_post_offices.central_commune_code` | |
| Bưu cục | `maMbc` | `post_offices.code` | **bắt buộc mọi dòng** |
| Bưu cục | `tenBuuCuc` | `post_offices.name` | |
| Bưu cục | `loai` | `post_offices.type` | mặc định `GD3` khi tạo |
| Bưu cục | `diaChiChiTiet` | `post_offices.address` | |
| Bưu cục | `maBdkv` | `post_offices.bdkv_code` | |
| Bưu cục | `tenBdkv` | `post_offices.bdkv_name` | |
| (mới) | `maPhuongXaCu` | `post_offices.old_ward_code` | Mã Phường/Xã CŨ |
| (mới) | `tenPhuongXaCu` | `post_offices.old_ward_name` | Tên Phường/Xã CŨ |
| (mới) | `tenQuanHuyen` | `post_offices.district_name` | Tên Quận/Huyện |
| (mới) | `maPhuongXaMoi` | `post_offices.new_ward_code` | Mã Phường/Xã MỚI |
| (mới) | `tenPhuongXaMoi` | `post_offices.new_ward_name` | Tên Phường/Xã MỚI |
| (mới) | `soDienThoai` | `post_offices.phone` | |
| (mới) | `tinhTrangHoatDong` | `post_offices.operational_status` | mặc định `ACTIVE` khi tạo |
| (mới) | `viDo` | `post_offices.latitude` (REAL) | |
| (mới) | `kinhDo` | `post_offices.longitude` (REAL) | |

Import UPDATE (mã bưu cục đã có): chỉ ghi đè field có giá trị KHÔNG RỖNG, giữ nguyên
field vắng mặt (như Equipment Import). `DELETE` bưu cục = XOÁ CỨNG, bắt lỗi FK nếu còn
`equipments`/`users` tham chiếu (không soft-delete).

## Equipment Import/Export — bảng field JSON (export ⇄ import dùng CHUNG key)
Nguồn: `dulieu.xlsx` gốc (cột A-X) + 7 field mới xây dựng sau này. Dùng cho
`GET /api/equipments/export-data` (response `items[]`) và
`POST /api/equipments/import` (request `rows[]`) — CÙNG 1 bộ key, export ra
rồi import thẳng lại không cần map lại field ở frontend.

| Cột Excel gốc | Key JSON | Nguồn DB (export) | Ghi chú (import) |
|---|---|---|---|
| A | `maBdtTp` | `province_post_offices.code` | resolve/tạo mới `province_post_offices` |
| B | `tenBdtTp` | `province_post_offices.name` | |
| C | `maMbc` | `post_offices.code` | **bắt buộc mọi dòng** |
| D | `tenBuuCuc` | `post_offices.name` | |
| E | `maBdx` | `commune_post_offices.code` | resolve/tạo mới `commune_post_offices` |
| F | `tenBuuDienXa` | `commune_post_offices.name` | |
| G | `loai` | `post_offices.type` | dùng khi tạo mới bưu cục |
| H | `ip` | `equipments.ip_address` | |
| I | `ngayCap` | `equipments.assigned_date` | |
| J | `tenMay` | `equipments.hostname` | bắt buộc nếu không có `maCcdc` |
| K | `diaChiMac` | `equipments.mac_address` | |
| L | `loaiMay` | `specs.category_raw` (raw, KHÔNG phải phân loại thật) | → `specs.category_raw` |
| M | `hang` | `brands.name` | resolve/tạo mới `brands` (upsert theo tên) |
| N | `model` | `equipments.model` | |
| O | `serialNumber` | `equipments.serial_number` | |
| P | `heDieuHanh` | `specs.os` | |
| Q | `cpu` | `specs.cpu` | |
| R | `ram` | `specs.ram` | |
| S | `oCung` | `specs.storage` | |
| T | `nguoiSuDung` | `equipments.raw_user_name` (text tự do) | |
| U | `maBdkv` | `post_offices.bdkv_code` | dùng khi tạo mới bưu cục |
| V | `tenBdkv` | `post_offices.bdkv_name` | dùng khi tạo mới bưu cục |
| W | `buuDienXaTrungTam` | `commune_post_offices.central_commune_code` | dùng khi tạo mới BĐX |
| X | `diaChiChiTiet` | `post_offices.address` | dùng khi tạo mới bưu cục |
| (mới) | `maCcdc` | `equipments.asset_tag` | có giá trị + khớp → UPDATE; không có → CREATE (tự sinh mã) |
| (mới) | `danhMucCcdc` | `device_types.name` (tên THẬT, khác cột L) | resolve/tạo mới `device_types` |
| (mới) | `tienToDanhMucMoi` | luôn `""` lúc export | bắt buộc khi tạo danh mục MỚI **và** đang tạo thiết bị mới (không `maCcdc`) |
| (mới) | `namMua` | `equipments.purchase_year` | |
| (mới) | `maHrmNguoiSuDung` | `users.hrm_code` qua `assigned_user_id` | resolve `assigned_user_id` theo `hrm_code` |
| (mới) | `trangThai` | `equipments.status` | enum `IN_USE/IN_STOCK/MAINTENANCE/BROKEN/LIQUIDATED` |
| (mới) | `ghiChu` | `equipments.notes` | |

Quy tắc UPDATE qua `maCcdc`: chỉ ghi đè field có giá trị KHÔNG RỖNG trong
dòng import (kể cả sub-field trong `specs`); field rỗng/vắng mặt = giữ
nguyên giá trị cũ. `asset_tag` không bao giờ đổi.

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
- Mỗi file test (`auth`/`equipments`/`personnel`/`users`/`equipment-import-export`/
  `network`) chạy port riêng (5901-5906) + DB tạm riêng, cô lập hoàn toàn với nhau và
  với `data/ccdc.db` thật. `tests/hrm.test.js` (port 5903) đã xoá cùng route HRM cũ, thay
  bằng `tests/personnel.test.js` (giữ nguyên port 5903). `tests/equipment-import-export.test.js`
  (port 5905) phủ `GET /api/equipments/export-data` + `POST /api/equipments/import`.
  `tests/network.test.js` (mới, port 5906) phủ 5 route Quản Lý Mạng Lưới. Tổng **111 test**.
