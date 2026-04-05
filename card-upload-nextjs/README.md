# Card Upload Next.js

Standalone Next.js App Router port of the current Streamlit-based credit card statement uploader.

This project is intentionally being built in milestones. Milestone 1 establishes the independent
app shell and testing harness; PDF parsing parity is still pending.

## Requirements

- Node.js 25+
- npm 11+

## Commands

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev
```

Run unit and component tests:

```bash
npm test
```

Run browser smoke tests:

```bash
npm run test:e2e
```

Run linting:

```bash
npm run lint
```

## Current Scope

- Separate app in `card-upload-nextjs/`
- Next.js App Router with TypeScript
- Browser-only architecture planned for future parser milestones
- Current UI includes:
  - app title and explanatory copy
  - PDF file upload control
  - empty results state
  - no parser or CSV logic yet

## Milestone 1 Acceptance

- `npm run dev` starts a standalone app
- `npm test` covers utility and initial page render
- `npm run test:e2e` provides a browser smoke test for the upload page
- The Python Streamlit app remains untouched in the repo root
