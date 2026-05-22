# Repository Guidelines

## Application Purpose

This app is Pampi Card, a browser-based Macquarie credit card statement parser and CSV exporter. Users upload a supported credit card statement PDF, and the app extracts text locally in the browser with PDF.js via a Web Worker. It parses statement metadata, card endings, transactions, credits, payments, and summary totals, then shows per-card spending, reconciliation details, warnings for incomplete parses, and download links for combined or per-card CSV exports. The privacy expectation is that statement processing stays client-side and uploaded data does not leave the user's computer.

## Project Structure & Module Organization

This is a single Next.js app at the repository root. Application routes and global styles live in `src/app/`; reusable UI is in `src/components/`; domain logic is under `src/lib/`; browser worker code is in `src/workers/`. Static public assets live in `public/`, app icons in `src/icons/`, and fixture statement PDFs in `statements/`. Unit and component tests are colocated as `*.test.ts` or `*.test.tsx` under `src/`; Playwright end-to-end tests live in `tests/e2e/`.

## Build, Test, and Development Commands

- `npm install`: install dependencies from `package-lock.json`.
- `npm run dev`: start the local Next.js dev server.
- `npm run build`: create a production build.
- `npm start`: serve the production build after `npm run build`.
- `npm run lint`: run ESLint over the repo.
- `npm test`: run Vitest unit and component tests once.
- `npm run test:watch`: run Vitest in watch mode.
- `npm run test:e2e`: run Playwright tests; the config starts Next.js on `127.0.0.1:3000`.

Use Node.js 22 as indicated by `.nvmrc` and `package.json`.

## Coding Style & Naming Conventions

Write TypeScript with `strict` mode in mind. Use the `@/` alias for imports from `src` when it improves readability. Follow the existing style: double quotes, semicolons, functional React components, CSS Modules named like `component-name.module.css`, and kebab-case filenames for components and route-local styles. Keep parsing and extraction logic in `src/lib/` isolated from UI components.

## Testing Guidelines

Vitest uses `jsdom`, Testing Library, global test APIs, and `vitest.setup.ts`. Add focused tests next to changed source files using `*.test.ts` or `*.test.tsx`. Use fixture PDFs from `statements/` rather than adding ad hoc external dependencies. For user-visible upload or export flows, add or update Playwright coverage in `tests/e2e/`.

## Commit & Pull Request Guidelines

Recent history uses short imperative or past-tense summaries, for example `Reimplemented app icons` and `Completed milestone 5`. Keep commits concise and scoped to one change. Pull requests should include a short description, verification commands run, linked issue or milestone when applicable, and screenshots or screen recordings for visible UI changes.

## Agent-Specific Instructions

This project uses Next.js `16.2.6`, which may differ from familiar Next.js behavior. Before changing Next.js APIs, routing, config, or file conventions, read the relevant guide in `node_modules/next/dist/docs/` and follow any deprecation notices.

## AGENTS.md Updates

If there are changes found that is not covered in the project that is not covered in this markdown file. Ask permission to update this file and layout what will be changed.
