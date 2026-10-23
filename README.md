# LIRC System

The LIRC System is a React single-page application for the Learning and Information Resource Center at City College of Calamba. It uses Vite, React Router, Tailwind CSS, and Supabase Authentication and Edge Functions.

Read [the folder guide](docs/FOLDER_STRUCTURE.md) to find files by feature. Read [the project guide](docs/PROJECT_GUIDE.md) for the data format, folder responsibilities, animation behavior and Supabase setup still required before production.

## Requirements

- A security-patched Node.js line: **22.23.4+**, **24.22.1+**, or **26.12.1+** (Node 20 is end-of-life)
- A Supabase project
- Deno and the Supabase CLI to run or deploy Edge Functions

## Local development

1. Install dependencies with `npm install`.
2. Create a root `.env` file with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The existing `VITE_SUPABASE_KEY` name is also supported for an anon/public key. Never put a service-role or secret key in a `VITE_` variable.
3. Start the app with `npm run dev`.

The registration function also needs `GMAIL_USER`, `GMAIL_APP_PASSWORD`, and `SITE_URL` in the Supabase function environment. Use `supabase/functions/.env.example` as a template; never commit real credentials.

## Common commands

- `npm run dev` starts the development server.
- `npm run lint` checks the source files.
- `npm test` checks catalog queries, cover validation and role-based page permissions.
- `npm run build` creates the production build in `dist/`.
- `npm run preview` serves the production build locally.

## Project map

- `src/pages/` contains route-level screens. Route pages are loaded on demand from `src/App.jsx`.
- `src/components/` contains UI pieces grouped into `home`, `catalog`, `auth`, `layout` and shared `ui`.
- `src/layouts/` contains route layouts; layouts render nested pages through `Outlet`.
- `src/context/` contains authentication and login-modal state.
- `src/hooks/` groups behavior into `home`, `catalog`, `auth` and `shared`.
- `src/services/` groups authentication and catalog operations into `auth` and `catalog`.
- `src/lib/supabase/client.js` creates the shared Supabase client.
- `src/data/` contains content used by the public landing page.
- `public/images/` groups served images by feature; site icons and `robots.txt` remain at the public root.
- `supabase/functions/` contains server-side Supabase Edge Functions.

Each supporting folder is grouped by feature. Route screens stay in `src/pages/`; their smaller UI pieces live in `src/components/home/` or `src/components/catalog/`. Shared interface pieces live in `src/components/ui/`. See the folder guide for examples.

The public collections are sample data. The OPAC reads your Supabase catalog with server-side pagination, search and filters; its details window provides librarian/admin editing. See [the OPAC guide](docs/OPAC.md) for its required database migration and verification. See [member layout and page permissions](docs/MEMBER_LAYOUT.md) for the role rules and page folders. Registration and profile access require the `usersData` schema described in the guide. A passing build does not verify a live database or capacity for 20,000 users.

Production hosting must serve `dist/` and fall back to `index.html` for app routes. The local preview command is not a production server.

Academic periods, annual student validation and staff attendance are implemented. See [the attendance guide](docs/ATTENDANCE.md) for the supplied one-time scripts, additional reporting migration and scanner workflow.

The live Supabase setup was verified and completed on 9 October 2026. Read [database setup status](docs/DATABASE_SETUP_STATUS.md) before running any existing SQL script.

See [the plain-language filter guide](docs/FILTER_GUIDE.md) for every report filter and examples. See [shared action dialogs](docs/DIALOGS.md) for confirmations, success/error/info messages and save/discard choices. Enrolled year levels are now limited to 1–4; older invalid values require staff review instead of an automatic withdrawal or level change. See [JWT and API security](docs/API_SECURITY.md) for how login tokens protect every request, and [password reset](docs/PASSWORD_RESET.md) for the emailed "forgot password" flow. See [notifications](docs/NOTIFICATIONS.md) for the header bell and how future features add alerts. See [book borrowing](docs/BORROW.md) for accession-number loans, returns and the future fees plan. See [the Users page](docs/MEMBERS.md) for member records and admin-approved profile edits. See [adding books](docs/ADDING_BOOKS.md) for the create-book-and-copies workflow.
