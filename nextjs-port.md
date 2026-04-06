# Milestone-Based Next.js Port Plan

## Summary
Port the app as a **new, separate project in `card-upload-nextjs/`** and keep the Python app unchanged while the migration is in progress.

Target stack and constraints are fixed:

- Next.js App Router
- TypeScript rewrite of the parser
- Browser-only PDF processing
- Exact functional parity before UX expansion
- Every milestone must produce a runnable app state and include tests appropriate to that stage

The key delivery rule is: **no milestone should leave the new project in a half-integrated state**. Each milestone ends with a working app, a defined acceptance bar, and tests that protect the behavior introduced so far.

Documentation rule:
- Whenever a milestone is completed, update this file in the same session before stopping work.
- Record:
  - milestone status
  - date completed
  - what was shipped
  - verification commands that were run
  - any important implementation notes or deviations from the original plan
  - the exact next recommended starting point for the following session
- Treat this document as the handoff log for continuing the port across sessions.

Approval rule:
- Before beginning any new milestone, first present the planned milestone scope to the user.
- That pre-work summary must state:
  - which milestone is about to start
  - what will be implemented
  - what tests/verification will be run
  - any expected risks, dependencies, or open decisions
- Do not start implementation work for that milestone until the user explicitly agrees to proceed.

## Current Status

Last updated: 6 April 2026

Completed:
- Milestone 1 is complete.
- Milestone 2 is complete.
- Milestone 3 is complete.
- Milestone 4 is complete.
- Milestone 5 is complete.
- Milestone 6 is complete.
- A standalone Next.js app now exists in `card-upload-nextjs/`.
- The app includes a baseline upload shell with:
  - app title
  - PDF upload control
  - empty results state
  - parser-dependent result sections still hidden/pending
- Framework-agnostic TypeScript business logic now exists for:
  - domain types
  - amount parsing
  - statement date formatting
  - statement period date parsing
  - per-card filtering
  - card totals
  - card summaries
  - reconciliation rows
  - year-boundary date normalization
  - export row generation
  - CSV string generation
- Browser-side PDF text extraction now exists with:
  - `pdfjs-dist`
  - a dedicated extraction worker
  - typed extraction result/error contracts
  - upload UI loading, success, and failure states
  - browser verification against a real fixture PDF
- TypeScript parser parity now exists for the known fixture path with:
  - metadata extraction
  - transaction-page parsing on normalized browser-extracted text
  - primary-card detection
  - card-level totals
  - reconciliation parity for the known-good sample PDF
  - parsed statement summary rendered in the browser UI
- Functional UI parity now exists for the main workflow with:
  - statement summary
  - reconciliation table
  - combined CSV download
  - per-card summary table
  - per-card CSV downloads
  - card selector
  - transactions table
  - excluded-transactions audit section
- Test/tooling baseline is installed and passing:
  - ESLint
  - Vitest
  - React Testing Library
  - Playwright
- Local verification completed successfully with:
  - `npm run lint`
  - `npm test`
  - `npm run build`
  - `npm run test:e2e`
- Milestone 2 verification completed successfully with:
  - `npm run lint`
  - `npm test`
  - `npm run build`
- Milestone 3 verification completed successfully with:
  - `npm run lint`
  - `npm test`
  - `npm run build`
  - `npm run test:e2e`
- Milestone 4 verification completed successfully with:
  - `npm run lint`
  - `npm test`
  - `npm run build`
  - `npm run test:e2e`
- Milestone 5 verification completed successfully with:
  - `npm run lint`
  - `npm test`
  - `npm run build`
  - `npm run test:e2e`
- Milestone 6 verification completed successfully with:
  - `npm run lint`
  - `npm test`
  - `npm run build`
  - `npm run test:e2e`

