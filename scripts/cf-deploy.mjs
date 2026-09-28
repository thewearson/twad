#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const wranglerPkg = path.dirname(require.resolve("wrangler/package.json", { paths: [root] }));
const wranglerJs = path.join(wranglerPkg, "bin/wrangler.js");

const NAMES = [
  "SUPABASE_SERVICE_ROLE",
  "SERVICE_ROLE",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SERVICE_ROLE_KEY",
  "SECRET_KEY",
  "SB_SERVICE_ROLE",
  "SB_SECRET_KEY",
];

function collectSecrets() {
  const out = {};
  for (const name of NAMES) {
    const v = process.env[name];
    if (typeof v === "string" && v.trim() && !v.startsWith("sb_publishable_")) {
      out[name] = v.trim();
    }
  }
  for (const [key, value] of Object.entries(process.env)) {
    if (out[key] || typeof value !== "string") continue;
    const v = value.trim();
    if (!v || v.startsWith("sb_publishable_")) continue;
    const n = key.toUpperCase();
    if (!/SERVICE|SECRET|SUPABASE|ROLE/.test(n)) continue;
    if (n.includes("CLOUDFLARE") || n.includes("WRANGLER") || n.includes("API_TOKEN")) continue;
    if (v.startsWith("sb_secret_") || (v.startsWith("eyJ") && v.length > 200)) {
      out[key] = v;
    }
  }
  return out;
}

function run(args) {
  const result = spawnSync(process.execPath, [wranglerJs, ...args], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  return result.status ?? 1;
}

let args = process.argv.slice(2);
if (args.length === 0) args = ["deploy"];
if (args[0] === "deploy" && !args.includes("--keep-vars")) args.push("--keep-vars");

const secrets = collectSecrets();
if (Object.keys(secrets).length && (args[0] === "deploy" || args[0] === "preview" || args[0] === "versions")) {
  const file = path.join(tmpdir(), `twad-secrets-${process.pid}.json`);
  writeFileSync(file, JSON.stringify(secrets));
  const bulk = run(["secret", "bulk", file]);
  try {
    unlinkSync(file);
  } catch {}
  if (bulk !== 0) {
    console.warn("twad: secret bulk skipped; deploying anyway");
  }
}

process.exit(run(args));
