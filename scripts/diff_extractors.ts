// One-off parity harness: dump the TS extractor output to /tmp/ts.json so it
// can be diffed against the Python extractor (/tmp/py.json). Run with bun.
import { readFileSync, writeFileSync } from "node:fs";
import { extractRows } from "../src/lib/inventory/extract";

const buf = readFileSync("/tmp/sheet_live.xlsx");
const { serialized, onOrder } = extractRows(buf);

const FIELDS = [
  "location_name", "status", "model_code", "shell_color", "cabinet_color",
  "wrap_status", "customer_name", "fin_balance", "received_date", "notes", "_source_tab",
] as const;

const pick = (r: Record<string, unknown>) =>
  Object.fromEntries(FIELDS.map((k) => [k, r[k] ?? null]));

const out = {
  serialized: Object.fromEntries(serialized.map((r) => [r.serial_number, pick(r)])),
  onOrder: Object.fromEntries(onOrder.map((r) => [r.order_number, pick(r)])),
};
writeFileSync("/tmp/ts.json", JSON.stringify(out, null, 0));
console.log("ts serialized:", serialized.length, "onOrder:", onOrder.length);
