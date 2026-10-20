# Publishing the LIRC Library System

**The live sites:**

- **https://ccc-lirc.netlify.app** — Netlify (site name `ccc-lirc`, site ID
  `4c9e825c-d3ca-40d1-a171-cffe93bd267f`). The site stays online, but
  production deploys pause while the team's free deploy credits are exhausted.
- **https://ccc-lirc.vercel.app** — Vercel (the backup host; deploy with
  `scripts/deploy-vercel.mjs`, see section 3).

Three ways to put the system online or on a computer, plus a **backup host**
(Vercel) for when Netlify's free deploy credits run out. The recommended setup
uses GitHub + Netlify (automatic publishing) — Docker is for running it on a
computer of your own (or any device with Docker).

---

## 1. GitHub + Netlify (the automatic way)

**How it works:** every push to `main` on GitHub is verified (lint, tests,
build), and when it passes, the site is published to Netlify automatically.
Nobody has to build or upload anything by hand.

### One-time setup

1. **Netlify** — open https://app.netlify.com and sign in.
2. Create a **personal access token** (if the old one expired):
   *User settings → Applications → Personal access tokens → New access token.*
   Copy the token (it is shown only once).
3. **GitHub** — open the repository → *Settings → Secrets and variables →
   Actions → New repository secret*. Add two secrets:
   * `NETLIFY_AUTH_TOKEN` — a Netlify personal access token.
   * `NETLIFY_SITE_ID` — `4c9e825c-d3ca-40d1-a171-cffe93bd267f`.
4. Done. From now on, every push to `main` publishes the site by itself.
   The progress is visible under the repository's **Actions** tab.

If the token ever expires: the site keeps running; only the automatic publish
stops. Create a new token and update the `NETLIFY_AUTH_TOKEN` secret — done.

### Publishing by hand (once)

```
set NETLIFY_AUTH_TOKEN=...        (PowerShell: $env:NETLIFY_AUTH_TOKEN="...")
set NETLIFY_SITE_ID=...
npm run build
node scripts/deploy-netlify.mjs
```

The script prints the live address when it finishes.

---

## 2. Netlify's own Git connection (the alternative)

If you prefer Netlify to build the site itself:

1. Netlify → *Add new site → Import an existing project* → pick the GitHub
   repository.
2. Netlify reads `netlify.toml` (already in the project): it builds with
   `npm run build` and publishes the `dist` folder, and the single-page-app
   redirect is already configured.
3. Every push to `main` then deploys automatically from Netlify's side.

---

## 3. Vercel (backup host — deploy without the CLI)

**The system is live there: https://ccc-lirc.vercel.app** (project `ccc-lirc`).

Netlify pauses production deploys when the team's free credits run out (the
published site stays online). Meanwhile, the same build can be published to
**Vercel** with one command — no Vercel CLI and no npm install are needed
because `scripts/deploy-vercel.mjs` talks to Vercel's API directly.

1. Create a free account at https://vercel.com (signing in with GitHub is
   easiest).
2. **Account Settings → Tokens → Create** — name it (for example
   `LIRC deploy`), pick an expiry, and copy the token (shown only once).
3. Publish:

```
set VERCEL_TOKEN=...        (PowerShell: $env:VERCEL_TOKEN="...")
npm run build
node scripts/deploy-vercel.mjs
```

The first run creates the project (`ccc-lirc` by default) and prints the live
address — normally **https://ccc-lirc.vercel.app**. Later runs replace the
production deployment within about a minute. `vercel.json` already carries the
single-page-app rewrite, the 1-year cache for hashed assets, and the security
headers.

Optional: `node scripts/deploy-vercel.mjs --dry-run` lists the files without
uploading anything, and `$env:VERCEL_PROJECT_NAME="other-name"` deploys under a
different project name.

**After switching hosts**, update the password-reset links: the Supabase edge
function secret `SITE_URL` (CLI: `supabase secrets set SITE_URL=https://...`)
and the Supabase dashboard → *Authentication → URL Configuration* (Site URL and
Redirect URLs) should point to the new address.

---

## 4. Docker (run it on any computer)

Needs Docker installed (Docker Desktop on Windows/Mac, docker on Linux).
No other setup — the build values are in `.env.production`.

```
docker compose up --build
```

Then open **http://localhost:8080**.

Or with plain Docker:

```
docker build -t lirc-library-system .
docker run -p 8080:80 lirc-library-system
```

The container serves the built site; the database stays in the cloud, so the
container works on any device with internet access.

---

## What lives where

| Thing | Where |
| --- | --- |
| The website's code | GitHub repository (`icodexies/LircFullSystem`) |
| Automatic checks | GitHub → Actions tab (lint, tests, build) |
| The published site | Netlify (address shown after the first deploy) |
| The backup site | Vercel — https://ccc-lirc.vercel.app (`scripts/deploy-vercel.mjs`, section 3) |
| The database | Supabase (cloud) — nothing to publish |
| The container | `Dockerfile` + `docker-compose.yml` in the project |
