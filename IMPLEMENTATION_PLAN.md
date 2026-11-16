# Expense Manager — Implementation Plan

[Product specification](./PRODUCT_SPEC.md) defines the product requirements. This plan defines the build order, stack, skills to apply in each phase, and what must pass before moving on. The first pilot is 4–6 people using the regular public registration flow.

## 1. Working stack

| Area | Selection | Used for |
|---|---|---|
| Web app | React, TypeScript in strict mode, Vite, Node.js LTS, npm, React Router | Responsive web app, routing, development server, production build and lockfile |
| Design | Semantic HTML, CSS custom properties and logical properties, native controls where practical | Shared design tokens, layouts that follow text direction, keyboard and touch use |
| Localization | i18next, react-i18next, browser Intl APIs | English and Arabic strings, plurals, numbers, currency and dates |
| Forms and data | React forms, Zod, TanStack Query, Supabase JS and generated database types | Input validation, typed data access, loading/error states and refetch after writes |
| Backend | Supabase Auth, PostgreSQL, SQL migrations, constraints, row-level security (RLS) and database functions exposed as RPCs | Accounts, persistence, permissions and atomic financial operations |
| Local backend | Supabase CLI, Docker, local Mailpit | Reproducible database, seed data and signup/recovery email tests |
| Quality | Oxlint, TypeScript compiler, Vitest, Testing Library, pgTAP, Playwright, axe-core, browser DevTools | Static checks, component and business rules, database permissions, end-to-end journeys and accessibility |
| Delivery | Git, GitHub Actions and a static HTTPS host | CI, preview and production frontend deployment. Hosting and email provider selection are launch decisions. |
| Installability | Web app manifest and icons | Installable experience where supported. Shared actions need a connection in v1. |

React, TypeScript and Supabase carry forward from the spec. The supporting libraries and CI setup are implementation choices for this plan. Pin the chosen dependency versions and commit the lockfile at scaffold time.

## 2. Phases and skills

- [Phase 0 — Design and bilingual foundation](./PHASE_0_DESIGN_AND_LOCALIZATION.md)
- [Phase 1 — App scaffold, accounts and privacy](./PHASE_1_ACCOUNTS_AND_PRIVACY.md)
- [Phase 2 — Friends and money requests](./PHASE_2_FRIENDS_AND_REQUESTS.md)
- [Phase 3 — Payments, corrections and shared history](./PHASE_3_PAYMENTS_AND_HISTORY.md)
- [Phase 4 — Personal ledger and dashboard](./PHASE_4_PERSONAL_LEDGER.md)
- [Phase 5 — Release checks and pilot](./PHASE_5_RELEASE_AND_PILOT.md)

### Phase 0 — Design and bilingual foundation

- **Work:** Design Dashboard and Money Request Detail on narrow and wide screens in both languages. Use the agreed example of EGP 500 requested for dinner, EGP 200 confirmed, and EGP 300 remaining. Include pending, empty, loading, validation and error states. Define navigation, typography, spacing, button styles, forms, status text and activity rows.
- **Tools:** React prototype, CSS custom properties and logical properties, i18next, Intl, browser DevTools and axe-core.
- **Skills:** `baseline-ui` for typography and layout, `anti-ui-slop` for content hierarchy, `code-showcase-react-ui-patterns` for reusable UI, and `accessibility-compliance-accessibility-audit` for contrast, focus, keyboard and touch.
- **Done when:** Both views are reviewed in Arabic RTL and English LTR on mobile and desktop. Text direction, mixed-language reasons, amounts, dates and focus order work in each language.

### Phase 1 — App scaffold, accounts and privacy

- **Work:** Set up the repository, frontend, test runners, local Supabase and migrations. Implement public signup, email confirmation, login, logout and password recovery. Add a unique username with normalized lookup, a display name, and a preferred language. Store the language locally before login and in the profile after login. Clear account-specific query data when the session changes.
- **Tools:** Vite, React Router, Supabase Auth and JS, PostgreSQL, Supabase CLI, Docker, Mailpit, Zod, TanStack Query, pgTAP and Playwright.
- **Skills:** `auth-implementation-patterns` for account flows, `api-and-interface-design` for profile and error contracts, and `backend-security-coder` for database privileges and profile access.
- **Done when:** A new user can register without an invite, confirm email and recover access. Duplicate usernames are rejected. The language switch works before and after login. Username lookup exposes display name and username only. Anonymous and unrelated users are denied access to private records.

### Phase 2 — Friends and money requests

