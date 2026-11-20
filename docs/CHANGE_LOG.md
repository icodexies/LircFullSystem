# Change Journal for Agents

This is the short external memory for recent changes. Add a new entry at the top for every task, including small fixes. Keep entries concise: no secrets, no full diffs.

The purpose is to let a new session answer "what changed here recently?" without rescanning the whole feature.

## Entry template

```markdown
## YYYY-MM-DD - Short title
- Area:
- Commit/state:
- Files:
- Behavior:
- Data/security:
- Verification:
- Map updated: yes/no
```

Use `Map updated: yes` only when a route, file location, data contract, role rule or flow changed.

## 2026-11-20 - Vercel deployment configuration and repository hygiene

- Area: deployment, repository setup and environment documentation.
- Commit/state: `725d0c3`; Vercel production `dpl_FF5isfz7PdKmNLV9apJrqpmaXfLF` is ready at https://ccc-lirc.vercel.app. Git auto-deploy is still blocked by the Vercel account's missing GitHub connection.
- Files: `README.md`, `.env.example`, `.vercelignore`, `docs/CHANGE_LOG.md`.
- Behavior: documents the required public Vite/Supabase build variables, Vercel build settings, GitHub deployment path and the files that must never be committed.
- Data/security: no secrets or uploads added. `.env`, `.env.local`, `.env.production`, `.vercel`, user uploads and generated `dist/` remain ignored. Vercel Supabase URL/public key variables were added directly to the Vercel project.
- Verification: `npm run lint`, `npm test` (134 passing), `npm run build`, Vercel environment pull value checks, and a live HTTPS response from the production alias passed.
- Map updated: no.

## 2026-11-19 - Add persistent project map and agent workflow

- Area: developer workflow and documentation.
- Commit/state: new files, not yet committed or deployed.
- Files: `AGENTS.md`, `docs/PROJECT_MAP.md`, `docs/AGENT_WORKFLOW.md`, `docs/CHANGE_LOG.md`, `scripts/check-agent-docs.mjs`; pointer updates in `README.md`, `docs/FOLDER_STRUCTURE.md`, `docs/PROJECT_GUIDE.md`.
- Behavior: future work starts from the map and workflow instead of a full-project scan. Every change is journaled; structural changes also update the map.
- Data/security: no runtime, database or deployment change.
- Verification: full project inventory scan; `node scripts/check-agent-docs.mjs` checks links, mapped paths and route coverage.
- Map updated: yes (initial map).

## 2026-11-17 - OPAC Word cards, reliability fixes and statistics summary

- Area: OPAC export, attendance export, Settings/fines, statistics, AI recommendations.
- Commit/state: `4945ae0`; Vercel production deployment `dpl_8fFosVwjrBQwwTvNUwQPu8gMpEYw` is live. The Supabase `subject-recommendations` Edge Function was **not** deployed.
- Files: `src/pages/PrivatePages/OPAC/OPAC.jsx`, `src/services/catalog/bookCardDocx.js`, `bookCardValidation.js`, `bookService.js`, `src/services/attendance/attendanceReportWorkbook.js`, `src/pages/PrivatePages/Settings/Settings.jsx`, `src/services/fines/finesService.js`, `supabase/functions/subject-recommendations/index.ts`, `supabase/migrations/20261117090000_statistics_overview_borrowers.sql`, `tests/catalog/bookCardValidation.test.js`.
- Behavior: filtered OPAC books download as A4 Word catalog cards; incomplete records show a review modal with View/Continue/Cancel; attendance Unique visitors rows are highlighted; the borrower statistics card reads its restored overview summary; the settings/fines abort race and OPAC lookup retry were fixed; AI uses the faster catalog-only default and a catalog fallback.
- Data/security: restored the `borrowers` summary to `lirc_statistics_overview`; the migration was applied and recorded in production. No secrets added.
- Verification: lint, 134 tests and production build passed; live Vercel asset served the new OPAC bundle.
- Map updated: yes (initial map created from this baseline).
