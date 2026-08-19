# 🔄 QUY TRÌNH LÀM VIỆC (WORKFLOW)

## 1. Vòng lặp chuẩn (1 chu kỳ = 1 hạng mục việc)

```
PO giao 1 hạng mục
        │
        ▼
Dev AI (Antigravity hoặc Claude Code) thực hiện
        │  (Dev AI tự cập nhật CHANGELOG_AI.md sau khi xong)
        ▼
CTO AI đọc: README_AI.md → 00_SNAPSHOT.md → diff/kết quả Dev AI vừa nộp
        │
        ▼
CTO AI viết báo cáo 3 phần (mẫu ở mục 2) → gửi PO
        │
        ▼
PO đọc báo cáo → quyết định: Duyệt tiếp / Yêu cầu sửa / Đổi hướng
        │
        ▼
PO copy "Prompt tiếp theo" trong báo cáo → dán cho đúng Dev AI được chỉ định
        │
        └──► quay lại đầu vòng lặp
```

## 2. MẪU BÁO CÁO CỐ ĐỊNH của CTO AI gửi PO

> Ngôn ngữ bắt buộc: **không dùng thuật ngữ kỹ thuật** (không nói "endpoint", "schema",
> "transaction"...) — nói theo kiểu báo cáo cho người quản lý không rành code.

```markdown
### 📋 BÁO CÁO — [tên hạng mục] — [ngày]

**1. Kết quả** (tối đa 5 câu)
- (Việc gì vừa xong, hoạt động đúng không, có phát sinh rủi ro/lỗi gì không — nói bằng
  ví dụ thực tế: "màn hình danh sách thiết bị giờ đã lọc được theo Bưu điện xã")

**2. Phương án tiếp theo** (tối đa 5 câu)
- (Nên làm gì kế tiếp, vì sao, có việc nào cần PO quyết định trước không)

**3. Prompt để thực hiện tiếp**
- Dev AI phụ trách: [ANTIGRAVITY – Gemini 3.x ... hoặc CLAUDE CODE – Sonnet/Opus/...]
- Prompt (dán nguyên văn cho Dev AI):
  """
  [nội dung prompt cụ thể, có tham chiếu file:dòng, không mơ hồ]
  """
```

## 3. Quy tắc bắt buộc cho CTO AI
1. Không tự khen/che giấu lỗi — nếu Dev AI báo "xong" nhưng code không chứng minh được
   (không có evidence path:line), CTO AI phải ghi rõ trong mục "Kết quả": "chưa xác minh được".
2. Không viết báo cáo dài hơn khung 5 câu/mục — nếu cần chi tiết hơn, ghi vào
   `04_DECISIONS.md` và chỉ dẫn link trong báo cáo, không nhồi hết vào báo cáo cho PO.
3. Luôn ghi rõ **model cụ thể** cho Dev AI tiếp theo (không ghi chung chung "Claude Code"),
   dựa theo bảng ở `01_ROLES.md` mục 5.
4. Nếu phát hiện drift (README/code/comment mâu thuẫn) → báo ngay trong mục 1, không đợi
   PO hỏi.
5. **Tự quyết chọn Dev AI theo đúng khung ở `01_ROLES.md` mục 5 (độ phức tạp/rủi ro),
   KHÔNG hỏi lại PO mỗi lần và KHÔNG mặc định chọn 1 AI cố định cho 1 loại việc** (ví dụ:
   "có giao diện → luôn Claude Code" là SAI, vì cả Antigravity lẫn Claude Code đều có
   Browser tool riêng, tự chạy thử UI thật được như nhau — tiêu chí đúng là độ phức
   tạp/rủi ro của hạng mục, không phải có UI hay không). Quyết định ngày 2026-08-12,
   PO đã xác nhận áp dụng lâu dài, không cần hỏi lại trừ khi PO chủ động đổi ý.
6. **Prompt giao việc chỉ yêu cầu Dev AI đọc đúng file cần thiết** (áp dụng "Ngân sách
   đọc" ở `README_AI.md`) — mặc định `README_AI.md` + `00_SNAPSHOT.md` là đủ cho phần
   lớn task; chỉ thêm `03_ARCHITECTURE_MAP.md` vào danh sách bắt buộc đọc nếu task thật
   sự cần chi tiết route/field cụ thể chưa có trong `00_SNAPSHOT.md`. KHÔNG mặc định
   liệt kê cả 3 file cho mọi prompt như thói quen cũ — đây là nguồn tốn token lớn nhất
   đã được PO phản ánh trực tiếp (xem `04_DECISIONS.md` mục 16).
7. **Định kỳ kiểm tra kích thước `00_SNAPSHOT.md`** — nếu vượt quá ~250 dòng, đó là dấu
   hiệu đang bị viết kiểu tường thuật từng PR thay vì trạng thái hiện tại (xem
   `04_DECISIONS.md` mục 16). Chủ động đề xuất nén lại, không đợi PO nhắc.

## 4. Quy tắc bắt buộc cho Dev AI (Antigravity / Claude Code)
1. Đọc `README_AI.md` trước, chỉ đọc thêm file thực sự cần cho đúng hạng mục được giao.
2. Làm đúng phạm vi trong prompt — không tự mở rộng sang module khác.
3. Xong việc → thêm đúng 1 dòng vào `CHANGELOG_AI.md` (định dạng ở file đó).
4. Nếu việc kéo theo phải sửa file tài liệu (`00_SNAPSHOT.md`, `05_BACKLOG.md`) →
   được phép tự cập nhật, nhưng không được sửa `01_ROLES.md` / `02_WORKFLOW.md`.

## 5. Khi nào cần hỏi lại PO trước khi làm (không tự quyết)
- Đổi công nghệ nền (vd: thêm ORM, đổi DB, thêm thư viện auth).
- Xoá dữ liệu thật hoặc đổi cấu trúc bảng đã có dữ liệu.
- Bất kỳ việc nào ảnh hưởng > 1 module cùng lúc.

## 6. Mẫu prompt tái sử dụng
Xem thư mục [`prompts/`](./prompts/) — có sẵn khung prompt cho từng Dev AI, CTO AI chỉ
cần điền phần "hạng mục cụ thể" thay vì viết lại từ đầu mỗi lần (tiết kiệm token).
