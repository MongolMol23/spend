# Phase 2 — Friends and money requests

[Implementation plan](./IMPLEMENTATION_PLAN.md) · [Product specification](./PRODUCT_SPEC.md) · [Previous phase](./PHASE_1_ACCOUNTS_AND_PRIVACY.md) · [Next phase](./PHASE_3_PAYMENTS_AND_HISTORY.md)

## Prerequisites

Phase 1 accounts, profiles and access rules.

## Scope, tools and skills

- **Work:** Build username search, incoming and outgoing friend requests, acceptance and rejection, and the friends list. Prevent self-addition and duplicate requests or friendships. Implement money requests with amount, currency, required reason and optional due date. Only accepted friends can start a request. Deliver new requests to the recipient while the app is open and show incoming and outgoing requests and in-app indicators for actions needing a response. Show accepted requests in Owed to Me and I Owe. Add cancellation before response and apply the spec's rule for existing requests after unfriending.
- **Tools:** SQL constraints, RLS, PostgreSQL RPCs, Supabase JS, TanStack Query, shared React components, pgTAP and Playwright. Use authenticated change subscriptions or periodic refresh for active views, and refetch on reconnect and return to the app.
- **Skills:** `api-and-interface-design` for role-specific actions and states, `backend-security-coder` for friend checks and participant permissions, and `code-showcase-react-ui-patterns` for forms, lists and request detail.
- **Done when:** A pending friendship cannot send a money request through the UI or API. The recipient alone can accept or decline. A new request appears for the recipient with the app open without a manual refresh, and is retrieved after reopening or reconnecting. Both participants see the same request and activity, and a third account cannot read or modify it.

## Implementation sequence

Define friendship and money request states in SQL. Build the friend search, sent and received lists, and request detail. Enforce actor and state rules inside RPCs and add activity events in the same transaction. Select authenticated subscriptions or periodic refresh and verify automatic delivery.

## Deliverables

Friendship and request migrations, bilingual request UI, participant-only access tests and shared activity for request transitions.

## Verification

Use three accounts. Test absent or pending friendship, duplicate and self-add attempts, a blank reason and invalid amount. Verify accept, decline and cancel permissions, automatic arrival, and preservation of history after removing a friend.

## Skills and tools by part

| Part | Tools and implementation | Skill and purpose |
|---|---|---|
| Search and friendships | Username lookup, friendship SQL constraints and state-changing RPCs | api-and-interface-design for transitions, backend-security-coder for actor checks |
| Money request form | React, Zod, required reason, positive amount, currency and optional due date | code-showcase-react-ui-patterns for forms, api-and-interface-design for submission contract |
| Accept, decline and cancel | PostgreSQL transaction and immutable activity event for each accepted action | backend-security-coder for participant, actor and state enforcement |
| Incoming and outgoing lists | TanStack Query refresh or authenticated subscriptions, badges and detail links | code-showcase-react-ui-patterns for loading and response states |
| Validation | pgTAP, Playwright, mixed-language two-user journey and third-account denial | backend-security-coder for direct API checks, browser-testing-with-devtools for UI behavior |

## Working rules for this phase

Arabic and English have equal priority. Every delivered screen, system message and activity description must pass in both languages on mobile and desktop. Keep user-written reasons as entered.

Read the relevant installed SKILL.md before applying each skill. Skill names in this plan identify intended usage. Use the product specification for behavior and the implementation plan for shared architecture. Update the overview and affected phase file together when a decision changes.

A phase is complete when its deliverables exist and its acceptance checks have passed. Record actual verification results when implementing it.


## Local implementation and verification

Open /connections after confirming an account and saving its profile. Search by exact username, accept a friendship on the other account, then send and respond to an EGP request. The Connections workspace refreshes every three seconds while mounted. Existing requests and activity remain visible to their participants after friendship removal. The Phase 0 dashboard and sample request remain preview screens.

The Phase 2 migration and generated Supabase types are in the repository. The pilot uses EGP, stored in minor units. The browser accepts Arabic and English digits in the amount field and preserves the reason as entered.

The three-account Playwright journey passed in Chrome with automatic delivery, Arabic and English participants, and a denied third-account detail link. Axe and viewport checks passed in the English desktop and Arabic mobile views used in that journey. All 17 Phase 2 SQL checks and all eight profile checks passed. The production build, lint and existing unit tests passed. Browser verification used the existing Playwright and Chrome setup.
