/**
 * Round-trip test for the show-sales XLSX export pipeline.
 *
 * Reads a JSON payload produced by extract_show_deals_full.py, calls the
 * export module to inject the data into the template, and writes the result
 * to disk. The output should be visually near-identical to the source XLSX
 * Lori produced.
 *
 * Usage:
 *     bun run scripts/test-show-sales-export.ts <input.json> <output.xlsx>
 */

import fs from "fs";
import { exportShowSalesWorkbook, type DealInput, type ShowConfigInput } from "../src/lib/show-sales/xlsx-export";

async function main() {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    console.error("Usage: bun run scripts/test-show-sales-export.ts <input.json> <output.xlsx>");
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, "utf-8");
  const payload = JSON.parse(raw) as {
    source_file: string;
    show: {
      show_name: string;
      location: string;
      date_range: string;
      date_of_last_day: string;
      salesman_roster: string[];
    };
    deals: Record<string, unknown>[];
    deal_count: number;
  };

  console.log(`Loaded ${payload.deal_count} deals from ${payload.source_file}`);

  const show: ShowConfigInput = {
    show_name: payload.show.show_name ?? "",
    location: payload.show.location ?? "",
    date_range: payload.show.date_range ?? "",
    date_of_last_day: new Date(payload.show.date_of_last_day),
    salesman_roster: payload.show.salesman_roster ?? [],
  };

  const deals = payload.deals as unknown as DealInput[];

  const buf = await exportShowSalesWorkbook(show, deals);
  fs.writeFileSync(outputPath, buf);
  console.log(`Wrote ${buf.length} bytes → ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
