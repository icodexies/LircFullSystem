// Deploys the built dist/ to Vercel through their REST API — no Vercel CLI and
// no npm install needed. Files are uploaded by SHA-1 digest (their File API),
// so the 100-file inline limit does not apply.
//
// Usage (PowerShell):
//   $env:VERCEL_TOKEN = "<your personal token>"
//   node scripts/deploy-vercel.mjs
// Optional:
//   $env:VERCEL_PROJECT_NAME = "ccc-lirc"   (default ccc-lirc)
//   node scripts/deploy-vercel.mjs --dry-run   (lists the files, uploads nothing)
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const token = process.env.VERCEL_TOKEN?.trim();
const project = (process.env.VERCEL_PROJECT_NAME ?? "ccc-lirc").trim();
const dryRun = process.argv.includes("--dry-run");
const root = "dist";

if (!existsSync(join(root, "index.html"))) {
  console.error("[vercel] dist/index.html is missing — run: npm run build");
  process.exit(1);
}

function filesUnder(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

const cleanPath = (file) => relative(root, file).split(sep).join("/");
const local = filesUnder(root);
const configFile = existsSync("vercel.json") ? "vercel.json" : null;
const total = local.reduce((sum, file) => sum + statSync(file).size, 0);

console.log(
  `[vercel] ${local.length} files, ${(total / 1024 / 1024).toFixed(2)} MB` +
    (configFile ? " (+ vercel.json routing/headers)" : ""),
);

if (dryRun) {
  for (const file of local) console.log("  " + cleanPath(file));
  if (configFile) console.log("  vercel.json (generated)");
  console.log("[vercel] dry run — nothing was uploaded.");
  process.exit(0);
}

if (!token) {
  console.error(
    "[vercel] Set VERCEL_TOKEN first (Vercel → Account Settings → Tokens).",
  );
  process.exit(1);
}

const auth = { Authorization: `Bearer ${token}` };

// Upload one blob and return its digest entry for the deployment.
async function upload(fileName, buffer) {
  const sha = createHash("sha1").update(buffer).digest("hex");
  const response = await fetch("https://api.vercel.com/v2/files", {
    method: "POST",
    headers: {
      ...auth,
      "x-vercel-digest": sha,
      "Content-Type": "application/octet-stream",
    },
    body: buffer,
  });
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`upload of ${fileName} failed (${response.status}) ${details}`);
  }
  return { file: fileName, sha, size: buffer.length };
}

try {
  const entries = [];
  for (const file of local) {
    entries.push(await upload(cleanPath(file), readFileSync(file)));
  }
  if (configFile) {
    entries.push(
      await upload(configFile, readFileSync(configFile)),
    );
  }

  const response = await fetch("https://api.vercel.com/v13/deployments", {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: project,
      files: entries,
      target: "production",
      projectSettings: {
        framework: null,
        buildCommand: null,
        installCommand: null,
        outputDirectory: null,
      },
    }),
  });
  const created = await response.json().catch(() => null);
  if (!response.ok) {
    console.error(
      "[vercel] deployment failed:",
      created?.error?.message ?? `HTTP ${response.status}`,
    );
    process.exit(1);
  }

  console.log(`[vercel] deployment ${created.id} → https://${created.url}`);

  let state = created.readyState;
  let url = created.url;
  const started = Date.now();
  while (state !== "READY" && state !== "ERROR" && Date.now() - started < 240000) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const poll = await fetch(`https://api.vercel.com/v13/deployments/${created.id}`, {
      headers: auth,
    });
    const current = await poll.json().catch(() => null);
    state = current?.readyState ?? state;
    url = current?.url ?? url;
    console.log("[vercel] state:", state);
  }

  if (state !== "READY") {
    console.error("[vercel] deployment did not become ready:", state);
    process.exit(1);
  }
  console.log(`Live at: https://${url}`);
} catch (error) {
  console.error("[vercel]", error?.message ?? error);
  process.exit(1);
}
