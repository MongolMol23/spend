# Phase 1 — App scaffold, accounts and privacy

[Implementation plan](./IMPLEMENTATION_PLAN.md) · [Product specification](./PRODUCT_SPEC.md) · [Previous phase](./PHASE_0_DESIGN_AND_LOCALIZATION.md) · [Next phase](./PHASE_2_FRIENDS_AND_REQUESTS.md)

## Prerequisites

Phase 0 design and localization conventions.

## Scope, tools and skills

- **Work:** Set up the repository, frontend, test runners, local Supabase and migrations. Implement public signup, email confirmation, login, logout and password recovery. Add a unique username with normalized lookup, a display name, and a preferred language. Store the language locally before login and in the profile after login. Clear account-specific query data when the session changes.
- **Tools:** Vite, React Router, Supabase Auth and JS, PostgreSQL, Supabase CLI, Docker, Mailpit, Zod, TanStack Query, pgTAP and Playwright.
- **Skills:** `auth-implementation-patterns` for account flows, `api-and-interface-design` for profile and error contracts, and `backend-security-coder` for database privileges and profile access.
- **Done when:** A new user can register without an invite, confirm email and recover access. Duplicate usernames are rejected. The language switch works before and after login. Username lookup exposes display name and username only. Anonymous and unrelated users are denied access to private records.

## Implementation sequence

Extend the Phase 0 scaffold using Node.js LTS, npm, Vite, React and strict TypeScript. Commit the lockfile and wire up Oxlint, Vitest and Testing Library. Create SQL migrations for profiles and access policies. Build account screens and Settings, validate input, and capture confirmation and recovery emails with Mailpit. Generate database types.

## Deliverables

Runnable local app, account routes, locale persistence, migrations, generated types and local setup instructions.

## Verification

Check signup without an invitation, email confirmation and password recovery in both languages. Verify username uniqueness, isolation across account switches, and profile access with anonymous and unrelated sessions.

## Skills and tools by part

| Part | Tools and implementation | Skill and purpose |
|---|---|---|
| App foundation | Extend the Phase 0 Vite app, add React Router, Oxlint, TypeScript checks, Vitest and Testing Library | code-showcase-react-ui-patterns for shared UI structure |
| Public registration and recovery | Supabase Auth, Mailpit, bilingual forms and Zod validation | auth-implementation-patterns for account lifecycle |
| Profile and Settings | PostgreSQL profile, normalized username lookup, Supabase JS and generated types | api-and-interface-design for validation and errors, backend-security-coder for access controls |
| Session and language | TanStack Query cache lifecycle, saved locale and i18next resources | auth-implementation-patterns for session handling, code-showcase-react-ui-patterns for form states |
| Permission verification | RLS, pgTAP and separate Playwright sessions | backend-security-coder for anonymous, owner and third-account checks |

## Working rules for this phase

Arabic and English have equal priority. Every delivered screen, system message and activity description must pass in both languages on mobile and desktop. Keep user-written reasons as entered.

Read the relevant installed SKILL.md before applying each skill. Skill names in this plan identify intended usage. Use the product specification for behavior and the implementation plan for shared architecture. Update the overview and affected phase file together when a decision changes.

A phase is complete when its deliverables exist and its acceptance checks have passed. Record actual verification results when implementing it.


## Local account setup

1. Install the pinned packages with npm ci and start Docker Desktop.
2. Run npx supabase start -x studio,postgres-meta,logflare,vector,edge-runtime,storage-api,realtime,imgproxy from the project root for the Phase 1 stack. Copy .env.example to .env.local and enter the local API URL and publishable key shown by Supabase. Keep the server-side secret key out of Vite environment variables.
3. Run npm run dev and open http://127.0.0.1:5173/account. Use that exact origin for local email links. Mailpit opens at http://127.0.0.1:54324.
4. Run npm run lint, npm run typecheck, npm test, and npm run build. With Supabase running, use npx supabase test db and npm run test:e2e.

The account routes are /account, /account/signup, /account/forgot, /account/confirm and /account/reset. The confirmation and recovery templates include both languages. The app removes one-time credentials from the browser URL and requires a click before verifying them. Supabase Auth manages credentials and sessions, and PostgreSQL enforces owner-only access to profile preferences. The authenticated username lookup returns the username and display name.

Oxlint replaces the planned ESLint setup for now because the TypeScript ESLint plugin rejects the project's pinned TypeScript version. This phase uses the Supabase CLI local SMTP configuration for Mailpit.

## Verification results

The local migration applied and Supabase generated the schema types in src/data. All eight pgTAP checks passed for profile ownership, authenticated lookup, username uniqueness, and anonymous denial. The Chrome integration test passed with local email confirmation, profile language persistence, password recovery, and sign-in with the replacement password. Lint, TypeScript, the production build, and four Vitest checks passed.

The full local stack stopped when postgres-meta failed its health check. The Phase 1 command above starts the database, Auth, API, and Mailpit without the optional services.

Registration collects a unique username, Arabic and English names, email, password and password confirmation. The signup transaction reserves the username and stores both names. After confirming the email, the user can share their username for friend lookup. Accounts created through the earlier form can still add or edit their username from Account settings.
