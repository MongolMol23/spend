# Phase 5 — Release checks and pilot

[Implementation plan](./IMPLEMENTATION_PLAN.md) · [Product specification](./PRODUCT_SPEC.md) · [Previous phase](./PHASE_4_PERSONAL_LEDGER.md)

## Prerequisites

Phases 0–4 pass their acceptance checks. Hosting, sender domain, SMTP provider and pilot date need to be settled before release.

## Scope, tools and skills

- **Work:** Run automated checks in CI. Exercise local and staging migrations, configure custom SMTP for public confirmation and recovery, and verify redirect URLs and bilingual account messages. Deploy to HTTPS, validate installability, and use separate staging and production Supabase projects. Verify backup and restore procedures before pilot data is entered. Use test accounts and synthetic data in staging. Keep credentials, request reasons and personal financial data out of application logs.
- **Tools:** GitHub Actions, ESLint, TypeScript, Vitest, Testing Library, Supabase CLI and pgTAP, Playwright, axe-core, DevTools, a static HTTPS host and a transactional SMTP provider.
- **Skills:** `browser-testing-with-devtools` for cross-browser and device checks, `accessibility-compliance-accessibility-audit` for manual and automated accessibility review, `auth-implementation-patterns` for public signup and email delivery, and `backend-security-coder` for database and release access checks.
- **Done when:** CI is green, both locales pass on mobile and desktop, public signup and recovery work on staging, the three-account privacy scenario passes, and all 4–6 pilot users can use the regular signup flow and complete the agreed journeys.

## Implementation sequence

Run CI and apply migrations to staging. Exercise public signup and recovery with real staging inboxes in both languages. Verify privacy, HTTPS, manifest, icons and restore procedures, then deploy and run the pilot through regular signup.

## Deliverables

CI results, release and rollback instructions, staging verification and pilot feedback.

## Verification

Run the three-account privacy journey and the full EGP 500 → EGP 300 scenario. Check keyboard and touch, both languages, and mobile and desktop. Have 4–6 pilot users try the normal signup and core flows.

## Skills and tools by part

| Part | Tools and implementation | Skill and purpose |
|---|---|---|
| Automated checks | GitHub Actions, compiler, ESLint, Vitest, pgTAP and Playwright | backend-security-coder for access checks, browser-testing-with-devtools for user journeys |
| Public email delivery | Custom SMTP, approved sender domain, redirect configuration and both email languages | auth-implementation-patterns for confirmation and recovery |
| Bilingual usability | Mobile and desktop browser checks, axe-core and keyboard review | accessibility-compliance-accessibility-audit for accessibility, browser-testing-with-devtools for layout and interactions |
| Deployment and recovery | HTTPS host, separate Supabase environments, migrations and restore rehearsal | backend-security-coder for environment secrets and database permissions |
| Installability | Manifest, icons and browser/device checks | browser-testing-with-devtools for supported installation flows |
| Pilot | 4–6 regular registrations and the complete product journeys | browser-testing-with-devtools for reproduction and verification of pilot issues |

## Working rules for this phase

Arabic and English have equal priority. Every delivered screen, system message and activity description must pass in both languages on mobile and desktop. Keep user-written reasons as entered.

Read the relevant installed SKILL.md before applying each skill. Skill names in this plan identify intended usage. Use the product specification for behavior and the implementation plan for shared architecture. Update the overview and affected phase file together when a decision changes.

A phase is complete when its deliverables exist and its acceptance checks have passed. Record actual verification results when implementing it.

