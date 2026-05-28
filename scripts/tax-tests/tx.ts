// TX Comptroller API smoke test.
// Hits the live state endpoint with 10 known addresses, verifies parser output.
// Exits non-zero on any failure so CI can rely on the exit code.
//
//   bun scripts/tax-tests/tx.ts
import { lookupTexasRateByAddress } from "@/lib/tax/txComptrollerApi";

const tests = [
  { name: "Houston downtown",      street: "1500 McKinney St",    city: "Houston",    zip: "77002", expectMin: 0.07, expectMax: 0.0825 },
  { name: "Dallas downtown",       street: "500 S Ervay St",      city: "Dallas",     zip: "75201", expectMin: 0.07, expectMax: 0.0825 },
  { name: "Mesquite",              street: "1818 Rodeo Dr",       city: "Mesquite",   zip: "75149", expectMin: 0.07, expectMax: 0.0825 },
  { name: "Austin Capitol",        street: "1100 Congress Ave",   city: "Austin",     zip: "78701", expectMin: 0.07, expectMax: 0.0825 },
  { name: "Fort Worth City Hall",  street: "200 Texas St",        city: "Fort Worth", zip: "76102", expectMin: 0.07, expectMax: 0.0825 },
  { name: "San Antonio Alamo",     street: "300 Alamo Plaza",     city: "San Antonio",zip: "78205", expectMin: 0.07, expectMax: 0.0825 },
  { name: "Lubbock",               street: "1314 Avenue K",       city: "Lubbock",    zip: "79401", expectMin: 0.07, expectMax: 0.0825 },
  { name: "El Paso",               street: "300 N Campbell St",   city: "El Paso",    zip: "79901", expectMin: 0.07, expectMax: 0.0825 },
  { name: "Amarillo",              street: "601 S Buchanan St",   city: "Amarillo",   zip: "79101", expectMin: 0.07, expectMax: 0.0825 },
];

let pass = 0, fail = 0;
for (const t of tests) {
  const res = await lookupTexasRateByAddress({
    street: t.street, city: t.city, zip: t.zip,
    effectiveDate: new Date(),
  });
  if (!res.ok) {
    fail++;
    console.log(`✗ ${t.name}: ${res.reason} — ${res.message}`);
    continue;
  }
  const inRange = res.combinedRate >= t.expectMin && res.combinedRate <= t.expectMax;
  const hasState = res.jurisdictions.some((j) => j.jurisType === "STATE");
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

console.log(`\n── TX SUMMARY ── ${pass} pass / ${fail} fail`);
if (fail > 0) process.exit(1);
