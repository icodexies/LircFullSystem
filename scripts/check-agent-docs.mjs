// Verifies the agent documentation without scanning the whole app.
// Run: node scripts/check-agent-docs.mjs
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const docs = [
  "AGENTS.md",
  "README.md",
  "docs/PROJECT_MAP.md",
  "docs/AGENT_WORKFLOW.md",
  "docs/CHANGE_LOG.md",
  "docs/FOLDER_STRUCTURE.md",
  "docs/PROJECT_GUIDE.md",
];

const errors = [];
let linkCount = 0;
let pathCount = 0;

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

for (const doc of docs) {
  if (!exists(doc)) {
    errors.push(`Missing agent document: ${doc}`);
    continue;
  }

  const text = fs.readFileSync(path.join(root, doc), "utf8");

  for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1].trim();
    if (!target || target.startsWith("#") || /^(https?:|mailto:)/.test(target)) {
      continue;
    }
    linkCount += 1;
    const file = target.split("#")[0];
    if (!file || file.includes("<")) continue;
    const resolved = path.resolve(path.dirname(path.join(root, doc)), file);
    if (!fs.existsSync(resolved)) {
      errors.push(`${doc}: broken local link -> ${target}`);
    }
  }

  for (const match of text.matchAll(/`((?:src|docs|tests|supabase|scripts)\/[^`\n]+)`/g)) {
    const raw = match[1].trim().replace(/[.,;:]+$/, "");
    if (
      !raw ||
      raw.endsWith("/") ||
      raw.includes("*") ||
      raw.includes("<") ||
      raw.includes("...") ||
      /\s/.test(raw)
    ) {
      continue;
    }
    pathCount += 1;
    if (!exists(raw)) {
      errors.push(`${doc}: mapped path does not exist -> ${raw}`);
    }
  }
}

const memberPages = fs.readFileSync(path.join(root, "src/routes/memberPages.js"), "utf8");
const app = fs.readFileSync(path.join(root, "src/App.jsx"), "utf8");
const map = fs.readFileSync(path.join(root, "docs/PROJECT_MAP.md"), "utf8");

const routes = new Set(
  [
    ...memberPages.matchAll(/path:\s*["']([^"']+)["']/g),
    ...app.matchAll(/<Route\s+path="([^"]+)"/g),
  ]
    .map((match) => match[1])
    .filter((route) => route !== "*" && !route.includes(":")),
);

for (const route of routes) {
  if (!map.includes("`" + route + "`")) {
    errors.push(`docs/PROJECT_MAP.md: route is not documented -> ${route}`);
  }
}

if (errors.length > 0) {
  console.error("Agent documentation check failed:");
  for (const error of [...new Set(errors)]) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Agent documentation OK: ${docs.length} files, ${linkCount} local links, ` +
      `${pathCount} mapped paths and ${routes.size} routes checked.`,
  );
}
