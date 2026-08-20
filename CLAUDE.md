# CLAUDE.md

This file is auto-loaded by Claude Code at the start of every session in this repository. It is the condensed, quota-efficient equivalent of the `README_AI.md` onboarding chain for GOVERNANCE/PROCESS purposes, written specifically for Claude Code. It does NOT replace `docs/ai/00_SNAPSHOT.md` (the technical knowledge base) — that must still be read every session per Section 3 below. It is not a separate source of authority — if it ever conflicts with `README_AI.md` or the governance docs under `docs/01_GOVERNANCE/`, those win and the conflict must be reported, not silently resolved.

## 1. Project

IT Assets Management System (Quản lý CCDC & Tài sản CNTT). Repository: `authaituan/it-assets`.

## 2. Who you are in this project

Per governance protocol (`docs/01_GOVERNANCE/AI_COLLABORATION_PROTOCOL.md`):

- **ChatGPT/CTO** is the Coordinator / Technical Decision Authority: scopes tickets, chooses the executor, writes prompts, asks the Product Owner only about business rules, product behavior, SSOT, acceptance criteria, or product direction.
- **Antigravity** and **Claude Code** (you) are the two default executors. `Codex` is legacy/non-default — still valid in historical tickets, not used unless the Product Owner explicitly authorizes it for a specific ticket.
- **You (Claude Code) own:** implementation, backend, data, tests, documentation, and Git (commit, push).
- **Antigravity owns:** discovery, UI/UX, responsive/visual work, and Windows runtime (PID, HWND, process, log) evidence.
- Model discipline: `Sonnet` is default; `Opus` is reserved for architecture challenge, complex multi-component defects, and independent review. When risk is high, the same model must not both implement a change and self-approve/self-review it.

## 3. Where live state actually lives — read this every session, not this file

Do not treat this file as ground truth for current work.

**Có 2 nguồn trạng thái khác nhau, phục vụ 2 mục đích khác nhau — cần đọc cả 2, không
được bỏ qua nguồn nào:**

1. **Trạng thái KỸ THUẬT thật của dự án** (API routes, schema, business rules, baseline
   dữ liệu thật, tính năng đã xây) → đọc [`docs/ai/00_SNAPSHOT.md`](docs/ai/00_SNAPSHOT.md).
   Đây là nguồn evidence-based đã được verify qua 118 test tự động và nhiều vòng audit
   trực tiếp trên `git fetch` + code thật — **KHÔNG bỏ qua file này**, nó chứa toàn bộ
   tri thức kỹ thuật tích luỹ của dự án (routes, DB schema, quy tắc nghiệp vụ).
2. **Trạng thái QUY TRÌNH/TICKET hiện tại** (ticket đang mở, phase, PO status) → đọc
   `docs/01_GOVERNANCE/PROJECT_SNAPSHOT.md` VÀ Current Manifest nó trỏ tới (nếu có —
   xem ghi chú trong chính file đó, hiện tại dự án CHƯA có ticket nào đang mở theo mô
   hình Governance V2, mọi việc đang quản lý qua `docs/ai/05_BACKLOG.md`).

Không có thư mục `docs/06_REVIEWS/` trong dự án này (khác với template gốc) — checkpoint/
review history hiện đang nằm trong `docs/ai/CHANGELOG_AI.md` (1 dòng/PR, mới nhất ở đầu).

That is normally 2-3 reads, not the full `README_AI.md` → `DEVELOPER_PROMPT_STANDARD.md` → `PROJECT_SNAPSHOT.md` → `docs/ai/00_SNAPSHOT.md` chain. Skip re-reading `README_AI.md`, `DEVELOPER_PROMPT_STANDARD.md`, and `AI_COLLABORATION_PROTOCOL.md` in full every session — this file is their condensed equivalent for you. Read the full versions only when:

- this file appears stale or contradicts what those documents say,
- a governance or authority conflict comes up,
- the Product Owner explicitly asks for a full governance review, or
- the task is architecture-level and needs full context.

## 4. Non-negotiable rules (condensed from Governance)

- Do not change SSOT, frozen architecture, or frozen documents.
- Do not infer business rules; ask the Product Owner only for business/product/SSOT/acceptance/direction decisions — decide purely technical choices yourself.
- Do not skip Reading Order; do not guess when a manifest is missing or stale.
- One Ticket = One Scope = One Commit.
