// Publishes the built site (dist/) to Netlify through the Netlify API.
// Used by the GitHub Actions "Deploy to Netlify" job, and can also be run
// by hand:
//
//   NETLIFY_AUTH_TOKEN=... NETLIFY_SITE_ID=... node scripts/deploy-netlify.mjs
//
// No Netlify CLI needed — the zip is uploaded directly (jszip ships with
// the project's exceljs dependency).
import JSZip from "jszip";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const token = process.env.NETLIFY_AUTH_TOKEN;
const siteId = process.env.NETLIFY_SITE_ID;
if (!token || !siteId) {
  console.error(
    "Missing NETLIFY_AUTH_TOKEN and/or NETLIFY_SITE_ID environment variables.",
  );
  process.exit(1);
}

const ROOT = "dist";

function addDirectory(zip, directory) {
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      addDirectory(zip, full);
    } else {
      zip.file(relative(ROOT, full).split("\\").join("/"), readFileSync(full));
    }
  }
}

const zip = new JSZip();
addDirectory(zip, ROOT);
// The redirects/headers rules travel with the deploy.
zip.file("netlify.toml", readFileSync("netlify.toml"));

const buffer = await zip.generateAsync({
  type: "nodebuffer",
  compression: "DEFLATE",
});
console.log(`Uploading ${(buffer.length / 1024).toFixed(0)} KB to Netlify…`);

const created = await fetch(
  `https://api.netlify.com/api/v1/sites/${siteId}/deploys`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/zip",
    },
    body: buffer,
  },
);
if (!created.ok) {
  console.error(
    `Deploy request failed (${created.status}):`,
    (await created.text()).slice(0, 300),
  );
  process.exit(1);
}

let deploy = await created.json();
console.log(`Deploy created: ${deploy.id} (${deploy.state})`);

for (
  let attempt = 0;
  attempt < 60 && deploy.state !== "ready" && deploy.state !== "error";
  attempt += 1
) {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const polled = await fetch(
    `https://api.netlify.com/api/v1/deploys/${deploy.id}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  deploy = await polled.json();
  console.log(`  state: ${deploy.state}`);
}

if (deploy.state !== "ready") {
  console.error(`The deploy did not finish (state: ${deploy.state}).`);
  process.exit(1);
}
console.log(`Live at: ${deploy.ssl_url || deploy.url}`);
