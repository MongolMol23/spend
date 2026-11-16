# Phase 4 — Personal ledger and dashboard

[Implementation plan](./IMPLEMENTATION_PLAN.md) · [Product specification](./PRODUCT_SPEC.md) · [Previous phase](./PHASE_3_PAYMENTS_AND_HISTORY.md) · [Next phase](./PHASE_5_RELEASE_AND_PILOT.md)

## Prerequisites

Phase 3 debt balances and shared activity, plus Phase 0 components.

## Scope, tools and skills

| Feature | Work and tools | Skills applied |
|---|---|---|
| Purchases | React forms and filters, SQL expenses and categories, localized monthly summaries. Record item, date, amount, category and optional note. | `code-showcase-react-ui-patterns`, `backend-security-coder` |
| Private debts | SQL private debt and payment records, with React detail views. Record contact name, direction, amount, optional due date and partial payments. | `api-and-interface-design`, `backend-security-coder` |
| Savings goals | SQL goals and contribution/withdrawal movements, with React progress and history. Show target, optional target date, saved amount and remaining amount. | `code-showcase-react-ui-patterns`, `api-and-interface-design` |
| Installments | SQL plans with item name and total commitment, due dates and payment amounts, with React upcoming, overdue and paid views. Validate allocations and update the schedule with each payment. | `api-and-interface-design`, `backend-security-coder` |
| Dashboard and personal activity | PostgreSQL queries for authorized totals and due items, TanStack Query for loading and refresh, shared bilingual UI for quick add, activity and summaries. | `baseline-ui`, `anti-ui-slop`, `code-showcase-react-ui-patterns`, `accessibility-compliance-accessibility-audit` |

- **Done when:** Every personal movement appears in its feature and private activity. Changes and removals from view are recorded in the owner's activity. Dashboard totals distinguish purchases, debt payments, installments and savings. A payment represented in two views contributes once to the relevant total. Private records stay owner-only.

## Implementation sequence

Build purchases, private debts, savings and installments one at a time. For each, add owner-scoped SQL, typed data access, forms, history and both locale resources. Use Supabase JS, Zod, TanStack Query and Intl across features. Connect the dashboard to purchases by month and category, money owed in both directions, upcoming due items and requests needing a response.

## Purchases implementation

- A confirmed account can add, edit, and remove purchases from the active log. The log supports month and category filters and starts with seven preset categories. Entries retain the exact amount in piastres and the user-entered note.
- Each save and removal writes an owner-only history event in the same database transaction. Edits and removals retain the before and after values. Removed purchases stay in history and are excluded from spending totals.
- The public landing page lives at `/`. The dashboard at `/overview` shows signed-in users their monthly spending, category totals, and recent purchases. Signed-out visitors can sign in or create an account from either page.
- The migration was applied to local Supabase. All 84 pgTAP checks passed, including 27 for purchase privacy, retries, history, and totals. The three Chrome end-to-end tests, four unit tests, lint, and the production build passed. The purchase flow includes Arabic input, both filters, history, and an automated accessibility check on the Arabic mobile view.

## Private debts implementation

- Confirmed accounts can add, edit, and archive debts in either direction. The contact name is free text, and a due date is optional. Repayments record an amount and date, with the original, paid, and remaining amounts shown together.
- The database applies repayments atomically and preserves their direction once any repayment exists. Repeating the same operation does not duplicate it. Private activity retains previous and new debt values, repayment details, and archived records.
- The signed-in dashboard combines outstanding private debts with accepted shared requests. It subtracts confirmed shared repayments and shows the earliest dated outstanding debt and incoming requests needing a response. Purchase spending remains a separate total.
- The migration was applied to local Supabase. All 109 pgTAP checks passed, including 25 new checks for privacy, payment limits, retries, history, and dashboard totals. All four Chrome end-to-end tests and four unit tests passed, along with lint and the production build. The debt flow includes English desktop and Arabic mobile, with an automated accessibility check on the Arabic dark-mode detail view.

## Savings goals implementation

- Confirmed accounts can create a goal with a target amount and an optional date, record deposits and withdrawals, and view progress and movement history. Deposits can take a goal above its target.
- Withdrawals check the available balance in the same transaction that records the movement and its history. Owners can edit or archive goals, and archived goals remain readable through private history.
- The dashboard shows the balance in active goals and the month's deposits and withdrawals. Archiving a goal removes its balance from active savings and preserves past movements in monthly totals.
- The migration was applied to local Supabase. All 130 pgTAP checks passed, including 21 savings checks. All five Chrome end-to-end tests passed on the full rerun after one password-recovery timeout. The savings browser test covers goal edits, withdrawals, dashboard totals, and Arabic mobile accessibility.

## Installments implementation

- Confirmed accounts can create a plan with individually dated installments. The scheduled amounts must equal the total. The plan name remains editable after the first payment, when the total and schedule become read-only.
- Owners can record full or partial payments, filter the schedule by status, and archive a plan. Payments cannot exceed the balance of the selected installment. Archiving removes the remaining balance from active totals and preserves the payment and change history.
- The signed-in dashboard shows monthly installment payments, outstanding and overdue balances, and a link to the earliest outstanding installment. These payments are counted separately from purchases and savings.
- The migration was applied to local Supabase. All 145 pgTAP checks passed, including 15 installment checks for privacy, retries, payment limits and dashboard totals.
- All six Chrome end-to-end tests and four unit tests passed, along with lint and the production build. The installment browser flow covers English desktop, Arabic dark-mode mobile accessibility, and navigation through the mobile More menu. The navbar fit at ten checked widths in both languages.

## Remaining dashboard work

- The phase plan also calls for dashboard quick add and separate debt repayment totals. The dashboard currently shows outstanding debt balances and upcoming debt obligations.

## Deliverables

Personal ledger screens, quick add, private activity, dashboard totals and upcoming obligations.

## Verification

Use pgTAP and Playwright to check ownership, movements and totals. Test an off-app contact, savings deposits and withdrawals, overdue installments, and duplicate counting across views. Verify the dashboard in both languages.

All personal features use backend-security-coder for owner permissions and atomic history updates. Use browser-testing-with-devtools for their normal entry points, and accessibility-compliance-accessibility-audit for bilingual keyboard and touch checks. Savings withdrawals must stay within the saved balance. Installment schedules must match the plan total and confirmed payments must stay within the amount due. Record changes and removals from view with their previous and new values in the owner's history.

## Working rules for this phase

Arabic and English have equal priority. Every delivered screen, system message and activity description must pass in both languages on mobile and desktop. Keep user-written reasons as entered.

Read the relevant installed SKILL.md before applying each skill. Skill names in this plan identify intended usage. Use the product specification for behavior and the implementation plan for shared architecture. Update the overview and affected phase file together when a decision changes.

A phase is complete when its deliverables exist and its acceptance checks have passed. Record actual verification results when implementing it.

