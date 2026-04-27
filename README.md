# Card Uploader

Browser-based Macquarie credit card statement parser and CSV exporter built with Next.js.

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

## Supported Workflow

- Upload a supported Macquarie Bank credit card statement PDF
- Extract PDF text fully in the browser
- Parse statement metadata and per-card transactions
- Review reconciliation totals
- Export combined or per-card CSV files

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
