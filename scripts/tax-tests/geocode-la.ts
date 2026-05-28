// Mapbox geocoder smoke test against 5 known LA addresses.
// bun MAPBOX_ACCESS_TOKEN=pk... scripts/tax-tests/geocode-la.ts
//
// Tests:
//   - Address → lat/lon resolves
//   - Coordinates land inside LA's rough bounding box
//   - Accuracy is reported

import { geocodeAddress } from "@/lib/tax/geocode";

// Rough LA bounding box: NW corner ~33.02°N, -94.04°W; SE corner ~28.93°N, -88.82°W
const LA_BBOX = { minLat: 28.8, maxLat: 33.1, minLng: -94.1, maxLng: -88.7 };

const tests = [
  { name: "Baton Rouge (Capitol)",     street: "900 N 3rd St",         city: "Baton Rouge",  zip: "70802" },
  { name: "NOLA (Jackson Square)",     street: "615 Pere Antoine Alley", city: "New Orleans", zip: "70116" },
  { name: "NOLA (Convention Ctr)",     street: "900 Convention Center Blvd", city: "New Orleans", zip: "70130" },
  { name: "Lafayette",                 street: "705 W University Ave",  city: "Lafayette",    zip: "70506" },
  { name: "Lake Charles",              street: "900 Lakeshore Dr",     city: "Lake Charles", zip: "70601" },
  { name: "Shreveport",                street: "505 Travis St",         city: "Shreveport",   zip: "71101" },
  { name: "Metairie (Jefferson)",      street: "3300 Severn Ave",       city: "Metairie",     zip: "70002" },
];

let pass = 0, fail = 0;
for (const t of tests) {
  const res = await geocodeAddress({ street: t.street, city: t.city, state: "LA", zip: t.zip });
  if (!res.ok) {
    fail++;
    console.log(`✗ ${t.name}: ${res.reason} — ${res.message}`);
    continue;
  }
  const inBbox =
    res.latitude >= LA_BBOX.minLat &&
    res.latitude <= LA_BBOX.maxLat &&
    res.longitude >= LA_BBOX.minLng &&
    res.longitude <= LA_BBOX.maxLng;
  if (!inBbox) {
    fail++;
    console.log(`✗ ${t.name}: out-of-LA-bbox lat=${res.latitude} lng=${res.longitude}`);
    continue;
  }
  pass++;
  console.log(
    `✓ ${t.name}: ${res.latitude.toFixed(5)}, ${res.longitude.toFixed(5)} (${res.accuracy})` +
      (res.cached ? " [cache]" : "")
  );
}

console.log(`\n── LA GEOCODE SUMMARY ── ${pass} pass / ${fail} fail`);
if (fail > 0) process.exit(1);
