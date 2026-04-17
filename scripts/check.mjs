import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const files = [
  "app.js",
  "netlify/functions/_shared.mjs",
  "netlify/functions/health.mjs",
  "netlify/functions/detect-targets.mjs",
  "netlify/functions/locate-evidence.mjs",
  "netlify/functions/extract-facts.mjs",
  "netlify/functions/enrich-summary.mjs",
  "netlify/functions/verify-summary.mjs"
];
for (const rel of files) {
  execFileSync(process.execPath, ["--check", path.join(root, rel)], { stdio: "inherit" });
}
for (const name of fs.readdirSync(path.join(root, "schemas"))) {
  JSON.parse(fs.readFileSync(path.join(root, "schemas", name), "utf8"));
}
console.log("Basic syntax and JSON schema checks passed.");
