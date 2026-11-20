# LIRC System - Agent Entry Point

This is the first file to read for every coding task. It is intentionally short. It points to the project's persistent memory so a new session does not rediscover the whole application.

## Mandatory start

1. Read this file.
2. Open `docs/PROJECT_MAP.md`, find the request in **Request router**, and read only that feature row plus its entry files.
3. Read the newest entries in `docs/CHANGE_LOG.md` before changing a feature that was recently touched.
4. Follow `docs/AGENT_WORKFLOW.md` for the task lane and verification level.
5. Run `git status -sb` and inspect the current diff before editing.

Do not list or read the whole repository for a feature that is already mapped. A full-project scan is only for a missing feature, a large refactor, a stale map, or an explicit request.

## Persistent memory files

| File | Purpose |
| --- | --- |
| `AGENTS.md` | Mandatory entrypoint and hard rules. |
| `docs/PROJECT_MAP.md` | Routes, feature-to-file router, data sources, RPCs, tests and known traps. |
| `docs/AGENT_WORKFLOW.md` | How to investigate, change, verify and update the map efficiently. |
| `docs/CHANGE_LOG.md` | Short journal of every change and whether the map changed. |
| `docs/DATABASE_SETUP_STATUS.md` | Applied database changes and feature-specific data notes. |
| `docs/FOLDER_STRUCTURE.md` | Directory layout reference; the feature router is in `PROJECT_MAP.md`. |

## Non-negotiable rules

- The source code and live database contracts are the truth. The map is an index, not a substitute for reading the files being edited.
- Keep the page -> component -> hook -> service boundary. Do not put Supabase calls in presentational components.
- Frontend role checks are only UI routing. Every protected read/write must still be guarded by Supabase grants, RLS or a security-definer RPC.
- Never put a service-role key or other secret in a `VITE_` variable. Keep secrets in Supabase Edge Function secrets.
- Shared request promises must not be tied to one component's `AbortSignal`. Abort errors must stay recognizable as aborts.
- Add database changes as a new timestamped file in `supabase/migrations/`. Do not edit a migration that is already applied.
- Business rules mirrored in the browser must also stay enforced in the database, especially borrowing, validation, fines, reservations and role checks.
- Use the existing export jobs and generators for long downloads. Do not move a long export into a page component.
- Do not commit, push, deploy, apply a production migration or deploy an Edge Function unless the user explicitly asks.
- Do not revert or overwrite unrelated user changes.
- Every change gets an entry in `docs/CHANGE_LOG.md`. Update `docs/PROJECT_MAP.md` only when the structural map changes.

## Verification baseline

| Change type | Minimum verification |
| --- | --- |
| Documentation only | `node scripts/check-agent-docs.mjs`, then check links and wording; no build required. |
| Copy/style or small UI change | `npm run lint`, `npm run build`, then check the route. |
| Pure rules or service behavior | `npm test`, `npm run lint`, `npm run build`. |
| Database/RPC or migration | Add the migration, verify the function/table contract, run browser tests, and record the applied migration in `docs/DATABASE_SETUP_STATUS.md`. |
| Export/download | Verify the generated file shape and run the relevant tests, lint and build. |
| Deployment | Build first, then deploy only the host/function the user named, and verify the live asset or endpoint. |

Current commands:

```powershell
npm run dev
npm run lint
npm test
npm run build
node scripts/check-agent-docs.mjs
```

## End-of-task handoff

Report what changed, the important files, data or migration impact, verification results, and whether anything was deployed. Update the change log before reporting completion.