Implemented files of note:
- `card-upload-nextjs/src/app/page.tsx`
- `card-upload-nextjs/src/components/upload-shell.tsx`
- `card-upload-nextjs/src/components/upload-shell.test.tsx`
- `card-upload-nextjs/src/components/upload-shell.module.css`
- `card-upload-nextjs/src/lib/files.ts`
- `card-upload-nextjs/src/lib/pdf-extraction/core.ts`
- `card-upload-nextjs/src/lib/pdf-extraction/types.ts`
- `card-upload-nextjs/src/lib/pdf-extraction/index.ts`
- `card-upload-nextjs/src/lib/pdf-extraction/index.test.ts`
- `card-upload-nextjs/src/lib/statement/types.ts`
- `card-upload-nextjs/src/lib/statement/core.ts`
- `card-upload-nextjs/src/lib/statement/index.ts`
- `card-upload-nextjs/src/lib/statement/core.test.ts`
- `card-upload-nextjs/src/lib/statement/parser.ts`
- `card-upload-nextjs/src/lib/statement/parser.test.ts`
- `card-upload-nextjs/src/workers/pdf-text.worker.ts`
- `card-upload-nextjs/src/app/page.test.tsx`
- `card-upload-nextjs/src/lib/files.test.ts`
- `card-upload-nextjs/tests/e2e/home.spec.ts`
- `card-upload-nextjs/vitest.config.ts`
- `card-upload-nextjs/playwright.config.ts`

Notes:
- `next/font/google` was removed from the new app because sandbox/network-restricted builds could not fetch Google-hosted font assets reliably.
- `allowedDevOrigins: ["127.0.0.1"]` was added to `card-upload-nextjs/next.config.ts` so Playwright can run cleanly against the dev server.
- The root Python Streamlit app remains untouched and is still the source-of-truth implementation.
- Milestone 2 intentionally stops short of regex-based metadata extraction and transaction-line parsing; those remain Milestone 4 work.
- CSV generation in the Next.js project currently operates on exported row objects and returns a CSV string, matching the contract planned for the port.
- Milestone 3 uses a dedicated Web Worker plus `pdfjs-dist` for browser-only extraction.
- `pdfjs-dist` required `GlobalWorkerOptions.workerSrc` to be set explicitly inside the extraction worker for real browser runs.
- Milestone 4 required a normalization step that reorders `pdfjs-dist` text items left-to-right within each visual line before parsing.
- The parser now supports both the original single-line Python-style transaction rows and the multi-line row format produced by browser extraction for the known fixture.
- Current parity is proven against the known March 2026 sample PDF already in `statements/`; broader fixture coverage can be expanded later if more statement PDFs are added to the repo.
- Milestone 5 keeps all workflow state in the browser and uses data-URI download links for combined and per-card CSV exports.
- The current Next.js UI now covers the main Streamlit-equivalent happy path for the known supported fixture PDF.
- Milestone 6 replaces the raw text debug panel with a user-facing processing summary and explicitly blocks export controls when required statement details are missing.
- The upload flow now distinguishes extraction failures from parse failures and surfaces incomplete-statement issues directly in the UI.
- Page and workflow copy now describe the browser app as the current workflow rather than a milestone/debug shell.

Resume from here:
- Milestone plan is complete.
- Next recommended work is optional follow-up:
  - add more real statement fixtures to broaden parser/browser confidence
  - decide whether the Next.js app should replace the Streamlit app operationally
  - handle any post-parity deployment or packaging work separately

## Implementation Plan

### Milestone 1: Project Skeleton and Baseline UI Shell
Goal: create a standalone Next.js app in `card-upload-nextjs/` that can run independently and establishes the test/tooling foundation.

Status: Complete on 6 April 2026

Deliverables:
- Initialize Next.js + TypeScript project in `card-upload-nextjs/`
- Add linting, formatting, test runner, and Playwright or equivalent browser test setup
- Create a basic home page with:
  - app title
  - PDF upload control
  - placeholder empty state
  - placeholder results sections hidden until data exists
- Copy or reference non-code assets needed for branding only if required by the new UI
- Add a clear README in the new project with local run/test commands

Runnable state:
- `npm run dev` starts the Next.js app
- Upload UI renders, but parsing can still be mocked or unimplemented
- No dependency on the old Streamlit app at runtime

Tests:
- unit test for basic utility/helpers used by the page shell
- component test or RTL test for initial page render and empty state
- browser smoke test that loads the page and verifies the upload input is present
- CI/test command wired and passing inside `card-upload-nextjs/`

