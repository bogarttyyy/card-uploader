# Pampi Card

Browser-based Macquarie credit card statement parser and CSV exporter built with Next.js.

PDF contents remain in the browser. Failure reporting sends only an anonymous processing stage and
error code—never filenames, PDF text, statement data, timestamps, raw errors, or browser details.

The repo now contains a single app at the repository root. The old Streamlit/Python app has been removed.

## Requirements

- Node.js 22
- npm 10 or newer

Use `.nvmrc` if you manage Node with `nvm`:

```bash
nvm use
```

## Local Development

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev
```

Open `http://127.0.0.1:3000`.

## Verification

Run linting:

```bash
npm run lint
```

Run application and test type checks:

```bash
npm run typecheck
```

Run unit and component tests:

```bash
npm test
```

Run the production build:

```bash
npm run build
```

Run browser smoke tests:

```bash
npm run test:e2e
```

The Playwright suite covers Desktop Chrome, Desktop Safari, and iPhone 15/WebKit. To verify
production headers locally, build first and run with `PLAYWRIGHT_USE_PRODUCTION=1`.

Run the high-severity dependency gate:

```bash
npm audit --audit-level=high
```

## Supported Workflow

- Upload a supported Macquarie Bank credit card statement PDF
- Extract PDF text fully in the browser
- Parse statement metadata and per-card transactions
- Review reconciliation totals
- Export per-card CSV files or one Google Sheets-friendly combined CSV with cards arranged
  side by side
- Block exports until required metadata and reconciliation totals are complete and exact

Fixture PDFs used by tests live in `statements/`.

## Vercel Setup

This app should be deployed as a standard Next.js project. You do not need a custom Vercel server.

### Recommended setup

1. Push this repository to GitHub.
2. In Vercel, click `Add New...` -> `Project`.
3. Import the GitHub repository.
4. Keep these defaults:
   - Framework Preset: `Next.js`
   - Root Directory: `.`
   - Install Command: `npm install`
   - Build Command: `npm run build`
5. Set the production branch to your default branch.
6. Deploy.

Vercel will host the app on a default `*.vercel.app` domain and create preview deployments for pull requests.

### Post-deploy checks

After the first deployment, verify:

- the homepage loads without missing assets
- a statement PDF can be uploaded
- the combined CSV action appears after a successful parse
- the fixture-driven parser flow behaves the same as local

### CLI commands

If you want local Vercel linking as well:

```bash
npm install -g vercel
vercel login
vercel link
vercel env pull
vercel deploy
```
