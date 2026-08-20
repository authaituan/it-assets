# PROJECT SNAPSHOT

## Table of Contents

- [1. Purpose](#1-purpose)
- [2. Current Snapshot](#2-current-snapshot)
- [3. Usage Rules](#3-usage-rules)
- [4. Continuation Notes](#4-continuation-notes)

## 1. Purpose

This document is the Governance V2 **PROCESS/TICKET** current-state snapshot for AI onboarding in **authaituan/it-assets**. It answers "what ticket/phase is active in the Governance V2 workflow" — it does **NOT** duplicate technical project facts (API routes, DB schema, features, baseline data). For those, see `docs/ai/00_SNAPSHOT.md` (mục 2 dưới đây giải thích rõ).

It is designed to be the shortest safe entry point for a new AI session while preserving continuity with the existing repository workflow.

## 2. Current Snapshot

| Field | Value |
| --- | --- |
| Current Phase | `Governance V2 documentation rollout — HOÀN TẤT (2026-08-20).` |
| Current Ticket | `Không có ticket Governance V2 nào đang mở.` Việc theo dõi backlog/task tiếp theo hiện đang dùng `docs/ai/05_BACKLOG.md` (hệ thống có trước, vẫn là nguồn chính cho tới khi PO quyết định chuyển hẳn sang mô hình ticket `docs/10_TICKETS/`). |
| Next Ticket | `Chưa có — PO quyết định việc tiếp theo trực tiếp qua hội thoại, tham khảo docs/ai/05_BACKLOG.md.` |
| Last PO Status | `Product Owner đã duyệt bộ Governance V2, yêu cầu sửa lại 3 lỗi tích hợp (không tham chiếu docs/ai/, PROJECT_SNAPSHOT.md rỗng, Current Manifest trỏ sai) trước khi merge — đã sửa 2026-08-20.` |
| Current Branch | `main` |
| Current Manifest | `KHÔNG có manifest ticket nào đang áp dụng.` `docs/10_TICKETS/AUTO-BACKFILL-UI_PLAN.md` CHỈ là ví dụ minh hoạ quy trình (tự file đó ghi rõ `Status: REFERENCE WORKFLOW EXAMPLE`) — KHÔNG phải ticket thật của `it-assets`, KHÔNG được đọc như đang áp dụng. |
| Current State | `Governance V2 documentation suite đã tích hợp xong với hệ thống docs/ai/ có sẵn — xem mục 2 để biết nguồn trạng thái kỹ thuật thật.` |
| Technical Status | **Trạng thái kỹ thuật THẬT của dự án (routes, schema, tính năng, baseline dữ liệu) nằm ở [`docs/ai/00_SNAPSHOT.md`](https://github.com/authaituan/it-assets/blob/main/docs/ai/00_SNAPSHOT.md) — đọc file đó, KHÔNG suy đoán từ file này.** |
| Runtime Status | `Xem docs/ai/00_SNAPSHOT.md mục "Baseline dữ liệu thật" — hiện tại: 332 thiết bị / 185 bưu cục / 44 BĐX, hệ thống chạy thật trên LAN nội bộ.` |
| PO UI Check Required | `Tuỳ theo ticket cụ thể — xem quy tắc ở PO_UI_ACCEPTANCE_WORKFLOW.md.` |
| Governance Version | `V2 Active — tích hợp song song với docs/ai/ (không thay thế).` |
| Last Updated | `2026-08-20` |

## 3. Usage Rules

- Read this document immediately after `README_AI.md` **để biết trạng thái QUY TRÌNH/TICKET** (không phải trạng thái kỹ thuật).
- **BẮT BUỘC đọc thêm [`docs/ai/00_SNAPSHOT.md`](https://github.com/authaituan/it-assets/blob/main/docs/ai/00_SNAPSHOT.md) để biết trạng thái KỸ THUẬT thật** (API, schema, business rules, baseline dữ liệu) — file này KHÔNG chứa các thông tin đó, không được suy đoán.
- Do not infer current state from chat history when this snapshot is available.
- Do not use this document to override SSOT, frozen docs, or Product Owner decisions.
- `Claude Code` reads BOTH this document (process/ticket state) AND `docs/ai/00_SNAPSHOT.md` (technical state) — xem `CLAUDE.md` mục 3 để biết chi tiết 2 nguồn khác nhau.

## 4. Continuation Notes

This snapshot is intentionally narrow — nó CHỈ trả lời câu hỏi về quy trình/ticket, KHÔNG
trả lời câu hỏi kỹ thuật (route nào có, schema thế nào, tính năng gì đã xây — những câu
đó thuộc về `docs/ai/00_SNAPSHOT.md`).

It exists to answer only the questions a fresh AI needs in order to continue:

- where the project is (process/ticket-wise)
- what ticket is active (hiện tại: không có)
- what comes next (xem `docs/ai/05_BACKLOG.md`)
- what branch is active
- what manifest governs the current reading scope (hiện tại: không có manifest nào)

Fresh-chat onboarding chain:

1. [README_AI.md](https://github.com/authaituan/it-assets/blob/main/README_AI.md) — governance/process entry point
2. [docs/01_GOVERNANCE/DEVELOPER_PROMPT_STANDARD.md](https://github.com/authaituan/it-assets/blob/main/docs/01_GOVERNANCE/DEVELOPER_PROMPT_STANDARD.md)
3. [docs/01_GOVERNANCE/PROJECT_SNAPSHOT.md](https://github.com/authaituan/it-assets/blob/main/docs/01_GOVERNANCE/PROJECT_SNAPSHOT.md) (file này) — process/ticket state
4. [docs/ai/00_SNAPSHOT.md](https://github.com/authaituan/it-assets/blob/main/docs/ai/00_SNAPSHOT.md) — **technical state, BẮT BUỘC đọc, không được bỏ qua**
5. Current Manifest (nếu có — hiện tại KHÔNG có ticket nào đang mở dưới `docs/10_TICKETS/`)
