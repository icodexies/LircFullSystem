# LIRC System

The LIRC System is a React single-page application for the Learning and Information Resource Center at City College of Calamba. It uses Vite, React Router, Tailwind CSS, and Supabase Authentication and Edge Functions.

Read [the project guide](docs/PROJECT_GUIDE.md) for the data format, folder responsibilities, animation behavior and Supabase setup still required before production.

## Requirements

- Node.js 20.19+ or 22.12+ compatible with Vite 8
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
- `npm run build` creates the production build in `dist/`.
- `npm run preview` serves the production build locally.

## Project map

- `src/pages/` contains route-level screens. Route pages are loaded on demand from `src/App.jsx`.
- `src/components/` contains shared interface components.
- `src/layouts/` contains route layouts; layouts render nested pages through `Outlet`.
- `src/context/` contains authentication and login-modal state.
- `src/hooks/` contains reusable stateful UI behavior.
- `src/services/` contains Supabase calls and session storage.
- `src/data/` contains content used by the public landing page.
- `public/` contains static images and icons served by URL.
- `supabase/functions/` contains server-side Supabase Edge Functions.

Keep secrets in environment configuration, keep page-specific UI near its page, and promote UI to `src/components/` when it is shared across screens.

The collections and member statistics are sample data. Registration and profile access require the `usersData` schema described in the guide. A passing build does not verify a live database or capacity for 20,000 users.

Production hosting must serve `dist/` and fall back to `index.html` for app routes. The local preview command is not a production server.
