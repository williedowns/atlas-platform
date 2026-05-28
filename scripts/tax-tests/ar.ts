// AR DFA / GIS Rate Locator smoke test.
// bun scripts/tax-tests/ar.ts
import { lookupArkansasRateByAddress } from "@/lib/tax/arGisClient";

const tests = [
  { name: "Little Rock",     street: "500 Woodlane St",       city: "Little Rock",  zip: "72201", expectMin: 0.08,  expectMax: 0.095 },
  { name: "Fayetteville",    street: "113 W Mountain St",     city: "Fayetteville", zip: "72701", expectMin: 0.09,  expectMax: 0.105 },
  { name: "Bentonville",     street: "702 SW 8th St",         city: "Bentonville",  zip: "72712", expectMin: 0.09,  expectMax: 0.105 },
  { name: "Jonesboro",       street: "300 S Church St",       city: "Jonesboro",    zip: "72401", expectMin: 0.08,  expectMax: 0.095 },
  { name: "Hot Springs",     street: "133 Convention Blvd",   city: "Hot Springs",  zip: "71901", expectMin: 0.09,  expectMax: 0.105 },
  { name: "Fort Smith",      street: "623 Garrison Ave",      city: "Fort Smith",   zip: "72901", expectMin: 0.09,  expectMax: 0.105 },
  { name: "Texarkana AR",    street: "216 Walnut St",         city: "Texarkana",    zip: "71854", expectMin: 0.095, expectMax: 0.115 },
];

let pass = 0, fail = 0;
for (let i = 0; i < tests.length; i++) {
  const t = tests[i];
  if (i > 0) await new Promise((r) => setTimeout(r, 2000)); // be polite to AR GIS
  const res = await lookupArkansasRateByAddress(t);
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

console.log(`\n── AR SUMMARY ── ${pass} pass / ${fail} fail`);
if (fail > 0) process.exit(1);
