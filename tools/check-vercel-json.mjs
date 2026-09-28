/**
 * Pre-flight check for `erp/vercel.json`.
 *
 * Two failure modes have each blocked a production deploy of the ERP:
 *
 *  1. An UNKNOWN top-level key. Vercel validates vercel.json against a strict
 *     schema and rejects anything extra, e.g.
 *       "should NOT have additional property `_comment_crons`"
 *     JSON has no comment syntax, so `_comment*` keys are NOT a valid way to
 *     annotate this file. Put such notes in the commit message instead.
 *
 *  2. A cron schedule that fires more than once per day while the project is on
 *     Vercel's Hobby plan. That check also runs at BUILD time, so it fails the
 *     whole deploy rather than merely skipping the job:
 *       "Hobby accounts are limited to daily cron jobs."
 *
 * Neither route below is part of the PayHere payment flow.
 *
 * Run:  node tools/check-vercel-json.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, "..", "erp", "vercel.json");

/** Top-level keys permitted by Vercel's vercel.json schema. */
const ALLOWED_KEYS = new Set([
  "$schema", "framework", "crons", "buildCommand", "installCommand",
  "devCommand", "outputDirectory", "builds", "routes", "headers",
  "redirects", "rewrites", "functions", "regions", "cleanUrls",
  "trailingSlash", "images", "ignoreCommand", "frameworkVersion", "git",
  "github", "packageManager",
]);

/**
 * True when a standard 5-field cron expression fires more than once per day,
 * which Vercel Hobby rejects at build time.
 */
function firesSubDaily(schedule) {
  const parts = String(schedule).trim().split(/\s+/);
  const minute = parts[0] ?? "";
  const hour = parts[1] ?? "";
  const minuteIsWild = minute === "*" || minute.startsWith("*/") || minute.includes(",");
  const hourIsWild = hour === "*" || hour.startsWith("*/") || hour.includes(",");
  return minuteIsWild || hourIsWild;
}

const config = JSON.parse(readFileSync(target, "utf8"));
const problems = [];

const unknownKeys = Object.keys(config).filter((k) => !ALLOWED_KEYS.has(k));
if (unknownKeys.length > 0) {
  problems.push("unknown top-level key(s): " + unknownKeys.join(", ") + " (Vercel rejects the deploy)");
}

for (const cron of config.crons ?? []) {
  if (firesSubDaily(cron.schedule)) {
    problems.push(
      "schedule " + cron.schedule + " (" + cron.path +
      ") fires more than once per day (Vercel Hobby rejects the deploy)",
    );
  }
}

if (problems.length > 0) {
  console.error("vercel.json WILL FAIL VALIDATION:");
  for (const problem of problems) {
    console.error("  x " + problem);
  }
  process.exit(1);
}

console.log("vercel.json is valid.");
console.log("  framework: " + (config.framework || "(unset)"));
for (const cron of config.crons ?? []) {
  console.log("  cron " + cron.path + " -> " + cron.schedule + " (Hobby-safe)");
}
