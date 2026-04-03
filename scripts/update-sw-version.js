#!/usr/bin/env node
/**
 * update-sw-version.js
 * Runs after `next build` to stamp the service worker cache name with the
 * Next.js build ID, forcing browsers to download fresh assets on every deploy.
 *
 * Usage: node scripts/update-sw-version.js
 * Called automatically via package.json "postbuild" script.
 */

const fs = require("fs");
const path = require("path");

const BUILD_ID_PATH = path.join(__dirname, "..", ".next", "BUILD_ID");
const SW_PATH = path.join(__dirname, "..", "public", "sw.js");

// Gracefully skip if we're running outside a Next.js build (e.g. dev)
if (!fs.existsSync(BUILD_ID_PATH)) {
  console.log("[update-sw-version] .next/BUILD_ID not found — skipping (dev environment?)");
  process.exit(0);
}

if (!fs.existsSync(SW_PATH)) {
  console.error("[update-sw-version] public/sw.js not found — cannot update cache version");
  process.exit(1);
}

const buildId = fs.readFileSync(BUILD_ID_PATH, "utf-8").trim();
const swContent = fs.readFileSync(SW_PATH, "utf-8");

// Replace any line that starts with: const CACHE_NAME = "atlas-spas-...";
const updated = swContent.replace(
  /^const CACHE_NAME = "atlas-spas-[^"]*";/m,
  `const CACHE_NAME = "atlas-spas-${buildId}";`
);

if (updated === swContent) {
  console.warn("[update-sw-version] CACHE_NAME line not found in sw.js — check the pattern");
  process.exit(0);
}

fs.writeFileSync(SW_PATH, updated, "utf-8");
console.log(`[update-sw-version] ✓ CACHE_NAME updated to atlas-spas-${buildId}`);
