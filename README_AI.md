# IT Assets Management System AI Entry Point

## Table of Contents

- [1. Purpose](#1-purpose)
- [2. Mandatory Start](#2-mandatory-start)
- [2.1 First-Prompt Governance Gate](#21-first-prompt-governance-gate)
- [3. Operating Rules](#3-operating-rules)
- [4. Mandatory Response Format](#4-mandatory-response-format)
- [5. Governance V2 Onboarding](#5-governance-v2-onboarding)
- [6. Quick Links](#6-quick-links)
- [7. Conversation Context Capacity and Fresh-Chat Handoff](#7-conversation-context-capacity-and-fresh-chat-handoff)
- [8. Golden Rule](#8-golden-rule)

## 1. Purpose

This repository belongs to **authaituan/it-assets** (IT Assets & CCDC Management System).

It is designed so any AI can onboard quickly, without guessing workflow or reading random files.

It is also the single universal external entry point for fresh AI continuity, regardless of ticket naming convention.

## 2. Mandatory Start

Every AI must:

1. Read [README_AI.md](https://github.com/authaituan/it-assets/blob/main/README_AI.md)
2. Read [docs/01_GOVERNANCE/DEVELOPER_PROMPT_STANDARD.md](https://github.com/authaituan/it-assets/blob/main/docs/01_GOVERNANCE/DEVELOPER_PROMPT_STANDARD.md) before creating any first `Prompt cho Claude Code` or `Prompt cho Antigravity`
3. Read [docs/01_GOVERNANCE/PROJECT_SNAPSHOT.md](https://github.com/authaituan/it-assets/blob/main/docs/01_GOVERNANCE/PROJECT_SNAPSHOT.md) — process/ticket state only (KHÔNG chứa route/schema/tính năng thật)
4. **Read [docs/ai/00_SNAPSHOT.md](https://github.com/authaituan/it-assets/blob/main/docs/ai/00_SNAPSHOT.md) — BẮT BUỘC, đây là nguồn trạng thái KỸ THUẬT thật của dự án** (API routes, DB schema, business rules, baseline dữ liệu thật, tính năng đã xây — evidence-based, verify qua 118 test tự động + nhiều vòng audit trực tiếp). File `PROJECT_SNAPSHOT.md` ở bước 3 KHÔNG thay thế được bước này.
5. Read the Current Manifest referenced by `PROJECT_SNAPSHOT.md`, nếu có (hiện tại dự án chưa dùng mô hình ticket `docs/10_TICKETS/`, mọi backlog quản lý qua `docs/ai/05_BACKLOG.md`)
6. Read only the Required Reading listed in that manifest (nếu có)
7. Use only the GitHub Blob URLs embedded in the onboarding chain; do not depend on relative paths for AI onboarding.

## 2.1 First-Prompt Governance Gate

Before writing the first execution prompt in any new AI/chat session, the AI must read `docs/01_GOVERNANCE/DEVELOPER_PROMPT_STANDARD.md`.

If the Prompt Standard has not been read, the AI must not write `Prompt cho Claude Code` or `Prompt cho Antigravity`.

The first execution prompt defaults to:

- one defect or objective only;
- delta-only scope;
- fewer than `250` words unless Governance explicitly allows an exception;
- no repetition of Manifest content, SSOT text, ticket history, or repository-owned instructions.

## 3. Operating Rules

AI must:

- follow Governance
- follow Authority Level
- not change SSOT
- not skip Reading Order
- not change frozen documents
- not infer business rules
- own implementation, automated testing, build/lint, API validation, database validation, contract validation, and targeted technical runtime checks
- treat Product Owner visible UI and product acceptance as separate from executor technical validation
- stop at `READY FOR PO CHECK` when `PO UI Check Required = Yes`
- provide a concise manual PO checklist for visible changes
- not perform broad UI acceptance or award PO PASS
- treat Technical PASS and Runtime/API Contract PASS as non-equivalent to PO PASS
- before drafting or executing a prompt, follow [docs/01_GOVERNANCE/DEVELOPER_PROMPT_STANDARD.md](https://github.com/authaituan/it-assets/blob/main/docs/01_GOVERNANCE/DEVELOPER_PROMPT_STANDARD.md) and [docs/01_GOVERNANCE/CODEX_DOCUMENTATION_STANDARD.md](https://github.com/authaituan/it-assets/blob/main/docs/01_GOVERNANCE/CODEX_DOCUMENTATION_STANDARD.md); active-ticket follow-ups default to delta-only and LEVEL 1 unless broader scope is explicitly justified
- ChatGPT is the CTO / Coordinator / Technical Decision Authority in the active Product Owner session: receive requests, analyze tickets, finalize scope, choose the executor, write the prompt, review results, and request PO decisions only for business rules, product behavior, SSOT, acceptance criteria, or product direction
- the default executors are `Antigravity` and `Claude Code`; only ChatGPT coordination may redirect work between them
- `Codex` is a legacy/non-default executor and must not be selected unless the Product Owner explicitly authorizes it for a specific ticket; historical Codex tickets, checkpoints, and manifests remain valid records and must not be rewritten
- every future execution prompt must explicitly choose exactly one title: `Prompt cho Claude Code` or `Prompt cho Antigravity`, plus the executor/model pairing
- executor/model is a fixed pairing, not a free choice: `Antigravity (Gemini)` for UI/UX, visual polish, and Windows runtime inspection; `Claude Code (Sonnet)` for local/bounded discovery, implementing an approved plan, tests, documentation, and Git; `Claude Code (Opus)` for complex/cross-module planning, architecture, and high-risk technical decisions — see `docs/01_GOVERNANCE/DEVELOPER_PROMPT_STANDARD.md` Section 13/13.1 for the authoritative rule, including the invalid-label list (e.g. `Antigravity–Sonnet`, `Claude Code–Gemini`)
- do not use the combined heading `Prompt cho Claude Code/Antigravity`
- when risk is high, the same executor/model pairing must not both implement a change and self-approve or self-review that same change
- there are two distinct reporting channels with different audiences: ChatGPT/CTO → Product Owner (management, three-part format, Section 4 below) and Antigravity/Claude Code/authorized Codex → ChatGPT/CTO (full technical detail, the Technical Execution Report in `docs/01_GOVERNANCE/DEVELOPER_PROMPT_STANDARD.md` Section 14.2); an executor never writes the Product Owner-facing format as its own report and never drafts a prompt for another executor

## 4. Mandatory Response Format

Audience: ChatGPT/CTO reporting to the Product Owner only. This format is for ChatGPT/CTO reporting to the Product Owner. It is not the format an executor (Antigravity, Claude Code, or an explicitly authorized Codex) uses to report to ChatGPT/CTO — an executor uses the Technical Execution Report defined in `docs/01_GOVERNANCE/DEVELOPER_PROMPT_STANDARD.md` Section 14.2, which carries full technical detail, is not limited to 5 sentences, and is not written in no-code language.

After onboarding and for post-onboarding continuation, implementation-result review, remediation findings, validation failures, PO handoff, and next-ticket activation, ChatGPT/CTO must respond with exactly this concise three-part format:

1. `### Phân tích kết quả`
   - fewer than 5 sentences
   - state only the result, finding, blocker, or readiness
   - use Product Owner management/no-code language
   - explain what happened, the user/project impact, and the current progress or blocker
2. `### Phương án`
   - fewer than 5 sentences
   - state the concrete technical option, remediation plan, or next ticket
   - highlight any Product Owner decision needed
3. `### Executor Prompt`
   - the exact lean execution prompt for `Claude Code` or `Antigravity` formatted per `docs/01_GOVERNANCE/DEVELOPER_PROMPT_STANDARD.md`

## 5. Governance V2 Onboarding

For fresh AI onboarding:
1. Always start at `README_AI.md`.
2. Inspect `PROJECT_SNAPSHOT.md` for live active ticket and current manifest (process state).
3. **Inspect `docs/ai/00_SNAPSHOT.md` for actual technical project state — required, not optional.**
4. Access the active ticket manifest under `docs/10_TICKETS/`, if any.

## 6. Quick Links

- [AI Collaboration Protocol](https://github.com/authaituan/it-assets/blob/main/docs/01_GOVERNANCE/AI_COLLABORATION_PROTOCOL.md)
- [Developer Prompt Standard](https://github.com/authaituan/it-assets/blob/main/docs/01_GOVERNANCE/DEVELOPER_PROMPT_STANDARD.md)
- [PO UI Acceptance Workflow](https://github.com/authaituan/it-assets/blob/main/docs/01_GOVERNANCE/PO_UI_ACCEPTANCE_WORKFLOW.md)
- [Codex Documentation Standard](https://github.com/authaituan/it-assets/blob/main/docs/01_GOVERNANCE/CODEX_DOCUMENTATION_STANDARD.md)
- [Project Snapshot (process/ticket state)](https://github.com/authaituan/it-assets/blob/main/docs/01_GOVERNANCE/PROJECT_SNAPSHOT.md)
- **[Technical Snapshot — docs/ai/00_SNAPSHOT.md (trạng thái kỹ thuật thật, BẮT BUỘC đọc)](https://github.com/authaituan/it-assets/blob/main/docs/ai/00_SNAPSHOT.md)**
- [docs/ai/ — toàn bộ hệ thống tài liệu kỹ thuật gốc (README/ROLES/WORKFLOW/ARCHITECTURE_MAP/DECISIONS/BACKLOG/CHANGELOG/DEPLOYMENT/prompts)](https://github.com/authaituan/it-assets/tree/main/docs/ai)

## 7. Conversation Context Capacity and Fresh-Chat Handoff

When conversation context reaches capacity or a fresh session is started, onboarding must re-verify live state via `PROJECT_SNAPSHOT.md` and the active manifest.

## 8. Golden Rule

Never guess business requirements, skip reading order, or execute unapproved scope. One Ticket = One Scope = One Commit.
