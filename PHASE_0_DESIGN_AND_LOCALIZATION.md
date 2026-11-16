# Phase 0 — Design and bilingual foundation

[Implementation plan](./IMPLEMENTATION_PLAN.md) · [Product specification](./PRODUCT_SPEC.md) · [Next phase](./PHASE_1_ACCOUNTS_AND_PRIVACY.md)

## Prerequisites

The product specification and the EGP 500 request example.

## Scope, tools and skills

- **Work:** Design Dashboard and Money Request Detail on narrow and wide screens in both languages. Use the agreed example of EGP 500 requested for dinner, EGP 200 confirmed, and EGP 300 remaining. Include pending, empty, loading, validation and error states. Define navigation, typography, spacing, button styles, forms, status text and activity rows.
- **Tools:** React prototype, CSS custom properties and logical properties, i18next, Intl, browser DevTools and axe-core.
- **Skills:** `baseline-ui` for typography and layout, `anti-ui-slop` for content hierarchy, `code-showcase-react-ui-patterns` for reusable UI, and `accessibility-compliance-accessibility-audit` for contrast, focus, keyboard and touch.
- **Done when:** Both views are reviewed in Arabic RTL and English LTR on mobile and desktop. Text direction, mixed-language reasons, amounts, dates and focus order work in each language.

## Implementation sequence

Create a minimal Vite, React and TypeScript scaffold for the prototype, then build the two review screens with shared layout, amount, status and activity components. Add an Arabic and English locale switch and sample data for the pending and partially settled states.

## Deliverables

Responsive prototypes, shared CSS tokens, and starter locale resources.

## Verification

Check the four language and viewport combinations. Verify that the original reason survives a language switch and that EGP 500, EGP 200 and EGP 300 keep their values. Check keyboard focus, contrast and touch targets.

## Skills and tools by part

| Part | Tools and implementation | Skill and purpose |
|---|---|---|
| Prototype setup | Minimal Vite, React, TypeScript and npm scaffold reused in Phase 1 | code-showcase-react-ui-patterns for component structure |
| Visual system | CSS tokens, logical properties, semantic HTML, readable Arabic and English fonts | baseline-ui for spacing and typography, anti-ui-slop for hierarchy |
| Dashboard and request detail | Shared amount, status, navigation and activity components with sample data | code-showcase-react-ui-patterns for reusable UI, anti-ui-slop for prioritizing amount, reason and action |
| Localization | i18next, react-i18next and Intl, document language and direction, original user text preserved | baseline-ui for both layouts, accessibility-compliance-accessibility-audit for reading and focus order |
| Review | DevTools responsive views, axe-core and keyboard checks | accessibility-compliance-accessibility-audit for manual and automated review |

## Working rules for this phase

Arabic and English have equal priority. Every delivered screen, system message and activity description must pass in both languages on mobile and desktop. Keep user-written reasons as entered.

Read the relevant installed SKILL.md before applying each skill. Skill names in this plan identify intended usage. Use the product specification for behavior and the implementation plan for shared architecture. Update the overview and affected phase file together when a decision changes.

A phase is complete when its deliverables exist and its acceptance checks have passed. Record actual verification results when implementing it.


## Prototype and verification results

Run npm install via the lockfile with `npm ci`, then start the prototype with `npm run dev`. Open the local URL shown in the terminal. The navigation switches between the two views, the language selector persists across reloads, and Preview state exposes the sample scenarios.

The TypeScript check and Vite production build passed. Chrome checks at 390 px and 1280 px covered both screens in English LTR and Arabic RTL. Verified no horizontal overflow, unchanged Arabic reason text, EGP 500 requested, EGP 200 confirmed and EGP 300 remaining, required-reason validation, language persistence, and keyboard use of the skip link. Axe reported zero violations in the populated views across all eight screen, width and language combinations. Reviewed the rendered Arabic mobile request screen. These checks cover the local prototype with sample data.

Spend is the working title. The prototype uses a green accent and system fonts as initial design choices.

## Motion review for the Phase 0 prototype

| Skill | How it was used |
|---|---|
| [emil-design-eng](https://github.com/emilkowalski/skills/tree/main/skills/emil-design-eng) | Checked where the interface acknowledges an action and whether motion would make that feedback clearer. |
| [find-animation-opportunities](https://github.com/emilkowalski/skills/tree/main/skills/find-animation-opportunities) | Compared press feedback, navigation, financial visuals and form feedback for purpose and frequency. |
| [review-animations](https://github.com/emilkowalski/skills/tree/main/skills/review-animations) | Reviewed existing motion and screened the proposed transition for timing, interruption and reduced motion. |

| Before | After, if implemented | Why |
|---|---|---|
| The occasional Preview and Try again buttons have no custom press feedback. | For pointer presses, transition to scale(0.97) over 120 ms with cubic-bezier(0.23, 1, 0.32, 1), then return over 80 ms. Use an immediate color cue for reduced motion. Keep keyboard feedback immediate. | A brief press confirms the interaction without delaying the result. |

Navigation, language changes and keyboard focus should update immediately. The spending chart and repayment progress are for reading values, so decorative entrances would get in the way. Inline validation and success messages should appear immediately beside the form.

The current source contains no timed motion. The skip link changes position immediately on focus. Review verdict for the existing motion scope is approve. The button treatment is a proposal and has no runtime verification yet.

The receipt redesign applies the same motion review to the new layout. The request title, balance and timeline are immediately visible. The preview form uses a native disclosure with instant state changes and the existing pointer press cue. Chrome verification covered both screens at 390 px and 1280 px in both languages, including axe, horizontal overflow, keyboard disclosure, required-reason validation and reduced-motion behavior.
