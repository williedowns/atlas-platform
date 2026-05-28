// KS DOR (KDOR webLookupResults.cfm) smoke test.
// bun scripts/tax-tests/ks.ts
import { lookupKansasRateByAddress } from "@/lib/tax/ksRevenueClient";

const tests = [
  { name: "Wichita (Sedgwick)",   streetNumber: "525",  streetName: "N Main St",       city: "Wichita",       zip: "67203", expectMin: 0.07,  expectMax: 0.085 },
  { name: "Topeka",               streetNumber: "300",  streetName: "SW 10th Ave",     city: "Topeka",        zip: "66612", expectMin: 0.085, expectMax: 0.105 },
  { name: "Kansas City KS",       streetNumber: "701",  streetName: "N 7th St",        city: "Kansas City",   zip: "66101", expectMin: 0.085, expectMax: 0.105 },
  { name: "Overland Park",        streetNumber: "8500", streetName: "Santa Fe Dr",     city: "Overland Park", zip: "66212", expectMin: 0.085, expectMax: 0.105 },
  { name: "Lawrence",             streetNumber: "1006", streetName: "Massachusetts St",city: "Lawrence",      zip: "66044", expectMin: 0.085, expectMax: 0.105 },
  { name: "Salina",               streetNumber: "300",  streetName: "W Ash St",        city: "Salina",        zip: "67401", expectMin: 0.08,  expectMax: 0.105 },
  { name: "Hutchinson",           streetNumber: "125",  streetName: "N Main St",       city: "Hutchinson",    zip: "67501", expectMin: 0.07,  expectMax: 0.095 },
];

let pass = 0, fail = 0;
for (const t of tests) {
  const res = await lookupKansasRateByAddress(t);
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

console.log(`\n── KS SUMMARY ── ${pass} pass / ${fail} fail`);
if (fail > 0) process.exit(1);
