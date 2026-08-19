# CLAUDE.md

This file is auto-loaded by Claude Code at the start of every session in this repository. It is the condensed, quota-efficient equivalent of the `README_AI.md` onboarding chain, written specifically for Claude Code. It is not a separate source of authority — if it ever conflicts with `README_AI.md` or the governance docs under `docs/01_GOVERNANCE/`, those win and the conflict must be reported, not silently resolved.

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

Do not treat this file as ground truth for current work. For the current ticket, phase, branch, manifest, and PO status, read:

1. `docs/01_GOVERNANCE/PROJECT_SNAPSHOT.md` — the single live-state snapshot.
2. The Current Manifest referenced by `PROJECT_SNAPSHOT.md` (under `docs/10_TICKETS/`).
3. Only the Required Reading listed by that manifest (usually one checkpoint file under `docs/06_REVIEWS/`).

That is normally 2-3 reads, not the full `README_AI.md` → `DEVELOPER_PROMPT_STANDARD.md` → `PROJECT_SNAPSHOT.md` → Manifest → Required Reading chain. Skip re-reading `README_AI.md`, `DEVELOPER_PROMPT_STANDARD.md`, and `AI_COLLABORATION_PROTOCOL.md` in full every session — this file is their condensed equivalent for you. Read the full versions only when:

- this file appears stale or contradicts what those documents say,
- a governance or authority conflict comes up,
- the Product Owner explicitly asks for a full governance review, or
- the task is architecture-level and needs full context.

## 4. Non-negotiable rules (condensed from Governance)

- Do not change SSOT, frozen architecture, or frozen documents.
- Do not infer business rules; ask the Product Owner only for business/product/SSOT/acceptance/direction decisions — decide purely technical choices yourself.
- Do not skip Reading Order; do not guess when a manifest is missing or stale.
- One Ticket = One Scope = One Commit.
