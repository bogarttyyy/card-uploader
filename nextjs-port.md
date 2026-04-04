# Next.js Browser-Only Migration Plan

## Summary
Recommend migrating to **Next.js**, not React Native, because the current product is fundamentally a file-upload/export workflow and does not depend on mobile-native capabilities.

Given the chosen constraints, the target architecture should be:

- **New project folder: `card-upload-nextjs/`**
- **Next.js App Router**
- **TypeScript rewrite of the parser**
- **Browser-only PDF processing**
- **Exact behavioral parity with the current Python app before UX expansion**

This keeps the user experience local/private while avoiding a split stack, but it does make parser fidelity the main technical risk. The migration should therefore be done in phases with parity gates, not as a single rewrite. The existing Python project should remain intact during the port; all Next.js scaffolding, code, tests, and assets should live under `card-upload-nextjs/` until the new app is proven ready.

## Key Changes

### 1. Re-architecture around a shared TypeScript domain core
Create a pure TS core that mirrors the current Python contracts and stays framework-agnostic:

- `StatementMetadata`
- `Transaction`
- `CardSummary`
- `ReconciliationRow`
- parser helpers for metadata extraction, transaction parsing, date normalization, card summaries, reconciliation, and CSV row generation

Rules to preserve exactly from Python:

- card detection and primary card ordering
- statement-period extraction and due-date formatting
- transaction-line regex behavior
- BPAY exclusion logic
- credit handling as negative export values
- per-card totals and reconciliation deltas
- year-boundary date normalization

This core should contain no React or Next.js code so it remains testable and reusable.

### 2. Use a client-side PDF parsing worker
Because processing must stay in the browser, do not parse PDFs in React components directly.

Implementation choice:

- use **`pdfjs-dist`** in a **Web Worker**
- extract page text page-by-page
- pass normalized text into the shared parser core
- return parsed metadata, transactions, summaries, reconciliation rows, and CSV payload inputs

Why this shape:

- keeps large PDFs from freezing the UI
- avoids server upload/storage entirely
- gives the closest analogue to the current `pdfplumber -> text -> regex parser` flow

Do not plan on React Native-style abstractions or server actions for parsing in v1.

### 3. Rebuild the Streamlit UX as a single-page web workflow
Recreate the current behavior first, then improve styling after parity is proven.

Primary screens/states:

1. empty state with PDF upload
2. parsing/loading state
3. parsed statement summary
4. combined CSV download
5. per-card summary table
6. reconciliation table with mismatch warning
7. card selector and transactions table
8. excluded-transactions audit section
9. recoverable error state for unsupported or malformed PDFs

UI defaults:

- App Router page with client components for interactive state
- local state only; no database, auth, or persistent storage
- CSV downloads via `Blob` + object URL
- mobile-responsive layout, but still optimized for desktop upload/review
- all new app code lives under `card-upload-nextjs/` so the legacy Python app remains runnable during migration

### 4. Port the test suite before feature polishing
Treat the Python tests as the migration spec.

Plan:

- port unit tests for metadata extraction, transaction parsing, date normalization, reconciliation, and export rows
- port fixture-based tests against the sample PDFs in `statements/`
- add browser-worker integration tests that verify worker extraction + parser output together
- add UI smoke tests for upload, card switching, warnings, and CSV download availability

Acceptance gate for parser parity:

- same detected card numbers
- same due date / closing balance / computed balance
- same per-card totals
- same excluded BPAY behavior
- same exported dates and signed amounts
- reconciliation deltas all zero for the known-good fixtures

Do not redesign copy, layout, or state flow beyond what is needed until these tests pass.

## Public Interfaces / Contracts
Define these stable interfaces up front in TypeScript:

- `parseStatementFromPdf(file: File): Promise<{ metadata; transactions; cardSummary; reconciliationRows }>`
- `transactionsToExportRows(transactions, metadata): ExportRow[]`
- `buildCsvData(rows): string`

Worker boundary:

- input: `File`
- output: structured parsed result or typed parse error

Typed errors to support in UI:

- unsupported PDF/text extraction failure
- no primary card found
- no card numbers found
- no valid transactions found
- reconciliation mismatch warning state

## Delivery Sequence
1. Create a new sibling project folder named `card-upload-nextjs/` inside the current repository and keep all migration work scoped there.
2. Stand up Next.js + TypeScript app shell and basic upload page inside `card-upload-nextjs/`.
3. Port Python domain models and parser rules into pure TS modules.
4. Implement `pdfjs-dist` text extraction in a worker.
5. Port the Python test suite and fixture expectations.
6. Reach exact parser parity on the sample statements.
7. Rebuild the Streamlit UI flow in React.
8. Add worker/UI integration tests and polish loading/error states.
9. Optional follow-up: visual refresh, drag-and-drop, saved recent files, PWA behavior.

## Test Plan
Must pass before calling the migration complete:

- fixture PDFs parse with the same metadata and totals as Python
- credits export as negative numbers
- BPAY rows are excluded from exported transaction sets
- combined CSV contains both cards where expected
- year-boundary dates normalize to the same ISO dates
- reconciliation section matches current logic and flags mismatches correctly
- large-file parsing does not block the main thread
- upload/download flow works in current desktop Chromium and Safari-class browsers

## Assumptions
- Exact parity with the current Python behavior is more important than changing parsing semantics.
- Browser-only privacy is a hard requirement for v1.
- No auth, backend storage, or multi-user features are needed.
- Supported PDFs are text-extractable statements similar to the current Macquarie Bank samples; OCR/scanned-PDF support is out of scope.
- The migration should be developed as a separate Next.js project in `card-upload-nextjs/`, without modifying the old Python app beyond reading it as the source of truth.
- The current Python test suite could not be executed fully in this environment because `pandas` is not installed, so the migration should treat the existing tests and fixtures as the baseline source of truth and verify them in a prepared dev environment.
