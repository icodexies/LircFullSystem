# Agent Workflow - Efficient Changes Without Missed Dependencies

This workflow exists because the assistant has a finite context window and no permanent memory of the codebase. The Markdown files are the external memory. Use them before reading code and update them after the work.

The goal is:

- understand the existing feature before changing it;
- read only the files needed for that feature;
- avoid discovering the same page, service and RPC again;
- still catch the related role, database and export code;
- leave the next session with a better map than this session had.

## 1. Recover context first

At the start of every task:

1. Read `AGENTS.md`.
2. Read the matching row in `docs/PROJECT_MAP.md` -> **Request router**.
3. Read the newest entries in `docs/CHANGE_LOG.md`.
4. Check `git status -sb` and the relevant diff.
5. If the user asks about a recently changed area, use the latest change-log entry before opening unrelated files.

This should normally be 3-4 quick operations, not a repository-wide scan.

## 2. Classify the request

| Lane | Typical request | Start with | Usually verify with |
| --- | --- | --- | --- |
| Documentation | "explain", "make a guide" | relevant doc + source references | link/path check |
| UI-only | copy, spacing, color, responsive layout | route page and its component | lint + build + local route |
| Client behavior | filter, dialog, state, loading, error | page + hook + service | tests + lint + build |
| Data contract | new field, RPC argument, response shape | page + service + migration/RPC | tests + database verification + build |
| Access/security | roles, guards, RLS, staff-only action | route table + page + RPC/migration | access tests + database check |
| Export/download | Excel, Word, PDF, CSV | page action + export service + generator | sample file + tests + build |
| Backend function | Edge Function, AI, email, service-role task | function + client caller + env template | function deploy check + build |
| Deployment | "publish", "deploy", "migrate" | build output + deployment guide | committed hash + live verification |

Do not use a database migration for a purely visual change. Do not change a frontend role array without checking the RPC/RLS guard.

## 3. Read the minimum feature slice

Read in this order and stop when the behavior is clear:

1. **Route/page**: the screen that owns the request.
2. **Child component**: the component with the specific control or modal.
3. **State hook**: the hook that owns loading, filtering, pagination or editing state.
4. **Service function**: the exact function that calls Supabase or prepares the data.
5. **Database contract only if needed**: grep the RPC or table name in `supabase/migrations/`.
6. **One relevant test and one relevant doc**, if they exist.

For a known feature, a normal first pass should be roughly 4-8 targeted reads. If it grows past that, stop and check whether the request is cross-cutting (for example "rename every export" or "change every role") rather than continuing to open unrelated files.

Useful searches:

```powershell
# Find a feature's route/navigation metadata
Select-String -Path src\routes\memberPages.js -Pattern 'borrow|attendance|statistics'

# Find a service export and its callers
Get-ChildItem src\services -Recurse -Filter *.js | Select-String -Pattern 'export .*borrow'
Get-ChildItem src -Recurse -File -Include *.js,*.jsx | Select-String -Pattern 'borrowPreview'

# Find the database function, not every migration
Select-String -Path supabase\migrations\*.sql -Pattern 'function public\.lirc_borrow_book'

# Find the feature's tests
Get-ChildItem tests\borrow -File
```

Do not read all migrations. Do not list `node_modules`, `dist`, `.git` or `supabase/.temp`. Do not load generated `.docx` files as source.

## 4. Confirm the contract before editing

Before the first edit, be able to answer:

- Which route renders this feature and which roles reach it?
- Which component owns the visible control?
- Which hook owns the async state?
- Which service function is called, and what does it return?
- Is the data protected by an RPC, table policy or Edge Function?
- Does the change affect a shared cache, abort signal, background export job or notification?
- Which existing test covers the rule, or which test should be added?
- Is there an existing feature doc that will become wrong?

If the answer is unknown, read the next smallest file that answers it. Do not scan the whole project to answer a local question.

### Change-impact checklist

| If you change... | Also check... |
| --- | --- |
| exported function or component props | every call site |
| service return shape | every hook/component consuming it |
| role or route | `src/routes/roles.js`, `memberPages.js`, guards and the database RPC |
| borrowing/validation/fine rule | the mirrored database rule and tests |
| catalog query | pagination, export helper, loading/abort behavior and indexes |
| settings/fines | shared settings cache and every fine consumer |
| export generator | the job that calls it and the generated-file test |
| notification producer | notification feed RPC and the header bell |
| Edge Function | client service, `.env.example`, secret names and deploy target |

## 5. Make the smallest coherent change

- Follow the surrounding naming, file layout and error handling.
- Keep client-side rules and database rules in sync when both enforce the same business rule.
- Preserve existing `AbortError` handling and stale-response protection.
- Do not turn a shared request into an abortable one tied to a single page. This exact race previously caused the OPAC filter and Settings/fines failures.
- Keep long exports in their existing job modules, outside React component lifecycle.
- Do not add a new dependency if the repository already solves the problem.
- Do not edit an applied migration. Add a new timestamped migration.
- When a UI action is staff-only, verify the RPC guard rather than relying only on the hidden button.

