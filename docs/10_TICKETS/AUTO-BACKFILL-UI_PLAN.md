# Revised UI/UX Architecture, Baseline Reconciliation & Exception Governance Plan (`AUTO-BACKFILL-UI`)

Status: `REFERENCE WORKFLOW EXAMPLE`.
Repository Plan Path: `docs/10_TICKETS/AUTO-BACKFILL-UI_PLAN.md`.

> [!IMPORTANT]
> This document serves as an **Authoritative Reference Plan** illustrating the standard **Backend First (Phase A) → UI Later (Phase B)** workflow for complex features and remediations.

---

## 1. Executive Summary & Remediation Ledger

Following Product Owner feedback, the standard workflow incorporates 5 mandatory architectural remediation points:

1. **Inverted Implementation Order**:
   - **Phase A (`AUTO-BACKFILL-COVERAGE-EXCEPTION`)**: Technical backend executor implements backend schema, registry policies, `VERIFIED_NO_DATA`, `PO_EXEMPTED`, `LEGACY_DATA_PRESENT_WITHOUT_EVIDENCE` logic, DB persistence, and exception APIs FIRST.
   - **Phase B (`AUTO-BACKFILL-UI-REMEDIATION`)**: Antigravity implements frontend components and PO confirmation UI AFTER real backend APIs are verified and ready. (No Modal or `PO_EXEMPTED` button will be built before real backend APIs exist).
2. **Strict Adapter-Proven Criteria for `VERIFIED_NO_DATA`**:
   - "Portal returned 0 rows" does NOT automatically equal `NO_DATA`.
   - `VERIFIED_NO_DATA` is valid ONLY when portal adapter explicitly proves 5 criteria: (1) exact report identity, (2) exact indicator/lane/date tuple, (3) successful filter application, (4) valid response readiness, and (5) valid export/table structure confirming exactly 0 rows.
   - If any criterion is missing ➔ `MANUAL_REVIEW_REQUIRED`. Never auto-exempt.
3. **Legacy Baseline Reconciliation (6 Coverage States)**:
   - Solves missing data items by introducing `LEGACY_DATA_PRESENT_WITHOUT_EVIDENCE` ("Dữ liệu cũ đã có"), preventing unwanted re-imports through a controlled baseline seed.
   - Registry-driven completion policy per indicator × lane.
4. **Technical Failure & Exception Isolation**:
   - Single-date error retries per registry policy (up to 3 times), records result, and continues queue.
   - Circuit breaker opens ONLY on 5 consecutive system failures with matching error signature.
   - `VERIFIED_NO_DATA` and `PO_EXEMPTED` MUST NEVER be counted as retries or circuit breaker errors.
5. **No-Code Vietnamese Status Display**:
   - Technical codes mapped to user-friendly Vietnamese labels without exposing internal technical terms on the main UI.

---

## 2. Inverted Implementation Sequence (Phase A -> Phase B)

```
+---------------------------------------------------------------------------------------------------+
| PHASE A: BACKFILL COVERAGE EXCEPTION & BASELINE BACKEND (Ticket: AUTO-BACKFILL-COVERAGE-EXCEPTION) |
| Executed FIRST by Technical Backend Executor                                                      |
| Deliverables:                                                                                     |
|  - Implement DB schema & persistence for `PO_EXEMPTED` and `LEGACY_DATA_PRESENT_WITHOUT_EVIDENCE` |
|  - Implement 5-point adapter verification for `VERIFIED_NO_DATA`                                  |
|  - Implement registry-driven completion policies per indicator × lane                             |
|  - Expose verified REST APIs for coverage scan & PO exception confirmation                         |
+---------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼ Backend API Verified & PASS
+---------------------------------------------------------------------------------------------------+
| PHASE B: BACKFILL UI REMEDIATION & PO EXCEPTION UI (Ticket: AUTO-BACKFILL-UI-REMEDIATION)         |
| Executed SECOND by Antigravity (UI/UX Executor)                                                   |
| Deliverables:                                                                                     |
|  - Build UI components consuming real backend APIs                                                |
|  - Render Vietnamese no-code status labels                                                        |
|  - Provide PO exception modal & manual verification checklist                                     |
+---------------------------------------------------------------------------------------------------+
```
