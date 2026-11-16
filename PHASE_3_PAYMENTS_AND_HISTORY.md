# Phase 3 — Payments, corrections and shared history

[Implementation plan](./IMPLEMENTATION_PLAN.md) · [Product specification](./PRODUCT_SPEC.md) · [Previous phase](./PHASE_2_FRIENDS_AND_REQUESTS.md) · [Next phase](./PHASE_4_PERSONAL_LEDGER.md)

## Prerequisites

Phase 2 shared requests, participants and activity records.

## Scope, tools and skills

- **Work:** Record full or partial payments, then let the creditor confirm or decline receipt. Derive the remaining balance from confirmed payments. Pending payments reserve part of the amount. Implement proposed corrections to the accepted request amount or reason, and correction or cancellation of a confirmed payment. Either party can propose a correction with a reason, the other approves or rejects. Keep the balance unchanged until approval and record responses. Revalidate against the latest state before applying it. Preserve the original event and record the correction.
- **Tools:** Transactional PostgreSQL RPCs, row locking on the request, database constraints, unique idempotency keys, typed activity records, pgTAP and multi-session Playwright. Use the same operation key when retrying a submission after a lost response.
- **Skills:** `api-and-interface-design` for payment and correction contracts, `backend-security-coder` for atomicity and permissions, and `browser-testing-with-devtools` for retries, network behavior and two-account verification.
- **Done when:** EGP 500 remains outstanding until the EGP 200 payment is confirmed. Then both accounts see EGP 300. A repeated confirmation or retry after a lost response changes the balance once and records one event for that operation. Concurrent submissions cannot overpay. Corrections preserve history and can reopen a settled debt when the corrected balance is positive.

## Implementation sequence

Add payment and correction records. Serialize changes to a request, validate amounts, and save each transition and activity event together. Implement retry keys and the bilingual confirmation and correction views. Include actor, timestamp, amount and reason where applicable.

## Deliverables

Payment and correction flows, shared history, and tests for concurrency and lost responses.

## Verification

Test partial and final settlement, rejected payments, repeated confirmation, overpayment, and retry after a saved response is lost. Test rejected, stale and approved corrections, including cancellation of a confirmed payment. Verify both accounts see the same balance.

## Skills and tools by part

| Part | Tools and implementation | Skill and purpose |
|---|---|---|
| Payment entry and receipt | Debtor records payment, creditor confirms or declines through SQL RPCs and React forms | api-and-interface-design for role contracts, backend-security-coder for enforcement |
| Balance and settlement | Integer minor units, request row lock, pending reservations and confirmed totals | backend-security-coder for transaction consistency |
| Retry handling | Actor-scoped unique operation keys, same key and payload reused after a lost response | api-and-interface-design for repeatable results, backend-security-coder for duplicate prevention |
| Corrections | Proposed change and reason, other participant's decision, version and balance validation | api-and-interface-design for approval states, backend-security-coder for atomic application |
| Shared history | Structured events with actor, time and values, localized React timeline | code-showcase-react-ui-patterns for timeline UI |
| Verification | pgTAP concurrent/state tests and Playwright network interruption with independent sessions | browser-testing-with-devtools for retries and matching balances |

## Working rules for this phase

Arabic and English have equal priority. Every delivered screen, system message and activity description must pass in both languages on mobile and desktop. Keep user-written reasons as entered.

Read the relevant installed SKILL.md before applying each skill. Skill names in this plan identify intended usage. Use the product specification for behavior and the implementation plan for shared architecture. Update the overview and affected phase file together when a decision changes.

A phase is complete when its deliverables exist and its acceptance checks have passed. Record actual verification results when implementing it.


## Local implementation and verification

Open a real accepted request under Friends & requests. The debtor can record a full or partial payment. A pending payment reserves its amount, and the creditor can confirm or decline it. Only confirmed payments reduce the remaining amount shown in the request and both users' lists. Confirming the last payment marks the request paid.

Either participant can propose a correction to the accepted amount or reason, or to a confirmed payment. The other participant approves or declines. Approval checks the latest request version and reserved total within the same transaction. A corrected payment can reopen a settled request. The activity includes actors, timestamps, values, reasons and the original request values.

The operation key and a payload digest persist in the current browser tab so a lost response can be retried safely after a reload. The local database and Chrome tests cover participant-only access, pending and confirmed balances, duplicate actions, a lost response, concurrent attempts, corrections, and the English and Arabic views. The Phase 0 dashboard continues to show sample data until Phase 4.