## 6. Verify at the right level

### Documentation only

- `node scripts/check-agent-docs.mjs`
- Check file paths and links.
- Check that the map matches the current route/service names.
- No build is required.

### UI or copy

- `npm run lint`
- `npm run build`
- Open the local route and exercise the changed control.
- If the change touches an existing hook/service, run the related test file.

### Pure rules or service behavior

- `npm test` (the current suite is small and fast)
- `npm run lint`
- `npm run build`

### Database or RPC

- Add a new migration.
- Verify the function signature and permission/role guard.
- Run the relevant tests and the full browser-facing flow.
- Record the applied migration in `docs/DATABASE_SETUP_STATUS.md`.
- Do not run destructive statements against production data unless the user explicitly requests it.

### Export/download

- Verify the generated file is valid and has the expected sheets/cards/pages.
- Test the empty case and a multiple-page case where practical.
- Run the export tests, lint and build.
- Confirm navigation away does not cancel a background export job.

### Edge Function

- Check the client caller's timeout/fallback behavior.
- Check `.env.example` and secret names.
- Deploy only the named function when the user asks.
- Verify the function response, not only the frontend build.

### Deployment

- Build and record the commit hash.
- Deploy only the host the user named. Vercel and Netlify are separate from Supabase migrations and Edge Functions.
- Verify the live asset or endpoint after deployment.

## 7. Update the external memory

### Every change

Add an entry at the top of `docs/CHANGE_LOG.md`:

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

Keep it short. Do not paste full diffs or secrets.

### Structural changes

Update `docs/PROJECT_MAP.md` in the same task when any of these happen:

- a route, page, layout or feature folder is added, removed or renamed;
- a hook or service is moved, added or removed;
- an RPC, table, storage bucket or Edge Function is added or renamed;
- a role/access rule changes;
- the data flow changes (new cache, context provider, job, or export path).

Do not update the full map for a local copy change or a pure calculation inside an existing file. Record that the map is unchanged in the journal.

### Feature docs

Update the matching guide when the user-visible behavior or setup steps change:

- `docs/OPAC.md`
- `docs/BORROW.md`
- `docs/ATTENDANCE.md`
- `docs/INVENTORY.md`
- `docs/ADDING_BOOKS.md`
- `docs/MEMBERS.md`
- `docs/BARCODES.md`
- `docs/NOTIFICATIONS.md`
- `docs/REGISTRATION.md` / `docs/PASSWORD_RESET.md`
- `docs/PERSONNEL_DASHBOARD.md`
- `docs/FILTER_GUIDE.md`

If a doc is known to be older than the code, say so in the map rather than following it blindly. Source wins.

## 8. Avoid repeated discovery

Use these rules to keep consecutive requests efficient:

- If the feature is already mapped, do not list the whole `src` tree again.
- If you read a file in this session and it has not changed, reuse what you learned.
- If a request is on the same feature as the prior request, start from `docs/CHANGE_LOG.md` and the current diff, then re-read only files that changed.
- If a file was edited in this task, use the diff to confirm the change instead of reopening the entire file.
- Search for exact symbols, not broad words, once the feature is known.
- Do not open every service in a folder; open the one the page imports.
- Do not read all 128 migrations; grep the RPC prefix and read the matching function.
- Do not rerun a full build for a documentation-only change.
- Do not re-scan a feature to answer a question that the map and current diff already answer.

## 9. When a broader scan is justified

A full or near-full scan is allowed only when:

- the request names a new feature that has no map row;
- the map points to a missing file or an obsolete RPC;
- the change is cross-cutting (renaming a shared function across many features);
- a test/build failure cannot be traced through mapped files;
- an access/security issue suggests an unknown write path;
- the user explicitly asks for a full review.

When a broader scan happens, update the map and change log so the next session does not repeat it.

## 10. Example: "change the borrowing page"

1. Read the **Borrowing** row in `docs/PROJECT_MAP.md`.
2. Read `src/routes/memberPages.js` only if access may be involved.
3. Read `src/pages/PrivatePages/BookBorrow/BookBorrow.jsx`.
4. Read the component named by the request (`BorrowAction`, `ReturnAction`, `LoanRecordsPanel`, etc.).
5. Read `src/services/borrow/borrowService.js` for the exact RPC, and `reservationService.js` or `finesService.js` only if the request touches those flows.
6. If the RPC behavior changes, grep the RPC in `supabase/migrations/` and add a new migration.
7. Run the borrow tests, lint, build, and the local route.
8. Update `docs/CHANGE_LOG.md`; update `docs/PROJECT_MAP.md` only if the file/data flow changed.

For a second borrowing request later, start with the change log and the current files, and do not repeat steps 1-6 for unrelated pages.

## 11. Definition of done

A task is complete only when:

- the requested behavior is implemented;
- the map's stale-file check passes;
- relevant call sites and role guards were considered;
- the selected verification level passed;
- the change log is updated;
- any deployment or production database action is explicitly reported;
- the final response states what changed and what was not done.
