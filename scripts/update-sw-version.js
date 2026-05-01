#!/usr/bin/env node
/**
 * update-sw-version.js
 * Stamps public/sw.js CACHE_NAME with a unique-per-deploy ID so installed
 * PWAs bust their service-worker cache on every push.
 *
 * Runs as PREbuild — earlier was postbuild, but Vercel can snapshot /public
 * before postbuild fires, so the modified sw.js wasn't reaching the CDN. By
 * running before next build, the change is in place before any snapshot or
 * Next.js processing happens.
 *
 * Version source priority:
 *   1. VERCEL_GIT_COMMIT_SHA — set by Vercel on every deploy
 *   2. `git rev-parse --short HEAD` — local dev / non-Vercel CI
 *   3. `t{timestamp}` — fallback if git is unavailable
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const SW_PATH = path.join(__dirname, "..", "public", "sw.js");

if (!fs.existsSync(SW_PATH)) {
  console.error("[update-sw-version] public/sw.js not found");
  process.exit(1);
}

function resolveVersion() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 12);
  }
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString().trim();
  } catch {
    return `t${Date.now()}`;
  }
}

const version = resolveVersion();
const swContent = fs.readFileSync(SW_PATH, "utf-8");

const updated = swContent.replace(
  /^const CACHE_NAME = "atlas-spas-[^"]*";/m,
  `const CACHE_NAME = "atlas-spas-${version}";`
);

if (updated === swContent) {
  console.warn("[update-sw-version] CACHE_NAME line not matched — check the pattern");
  process.exit(0);
}

fs.writeFileSync(SW_PATH, updated, "utf-8");
console.log(`[update-sw-version] ✓ CACHE_NAME → atlas-spas-${version}`);
