# Next.js Improvements and Enhancements

## Purpose
Track post-port improvements for `card-upload-nextjs/` without extending the completed milestone migration plan.

This document is for:
- UX improvements
- mobile optimization
- polish
- future product enhancements
- follow-up parser or fixture coverage work that is outside the original parity milestones

## Planning Rules
- Treat this as a backlog, not a shipped-work log.
- Before implementing any enhancement, define:
  - goal
  - user impact
  - affected screens/components
  - test/verification plan
- Group related improvements into small implementation batches instead of one large redesign.

## Priority Backlog

### 1. Mobile-First Workflow Layout
Goal:
- Make the results flow easier to use on small screens.

Why it matters:
- The current workflow is usable on mobile, but it still feels desktop-first.
- Important content is stacked as equally heavy sections, which creates a long and dense scroll on phones.

Planned changes:
- Convert the results area into a clearer mobile-first sequence:
  - summary
  - card selection
  - transactions
  - reconciliation
  - downloads
- Reduce copy length in the hero and upload areas for smaller screens.
- Improve spacing, section order, and visual hierarchy so the most important data appears earlier.

Likely files:
- `card-upload-nextjs/src/components/upload-shell.tsx`
- `card-upload-nextjs/src/components/upload-shell.module.css`
- `card-upload-nextjs/src/app/page.tsx`

### 2. Replace Wide Tables on Mobile
Goal:
- Remove horizontal-scroll dependence for transactions, reconciliation, and card summaries on narrow screens.

Why it matters:
- The current table layouts rely on `overflow-x` and `min-width`, which is functional but not comfortable on phones.

Planned changes:
- Keep table layouts for desktop.
- Render stacked mobile card/list layouts for:
  - transaction rows
  - reconciliation rows
  - per-card summary rows
- Preserve all key values while making each row readable without side-scrolling.

Likely files:
- `card-upload-nextjs/src/components/upload-shell.tsx`
- `card-upload-nextjs/src/components/upload-shell.module.css`

### 3. Better Card Switching for Touch Devices
Goal:
- Replace or supplement the card selector with faster tap-based controls.

Why it matters:
- A native select works, but it is not the best interaction when only a small number of card endings exist.

Planned changes:
- Replace the current dropdown with segmented buttons or chips when the card count is small.
- Keep the interaction obvious and thumb-friendly.
- Ensure the selected card state remains visually prominent.

Likely files:
- `card-upload-nextjs/src/components/upload-shell.tsx`
- `card-upload-nextjs/src/components/upload-shell.module.css`

### 4. Sticky Primary Actions on Mobile
Goal:
- Keep the main export action accessible without requiring users to scroll back through the page.

Why it matters:
- On mobile, the combined CSV action can end up separated from the transactions and review sections.

Planned changes:
- Add a sticky bottom action area for the primary download action on small screens.
- Consider including the selected card context in that action area when helpful.
- Ensure the sticky UI does not obscure content or system browser controls.

Likely files:
- `card-upload-nextjs/src/components/upload-shell.tsx`
- `card-upload-nextjs/src/components/upload-shell.module.css`

### 5. Collapse Secondary Sections by Default
Goal:
- Reduce cognitive load and scroll length on mobile.

Why it matters:
- Reconciliation and excluded rows are useful, but they do not need full visual weight on first view for every statement.

Planned changes:
- Collapse reconciliation by default when the statement is fully reconciled.
- Keep reconciliation expanded automatically when a mismatch exists.
- Keep excluded rows in a collapsed audit pattern and consider applying the same approach to per-card summary details on phones.

Likely files:
- `card-upload-nextjs/src/components/upload-shell.tsx`

### 6. Stronger Status and Error Presentation
Goal:
- Improve scanability of success, warning, blocked, and error states.

Why it matters:
- Mobile users scan quickly and need clearer visual distinction than paragraph text alone.

Planned changes:
- Increase contrast and visual weight for warning/error states.
- Add clearer section-level labels for:
  - ready
  - needs review
  - blocked from export
  - extraction failed
  - parsing failed
- Consider compact badges or banners where appropriate.

Likely files:
- `card-upload-nextjs/src/components/upload-shell.tsx`
- `card-upload-nextjs/src/components/upload-shell.module.css`

### 7. Switchable Light/Dark Mode
Goal:
- Let users choose between light and dark appearance modes without changing the workflow or parser behavior.

Why it matters:
- A manual theme switch improves comfort in different lighting conditions, especially on mobile.
- The current visual design is fixed to a warm light theme, which limits user preference and accessibility.

Planned changes:
- Add a visible theme toggle to the Next.js app.
- Support explicit light and dark mode selection instead of relying only on system preference.
- Define shared color tokens so both themes stay consistent across:
  - page chrome
  - cards and tables
  - warnings and errors
  - buttons and links
- Persist the user’s theme choice locally in the browser.
- Ensure contrast remains strong in both modes.

Likely files:
- `card-upload-nextjs/src/app/layout.tsx`
- `card-upload-nextjs/src/app/globals.css`
- `card-upload-nextjs/src/app/page.tsx`
- `card-upload-nextjs/src/components/upload-shell.tsx`
- `card-upload-nextjs/src/components/upload-shell.module.css`

### 8. Expand Fixture and Statement Coverage
Goal:
- Improve confidence beyond the current known-good fixture.

Why it matters:
- The app currently proves parity mainly against one supported statement fixture.

Planned changes:
- Add more real statement fixtures if available.
- Extend parser and browser tests across additional examples.
- Document any statement variants that remain unsupported.

Likely files:
- `statements/`
- `card-upload-nextjs/src/lib/statement/parser.test.ts`
- `card-upload-nextjs/tests/e2e/home.spec.ts`

## Suggested Implementation Order
1. Mobile-first workflow layout
2. Replace wide tables on mobile
3. Better card switching for touch devices
4. Stronger status and error presentation
5. Sticky primary actions on mobile
6. Collapse secondary sections by default
7. Switchable light/dark mode
8. Expand fixture and statement coverage

## First Recommended Batch
If starting with the highest-value UX work, bundle these together first:
- mobile-first workflow layout
- mobile replacements for wide tables
- better card switching for touch devices

This batch should produce the biggest practical improvement for phone users without changing parser behavior.
