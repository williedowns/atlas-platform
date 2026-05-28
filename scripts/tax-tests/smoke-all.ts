// Runs all 4 state smoke tests in sequence.
// Slow because of OK CSA's rate limit — total runtime ~10 minutes.
// Exits non-zero if any state failed.
//
//   bun scripts/tax-tests/smoke-all.ts
import { spawnSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const tests = [
  { name: "TX", file: "tx.ts" },
  { name: "KS", file: "ks.ts" },
  { name: "AR", file: "ar.ts" },
  { name: "OK", file: "ok.ts" }, // slowest — run last so earlier failures surface fast
];

const results: { name: string; ok: boolean }[] = [];
const startAll = Date.now();

for (const t of tests) {
  console.log(`\n══════════════ ${t.name} ══════════════`);
  const startState = Date.now();
  const res = spawnSync("bun", [resolve(here, t.file)], { stdio: "inherit" });
  const elapsed = ((Date.now() - startState) / 1000).toFixed(1);
  const ok = res.status === 0;
  results.push({ name: t.name, ok });
  console.log(`(${t.name} completed in ${elapsed}s — ${ok ? "PASS" : "FAIL"})`);
}

const totalSec = ((Date.now() - startAll) / 1000).toFixed(1);
console.log(`\n══════════════ SMOKE-ALL ══════════════`);
console.log(`Total: ${totalSec}s`);
for (const r of results) {
  console.log(`  ${r.ok ? "✓" : "✗"} ${r.name}`);
}

const anyFailed = results.some((r) => !r.ok);
if (anyFailed) {
  console.log("\nOne or more state parsers broke. Check the per-state output above + docs/tax-system.md.");
  process.exit(1);
}
console.log("\nAll parsers OK.");