- **Work:** Build username search, incoming and outgoing friend requests, acceptance and rejection, and the friends list. Prevent self-addition and duplicate requests or friendships. Implement money requests with amount, currency, required reason and optional due date. Only accepted friends can start a request. Deliver new requests to the recipient while the app is open and show incoming and outgoing requests and in-app indicators for actions needing a response. Show accepted requests in Owed to Me and I Owe. Add cancellation before response and apply the spec's rule for existing requests after unfriending.
- **Tools:** SQL constraints, RLS, PostgreSQL RPCs, Supabase JS, TanStack Query, shared React components, pgTAP and Playwright. Use authenticated change subscriptions or periodic refresh for active views, and refetch on reconnect and return to the app.
- **Skills:** `api-and-interface-design` for role-specific actions and states, `backend-security-coder` for friend checks and participant permissions, and `code-showcase-react-ui-patterns` for forms, lists and request detail.
- **Done when:** A pending friendship cannot send a money request through the UI or API. The recipient alone can accept or decline. A new request appears for the recipient with the app open without a manual refresh, and is retrieved after reopening or reconnecting. Both participants see the same request and activity, and a third account cannot read or modify it.

### Phase 3 — Payments, corrections and shared history

- **Work:** Record full or partial payments, then let the creditor confirm or decline receipt. Derive the remaining balance from confirmed payments. Pending payments reserve part of the amount. Implement proposed corrections to the accepted request amount or reason, and correction or cancellation of a confirmed payment. Either party can propose a correction with a reason, the other approves or rejects. Keep the balance unchanged until approval and record responses. Revalidate against the latest state before applying it. Preserve the original event and record the correction.
- **Tools:** Transactional PostgreSQL RPCs, row locking on the request, database constraints, unique idempotency keys, typed activity records, pgTAP and multi-session Playwright. Use the same operation key when retrying a submission after a lost response.
- **Skills:** `api-and-interface-design` for payment and correction contracts, `backend-security-coder` for atomicity and permissions, and `browser-testing-with-devtools` for retries, network behavior and two-account verification.
- **Done when:** EGP 500 remains outstanding until the EGP 200 payment is confirmed. Then both accounts see EGP 300. A repeated confirmation or retry after a lost response changes the balance once and records one event for that operation. Concurrent submissions cannot overpay. Corrections preserve history and can reopen a settled debt when the corrected balance is positive.

### Phase 4 — Personal ledger and dashboard

| Feature | Work and tools | Skills applied |
|---|---|---|
| Purchases | React forms and filters, SQL expenses and categories, localized monthly summaries. Record item, date, amount, category and optional note. | `code-showcase-react-ui-patterns`, `backend-security-coder` |
| Private debts | SQL private debt and payment records, with React detail views. Record contact name, direction, amount, optional due date and partial payments. | `api-and-interface-design`, `backend-security-coder` |
| Savings goals | SQL goals and contribution/withdrawal movements, with React progress and history. Show target, optional target date, saved amount and remaining amount. | `code-showcase-react-ui-patterns`, `api-and-interface-design` |
| Installments | SQL plans with item name and total commitment, due dates and payment amounts, with React upcoming, overdue and paid views. Validate allocations and update the schedule with each payment. | `api-and-interface-design`, `backend-security-coder` |
| Dashboard and personal activity | PostgreSQL queries for authorized totals and due items, TanStack Query for loading and refresh, shared bilingual UI for quick add, activity and summaries. | `baseline-ui`, `anti-ui-slop`, `code-showcase-react-ui-patterns`, `accessibility-compliance-accessibility-audit` |

- **Done when:** Every personal movement appears in its feature and private activity. Changes and removals from view are recorded in the owner's activity. Dashboard totals distinguish purchases, debt payments, installments and savings. A payment represented in two views contributes once to the relevant total. Private records stay owner-only.

### Phase 5 — Release checks and pilot

- **Work:** Run automated checks in CI. Exercise local and staging migrations, configure custom SMTP for public confirmation and recovery, and verify redirect URLs and bilingual account messages. Deploy to HTTPS, validate installability, and use separate staging and production Supabase projects. Verify backup and restore procedures before pilot data is entered. Use test accounts and synthetic data in staging. Keep credentials, request reasons and personal financial data out of application logs.
- **Tools:** GitHub Actions, Oxlint, TypeScript, Vitest, Testing Library, Supabase CLI and pgTAP, Playwright, axe-core, DevTools, a static HTTPS host and a transactional SMTP provider.
- **Skills:** `browser-testing-with-devtools` for cross-browser and device checks, `accessibility-compliance-accessibility-audit` for manual and automated accessibility review, `auth-implementation-patterns` for public signup and email delivery, and `backend-security-coder` for database and release access checks.
- **Done when:** CI is green, both locales pass on mobile and desktop, public signup and recovery work on staging, the three-account privacy scenario passes, and all 4–6 pilot users can use the regular signup flow and complete the agreed journeys.

## 3. Rules across phases