Acceptance:
- new app runs on its own
- old Python app remains untouched and still runnable separately
- test harness is established before parser work begins

### Milestone 2: Domain Model and CSV Logic Port
Goal: port the pure business logic that does not depend on PDF extraction yet.

Status: Complete on 6 April 2026

Deliverables:
- Implement TS domain types:
  - `StatementMetadata`
  - `Transaction`
  - `CardSummary`
  - `ReconciliationRow`
  - export row type
- Port pure logic from Python:
  - amount parsing
  - statement date formatting
  - statement period date parsing
  - card summary builders
  - reconciliation builders
  - transaction filtering by card
  - card totals
  - transaction export row generation
  - year-boundary date normalization
  - CSV generation
- Keep this logic framework-agnostic in a shared library folder inside `card-upload-nextjs/`

Runnable state:
- app still runs with placeholder UI
- page can optionally render mocked parsed data using the real TS business logic
- CSV generation works from mocked transactions

Tests:
- direct ports of Python unit tests for:
  - metadata/date helpers
  - year-boundary normalization
  - reconciliation on synthetic transactions
  - empty export rows
- CSV tests covering:
  - credits become negative values
  - BPAY-excluded input does not appear when excluded transactions are omitted upstream
  - multi-card exports preserve card numbers
- snapshot-free tests preferred; assert exact values

Acceptance:
- all pure business logic is verified before PDF parsing starts
- TS logic matches Python behavior for non-PDF-dependent functions

### Milestone 3: Raw PDF Text Extraction in the Browser Worker
Goal: get reliable page-text extraction from PDFs in a worker without yet claiming full parser parity.

Status: Complete on 6 April 2026

Deliverables:
- Add `pdfjs-dist` browser-side extraction
- Implement a Web Worker that:
  - accepts a `File`
  - extracts page text page-by-page
  - returns normalized page text and concatenated full text
  - emits structured extraction errors
- Define worker result and error contracts
- Connect the upload page to the worker and show extraction/loading/error states

Runnable state:
- user can upload a real PDF
- app can display extraction success/failure and optionally a debug summary such as page count or extracted text stats
- no full parsing UI required yet, but the upload flow is real

Tests:
- worker unit tests for result/error normalization
- integration tests for file upload invoking the worker successfully
- browser test covering:
  - upload starts loading state
  - valid fixture PDF reaches extraction-complete state
  - invalid/non-PDF file shows a user-facing error
- if direct worker testing is awkward, isolate the extraction adapter behind testable functions and keep the worker thin

Acceptance:
- PDF extraction is real and stable in-browser
- main thread remains responsive during extraction
- extraction errors are typed and surfaced to the UI

### Milestone 4: Parser Rule Port and Fixture Parity
Goal: port the Python parsing rules on top of extracted text and reach parity on known statement fixtures.

Status: Complete on 6 April 2026

Deliverables:
- Port regex-based metadata extraction
- Port transaction page parsing rules, including:
  - header detection
  - primary card fallback
  - stop-line behavior
  - skipped line behavior
  - credit detection
  - BPAY payment detection
- Implement `parseStatementFromPdf(file)` on top of worker extraction + TS parser core
- Add fixture support in the new project for known-good statement PDFs used only by tests

Runnable state:
- uploading a supported statement produces parsed metadata and transactions
- app can render a simple debug result view with totals and card numbers even if final UI is not complete
- core parsing flow works end-to-end in the new app

Tests:
- direct ports of Python parser tests for:
  - metadata extraction from sample text
  - transaction parsing with skipped reference/foreign currency lines
  - fixture PDFs matching expected due dates, balances, card numbers, computed balances, and per-card totals
  - reconciliation deltas equal zero for known-good fixtures
- add an end-to-end integration test that uploads a fixture PDF and asserts visible parsed summary values

Acceptance:
- known sample PDFs match Python outputs exactly on the locked parity fields
- parser parity is proven before UI refinement

### Milestone 5: Functional UI Parity with Streamlit
Goal: reproduce the current Streamlit workflow in the Next.js UI using the now-working parser.

