# Publishing the LIRC Library System

Three ways to put the system online or on a computer. The recommended setup
uses GitHub + Netlify (automatic publishing) — Docker is for running it on a
computer of your own (or any device with Docker).

---

## 1. GitHub + Netlify (the automatic way)

**How it works:** every push to `main` on GitHub is verified (lint, tests,
build), and when it passes, the site is published to Netlify automatically.
Nobody has to build or upload anything by hand.

### One-time setup

1. **Netlify** — open https://app.netlify.com and sign in.
2. Create a **personal access token**:
   *User settings → Applications → Personal access tokens → New access token.*
   Copy the token (it is shown only once).
3. **GitHub** — open the repository → *Settings → Secrets and variables →
   Actions → New repository secret*. Add two secrets:
   * `NETLIFY_AUTH_TOKEN` — the token from step 2.
   * `NETLIFY_SITE_ID` — the site's ID (Netlify: *Site configuration →
     Site information → Site ID*).
4. Done. From now on, every push to `main` publishes the site by itself.
   The progress is visible under the repository's **Actions** tab.

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

## 3. Docker (run it on any computer)

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
| The database | Supabase (cloud) — nothing to publish |
| The container | `Dockerfile` + `docker-compose.yml` in the project |
