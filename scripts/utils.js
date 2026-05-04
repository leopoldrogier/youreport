const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const crypto = require("crypto");
const { DateTime } = require("luxon");

function loadEnv() {
  const root = path.join(__dirname, "..");
  for (const file of [".env.local", ".env"]) {
    const full = path.join(root, file);
    if (fs.existsSync(full)) dotenv.config({ path: full });
  }
}

function getRequiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var "${name}"`);
  return v;
}

function getOptionalEnv(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (const a of argv) {
    if (!a.startsWith("--")) continue;
    const [k, ...rest] = a.slice(2).split("=");
    out[k] = rest.length ? rest.join("=") : true;
  }
  return out;
}

function normalizeEmail(v) { return String(v || "").trim().toLowerCase(); }

function parseEmailList(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(normalizeEmail).filter(Boolean);
  return String(v).split(",").map(normalizeEmail).filter(Boolean);
}

function getPreviousWeekRangeISO(timezone = "Europe/Paris") {
  const now = DateTime.now().setZone(timezone);
  const thisWeekStart = now.startOf("week");
  const periodStart = thisWeekStart.minus({ weeks: 1 });
  const periodEnd = thisWeekStart.minus({ days: 1 });
  return {
    timezone,
    periodStartISO: periodStart.toISODate(),
    periodEndISO: periodEnd.toISODate(),
    label: `${periodStart.toFormat("dd/LL")} → ${periodEnd.toFormat("dd/LL")}`,
  };
}

function extractClaudeText(message) {
  const blocks = message?.content || [];
  return blocks.filter((b) => b && b.type === "text" && typeof b.text === "string").map((b) => b.text).join("\n").trim();
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

module.exports = { loadEnv, getRequiredEnv, getOptionalEnv, parseArgs, normalizeEmail, parseEmailList, getPreviousWeekRangeISO, extractClaudeText, sleep };