- **Data and access.** Each shared debt has one record and two participants. Use owner-only policies for personal tables and participant-only access for shared records. Enforce role and state checks on the server even when the UI hides an action. Write each financial transition and activity event together in one transaction.
- **Money and time.** Store amounts in integer minor units with a currency code. Use EGP as the pilot default, and display totals by currency where multiple currencies exist. Use UTC timestamps for activity and calendar dates for due dates. Define and test the reporting time zone for monthly totals.
- **Retries and history.** Scope operation keys to the actor and operation, reject reuse with a different payload, and derive balances from effective confirmed movements. Activity events store structured data and are rendered in the viewer's language. Keep user-written reasons and notes as entered.
- **Bilingual acceptance.** Every screen, validation message, status, activity event and account email is tested in both locales. Set the document language and direction, use logical layout properties, and verify mixed-direction text, keyboard focus, mobile touch targets and display of money and dates.
- **Scope.** The app records transactions between users. Payment processing, bank/wallet balance tracking, group ledgers, category budgets and Excel export are outside v1. In-app requests and due dates come first. External reminders and offline financial writes are deferred.

## 4. Repository layout and verification

| Path | Contents |
|---|---|
| `src/app/` | Routes, providers and session handling |
| `src/features/` | Accounts, friends, requests, payments, personal ledger, dashboard and activity |
| `src/data/` | Shared Supabase client and generated database types |
| `src/ui/` and `src/i18n/` | Shared components, design tokens, locale resources and formatters |
| `supabase/migrations/` and `supabase/tests/` | Database schema, policies, transaction functions and SQL tests |
| `tests/e2e/` and `.github/workflows/` | Browser journeys and CI checks |

Proposed commands to wire up in Phase 1. Run `npm ci`, then `npm run lint`, `npm run typecheck`, `npm run test` and `npm run build`. With the local Supabase stack started and migrated, run `npx supabase test db` and `npm run test:e2e`.

The release suite covers account lifecycle, a third account attempting direct API access, invalid amounts and reasons, role checks, request and payment rejection, partial and full settlement, duplicate and concurrent writes, a lost-response retry, approved and rejected corrections, personal totals, and locale parity. Playwright uses separate browser contexts for each account. Verify database permissions with signed-in user roles as well as through the UI.

## 5. Decisions before launch

Confirm the public domain and hosting provider, the SMTP provider and sender domain, the app name and icons, the reporting time zone, and the pilot date. Verify how signup and recovery email templates receive their locale and test both languages with real staging inboxes.

## Requirements coverage

| Requested behavior | Delivery phase | Acceptance evidence |
|---|---|---|
| Record what I bought and its price | 4 | Purchase with item, amount, date and category appears in history and monthly summary |
| Money I owe and money owed to me | 2–4 | Both directions show accepted shared debts and owner-only private debts |
| Save toward a named goal | 4 | Target, contributions, withdrawals, saved and remaining amounts agree |
| Track installments | 4 | Item, total, schedule, paid, overdue and remaining amounts agree |
| Multiple people and open signup | 1 and 5 | 4–6 pilot users register normally, with public signup available to others |
| Add each other before requesting money | 2 | Accepted friendship required by both UI and database |
| Request appears for the other person with a reason | 2 | Recipient sees the amount and required original reason while the app is open |
| Keep all financial activity | 2–4 | Requests, responses, payments, corrections and personal changes retain actor and time |
| Confirm partial payments and update both balances | 3 | EGP 500 less EGP 200 confirmed gives EGP 300 for both participants |
| Recover from interrupted or repeated submissions | 3 | Retry records one payment and one event for the operation |
| Correct mistakes with the other party's approval | 3 | Approval changes the balance and preserves original history, rejection keeps the balance |
| Modern, comfortable interface | 0 and 5 | Reviewed typography, spacing, hierarchy, contrast, keyboard and touch behavior |
| Arabic and English with equal priority | Every phase | Both layouts and all system text pass, including errors, emails and activity |
| Tools and skills for every part | All six phase files | Each part maps to tools, a skill and acceptance checks |

Phase 0 creates the minimal frontend scaffold needed for its prototype. Phase 1 extends it with accounts and backend setup. Each phase file contains task-level skill mappings and shares the architecture and business rules in this plan.

Supporting libraries, EGP as the pilot default, and the proposed rules for unfriending and cancellation before response are recorded implementation choices. Domain, branding, SMTP/hosting providers and reporting time zone remain decisions to settle before their relevant implementation or release step.

## References

- [Supabase database permissions](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase database testing](https://supabase.com/docs/guides/database/testing)
- [Supabase local auth testing](https://supabase.com/docs/guides/auth/testing-auth-flows)
- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Playwright multi-account testing](https://playwright.dev/docs/auth)

## Code organization and review for every phase

Keep the entry point focused on bootstrapping. Put the shell and navigation in src/app, feature screens and their data in src/features, shared controls in src/ui, and translations and locale formatting in src/i18n. Keep prototype fixtures separate from rendering so the same data can drive multiple views and can be replaced by live data later.

Add comments to explain intent, constraints, and non-obvious behavior. Keep comments current when the code changes. Before closing each phase, clean up superseded styles and duplicated behavior touched in that phase, run the production build, and check the affected flows in both languages.
