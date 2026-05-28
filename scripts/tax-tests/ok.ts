// OK CSA Rate Locator smoke test.
//
// WARNING: OK CSA's nginx rate-limits aggressively. This script paces at 60s
// between requests so bulk runs don't trip a 90s 503. Total runtime: ~7 minutes.
//
//   bun scripts/tax-tests/ok.ts
import { lookupOklahomaRateByAddress } from "@/lib/tax/okTaxClient";

const tests = [
  { name: "OKC City Hall",  houseNumber: "200",  streetDirection: "N",  streetName: "Walker", streetType: "AVE", zip: "73102", expectMin: 0.08, expectMax: 0.10 },
  { name: "Tulsa downtown", houseNumber: "175",  streetDirection: "E",  streetName: "2nd",    streetType: "ST",  zip: "74103", expectMin: 0.08, expectMax: 0.10 },
  { name: "Norman",         houseNumber: "201",  streetDirection: "W",  streetName: "Gray",   streetType: "ST",  zip: "73069", expectMin: 0.08, expectMax: 0.10 },
  { name: "Edmond",         houseNumber: "100",  streetDirection: "E",  streetName: "1st",    streetType: "ST",  zip: "73034", expectMin: 0.075,expectMax: 0.10 },
  { name: "Lawton",         houseNumber: "212",  streetDirection: "SW", streetName: "9th",    streetType: "ST",  zip: "73501", expectMin: 0.085,expectMax: 0.11 },
  { name: "Stillwater",     houseNumber: "723",  streetDirection: "S",  streetName: "Main",   streetType: "ST",  zip: "74074", expectMin: 0.085,expectMax: 0.11 },
  { name: "Broken Arrow",   houseNumber: "220",  streetDirection: "S",  streetName: "1st",    streetType: "ST",  zip: "74012", expectMin: 0.08, expectMax: 0.10 },
];

let pass = 0, fail = 0;
for (let i = 0; i < tests.length; i++) {
  const t = tests[i];
  if (i > 0) {
    // OK CSA's rate limit is unforgiving. 60s pacing keeps us out of 503-land.
    console.log("  ... pacing 60s for OK CSA rate limit ...");
    await new Promise((r) => setTimeout(r, 60_000));
  }
  const res = await lookupOklahomaRateByAddress(t);
  if (!res.ok) {
    fail++;
    console.log(`✗ ${t.name}: ${res.reason} — ${res.message.slice(0, 120)}`);
    continue;
  }
  const inRange = res.combinedRate >= t.expectMin && res.combinedRate <= t.expectMax;
  const hasState = res.jurisdictions.some((j) => j.jurisType === "state");
  const sumMatches = Math.abs(
    res.jurisdictions.reduce((s, j) => s + j.jurisRate, 0) - res.combinedRate,
  ) < 0.0005;
  if (inRange && hasState && sumMatches) {
    pass++;
    console.log(`✓ ${t.name}: ${(res.combinedRate * 100).toFixed(3)}%`);
  } else {
    fail++;
    console.log(`✗ ${t.name}: rate=${res.combinedRate} inRange=${inRange} hasState=${hasState} sumMatches=${sumMatches}`);
  }
}

console.log(`\n── OK SUMMARY ── ${pass} pass / ${fail} fail`);
if (fail > 0) process.exit(1);