Status: Complete on 6 April 2026

Deliverables:
- Implement the full user-facing flow:
  - upload PDF
  - statement summary
  - closing balance and due date
  - reconciliation warning if mismatched
  - combined CSV download
  - per-card summary table
  - card selector
  - transactions table
  - excluded-transactions audit section
- Preserve current behavior and wording closely unless change is needed for web UX clarity
- Keep state local in the browser; no backend or persistence

Runnable state:
- user can complete the full current workflow in Next.js from upload to CSV download
- app is functionally equivalent to the Streamlit version for supported PDFs

Tests:
- component tests for:
  - summary rendering
  - warning rendering
  - card switching
  - excluded transaction visibility
- browser tests for:
  - upload fixture PDF
  - see summary and reconciliation
  - switch cards and see correct totals
  - download combined CSV
  - verify per-card CSV links or downloads are present
- CSV output tests should assert exact rows for at least one known fixture

Acceptance:
- a user can replace the old app for the current supported use case
- all main user actions are covered by automated tests

### Milestone 6: Hardening, Error Handling, and Release Readiness
Goal: make the new app safe to rely on without changing scope.

Status: Complete on 6 April 2026

Deliverables:
- Improve user-facing errors for:
  - unsupported PDFs
  - missing primary card
  - no card numbers found
  - no valid transactions found
  - extraction failure
- Add loading/progress polish and responsive layout cleanup
- Remove any temporary debug views
- Finalize docs and migration notes describing the old app as source-of-truth reference during transition
- Replace the raw extraction preview with a user-facing processing summary showing extraction and parsing counts
- Block export controls and detailed transaction sections when parsed statement data is incomplete

Runnable state:
- app is production-shaped and can be evaluated as the successor to the Python version
- no debug-only UX remains
- supported fixture PDFs still complete the full workflow from upload through CSV export
- incomplete or unsupported statements now show actionable issues instead of exposing unsafe export actions

Tests:
- browser tests for failure paths and edge states
- regression suite over all known statement fixtures
- performance-oriented sanity test for larger PDFs if practical
- final smoke test covering first load, upload, parse, card switch, and CSV export in one flow
- component tests for parse failure messaging and incomplete-statement blocking behavior

Acceptance:
- success and failure paths are both covered
- final suite protects against regressions well enough to continue future enhancements safely

## Public Interfaces / Contracts
These interfaces should be defined early and kept stable across milestones:

- `parseStatementFromPdf(file: File): Promise<ParsedStatementResult>`
- `extractPdfText(file: File): Promise<{ pageTexts: string[]; fullText: string }>`
- `transactionsToExportRows(transactions, metadata): ExportRow[]`
- `buildCsvData(rows): string`

Core result shape should include:
- `metadata`
- `transactions`
- `cardSummary`
- `reconciliationRows`

Typed error classes or discriminated unions should cover:
- extraction failure
- unsupported file
- missing primary card
- missing card numbers
- parse failure with partial context where possible

## Test Plan
Each milestone must leave behind a passing test suite, not temporary manual validation.

Required layers across the project:
- unit tests for pure parser/business logic
- integration tests for worker + parser boundaries
- component tests for key rendered states
- browser tests for end-to-end user flows

Minimum parity scenarios to keep for the full suite:
- known fixture PDFs produce expected due date, closing balance, card numbers, computed balance, and per-card totals
- reconciliation deltas are zero for known-good statements
- credits export as negative numbers
- BPAY rows stay excluded from export flows
- combined CSV includes both cards where expected
- year-boundary transaction dates normalize correctly
- unsupported files and parse failures show useful errors

## Assumptions
- `card-upload-nextjs/` is the only location where new app code will be created during the port.
- The Python project remains unchanged and serves as the reference implementation during migration.
- Browser-only processing is a hard requirement, so no API upload/parsing path should be introduced in these milestones.
- Supported input remains text-extractable Macquarie credit card PDFs similar to the current fixtures; OCR/scanned statements are out of scope.
- “Proper tests” means milestone-appropriate automated tests are added before the next milestone begins, not deferred to the end.
