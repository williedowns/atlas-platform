// Faithful TypeScript port of scripts/gen_inventory_sync.py extraction logic.
// Parses the Master "Hot Tub & Swim Spa Inventory" workbook into normalized
// rows ready for upsert into inventory_units. Show linking is handled
// separately (resolve-show.ts) — here, the show name is only recorded in notes,
// exactly like the Python source of truth.
//
// Any behavioral change here MUST keep parity with the Python extractor; the
// diff harness (scripts/diff_extractors.ts) is the gate.

import * as XLSX from "xlsx";

// ── Configuration (mirrors gen_inventory_sync.py) ────────────────────────────

const META_TABS = new Set(["KEY", "Status", "Settings", "Shell"]);

export const SHOW_TABS = new Set([
  "Expo 1", "Expo 2", "Expo 3", "Expo 4", "Expo 5", "Canton", "State Fair",
]);

const HOME_SHOWROOM_LABELS = new Set([
  "ennis", "tyler", "waco", "kansas", "okc", "georgetown",
  "plano", "houston", "ftw", "fort worth",
]);

// Tab → [location_name | null, default_status]
const TAB_MAP: Record<string, [string | null, string]> = {
  Ennis:        ["Ennis Warehouse", "at_location"],
  Tyler:        ["Tyler Showroom", "at_location"],
  Waco:         ["Waco Showroom", "at_location"],
  Kansas:       ["Kansas Showroom", "at_location"],
  OKC:          ["OKC Showroom", "at_location"],
  Georgetown:   ["Georgetown Showroom", "at_location"],
  Plano:        ["Plano Showroom", "at_location"],
  Houston:      ["Houston Showroom", "at_location"],
  FTW:          ["Fort Worth Showroom", "at_location"],
  "Take to Waco": ["Waco Showroom", "in_transit"],
  Factory:      ["Ennis Warehouse", "in_factory"],
  "Spas On Order": ["Ennis Warehouse", "on_order"],
  "Expo 1":     [null, "at_show"],
  "Expo 2":     [null, "at_show"],
  "Expo 3":     [null, "at_show"],
  "Expo 4":     [null, "at_show"],
  "Expo 5":     [null, "at_show"],
  Canton:       [null, "at_show"],
  "State Fair": [null, "at_show"],
  Delivered:    [null, "delivered"],
};

const DESTINATION_SHOWROOM_MAP: Record<string, string> = {
  "ennis showroom": "Ennis Warehouse",
  "ennis warehouse": "Ennis Warehouse",
  "tyler showroom": "Tyler Showroom",
  "waco showroom": "Waco Showroom",
  "kansas showroom": "Kansas Showroom",
  "okc showroom": "OKC Showroom",
  "georgetown showroom": "Georgetown Showroom",
  "plano showroom": "Plano Showroom",
  "houston showroom": "Houston Showroom",
  "fort worth showroom": "Fort Worth Showroom",
  "ftw showroom": "Fort Worth Showroom",
  ftw: "Fort Worth Showroom",
};

// XLSX Status column value → DB status override (null = use tab default)
const STATUS_OVERRIDES: Record<string, string | null> = {
  sold: "allocated",
  delivered: "delivered",
  pending: null,
  stock: null,
};

// Column indices (0-based) — all tabs share this layout
const COL_WRAP = 2;
const COL_LINE = 3; // unused downstream, kept for index clarity
const COL_MODEL = 4;
const COL_SHELL = 5;
const COL_CABINET = 6;
const COL_SERIAL = 7;
const COL_LOCATION = 8; // unused downstream
const COL_COMPLETED = 9;
const COL_STATUS = 10;
const COL_NOTES_1 = 11;
const COL_FIN_BAL = 12;
const COL_ATLAS_NOTES = 13;
const COL_EXPO_NOTES = 14;
const COL_LAST_NAME = 0;
const COL_FIRST_NAME = 1;
void COL_LINE; void COL_LOCATION;

export interface ExtractedRow {
  serial_number: string | null;
  order_number: string | null;
  location_name: string | null;
  status: string;
  model_code: string | null;
  shell_color: string | null;
  cabinet_color: string | null;
  wrap_status: string | null;
  customer_name: string | null;
  fin_balance: string | null;
  received_date: string | null;
  notes: string | null;
  // Raw show name from a show-tab header (e.g. "Will Rogers"); null otherwise.
  // Resolved to a DB show_id downstream by resolve-show.ts.
  show_name: string | null;
  _source_tab: string;
}

// ── Helpers (mirror the Python) ──────────────────────────────────────────────

function isBlank(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  const s = String(v).trim();
  return s === "" || s.toLowerCase() === "none";
}

function cleanSerial(v: unknown): string | null {
  if (isBlank(v)) return null;
  let s = String(v).trim();
  if (s.endsWith(".0") && /^\d+$/.test(s.slice(0, -2))) s = s.slice(0, -2);
  return s;
}

function isOrderNumber(s: string): boolean {
  return s.toUpperCase().startsWith("W") && /\d/.test(s);
}

function normalizeWrap(v: unknown): string | null {
  if (isBlank(v)) return null;
  const s = String(v).trim().toUpperCase();
  return s === "WR" || s === "UN" ? s : null;
}

function normalizeStatus(tabDefault: string, raw: unknown): string {
  if (isBlank(raw)) return tabDefault;
  const k = String(raw).trim().toLowerCase();
  if (k in STATUS_OVERRIDES) {
    const ov = STATUS_OVERRIDES[k];
    return ov ? ov : tabDefault;
  }
  return tabDefault;
}

function buildCustomerName(last: unknown, first: unknown): string | null {
  const l = isBlank(last) ? "" : String(last).trim();
  const f = isBlank(first) ? "" : String(first).trim();
  if (!l && !f) return null;
  if (l && f) return `${l}, ${f}`;
  return l || f;
}

function isDate(v: unknown): v is Date {
  return v instanceof Date && !isNaN(v.getTime());
}

// Match Python str(): openpyxl returns numeric cells as floats, so an integer
// stringifies as "0.0" / "2508975.0", not "0" / "2508975". Used wherever a raw
// cell value becomes a string (fin_balance and note columns).
function pyCellStr(v: unknown): string {
  if (typeof v === "number") return Number.isInteger(v) ? `${v}.0` : String(v);
  return String(v).trim();
}

// openpyxl returns naive datetimes matching the cell's displayed date. SheetJS
// (cellDates:true) builds Dates at UTC midnight, so read with UTC getters to
// reproduce the same Y-M-D the Python emitted. openpyxl rejects serials outside
// Excel's valid date range (treats the cell as an error → None); SheetJS would
// coerce them into absurd years (e.g. 20240-09-17), so we reject the same way.
function dateToISOorNull(d: Date): string | null {
  const y = d.getUTCFullYear();
  if (y < 1900 || y > 9999) return null;
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(v: unknown): string | null {
  if (isBlank(v)) return null;
  if (isDate(v)) return dateToISOorNull(v);
  return null; // free-form text → ignore
}

function mergeNotes(chunks: Array<[string, unknown]>): string | null {
  const parts: string[] = [];
  for (const [label, val] of chunks) {
    if (isBlank(val)) continue;
    let text: string;
    if (isDate(val)) {
      const iso = dateToISOorNull(val);
      if (iso === null) continue; // out-of-range date → openpyxl drops it
      text = iso;
    } else {
      text = pyCellStr(val);
    }
    parts.push(`[${label}] ${text}`);
  }
  return parts.length ? parts.join(" | ") : null;
}

// ── Main extraction ──────────────────────────────────────────────────────────

export function extractRows(
  buf: ArrayBuffer | Uint8Array,
): { serialized: ExtractedRow[]; onOrder: ExtractedRow[] } {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });

  const serialized = new Map<string, ExtractedRow>();
  const onOrder = new Map<string, ExtractedRow>();

  // Active tabs first, Delivered LAST (active record wins on serial collision).
  const sheetOrder = wb.SheetNames.filter((s) => s !== "Delivered");
  if (wb.SheetNames.includes("Delivered")) sheetOrder.push("Delivered");

  for (const sheetName of sheetOrder) {
    if (META_TABS.has(sheetName)) continue;
    if (!(sheetName in TAB_MAP)) continue;

    const [locationName, tabDefaultStatus] = TAB_MAP[sheetName];
    const ws = wb.Sheets[sheetName];
    const isShowTab = SHOW_TABS.has(sheetName);

    // header:1 → array-of-arrays; raw keeps numbers/Dates; defval fills gaps.
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
    });

    const cell = (row: unknown[], i: number) => (i < row.length ? row[i] : null);

    // Show-tab show name: from sheet row 2 (index 1) when col0 set and no serial.
    let tabShowName: string | null = null;
    if (isShowTab && rows.length > 1) {
      const r = rows[1];
      if (r && !isBlank(cell(r, COL_LAST_NAME)) && !cleanSerial(cell(r, COL_SERIAL))) {
        tabShowName = String(cell(r, COL_LAST_NAME)).trim();
      }
    }

    // Main loop: sheet rows 2..end (indices 1..end).
    // NOTE on parity: the Python source skips rows with `len(row) < 15`. Under
    // openpyxl that only drops rows physically missing a stored cell in the
    // last column (col O) — a storage quirk affecting exactly 3 historical
    // `delivered` units. SheetJS pads every row to the sheet range, so it keeps
    // those 3. We intentionally do NOT replicate the quirk: those units are
    // valid rows in the sheet, are `delivered` (never touched by the active
    // sync), and including them is more correct than dropping them.
    for (let ri = 1; ri < rows.length; ri++) {
      const row = rows[ri];
      if (!row) continue;
      const rawKey = cleanSerial(cell(row, COL_SERIAL));
      if (!rawKey) continue;

      const status = normalizeStatus(tabDefaultStatus, cell(row, COL_STATUS));

      // Column 12: route by VALUE type (header is unreliable across tabs).
      const col12 = cell(row, COL_FIN_BAL);
      let finBalance: string | null = null;
      let homeShowroomNote: string | null = null;
      let estCompNote: string | null = null;
      if (isDate(col12)) {
        estCompNote = parseDate(col12);
      } else if (isBlank(col12)) {
        finBalance = null;
      } else {
        finBalance = pyCellStr(col12);
        if (isShowTab && HOME_SHOWROOM_LABELS.has(finBalance.toLowerCase())) {
          homeShowroomNote = finBalance;
          finBalance = null;
        }
      }

      // Customer name (col0/col1), with show-tab suppression.
      let customerName = buildCustomerName(cell(row, COL_LAST_NAME), cell(row, COL_FIRST_NAME));
      if (isShowTab && customerName && tabShowName) {
        const firstWord = customerName.split(",")[0].trim().toLowerCase();
        const showFirst = tabShowName.split(",")[0].trim().toLowerCase();
        if (firstWord === showFirst || firstWord.startsWith(showFirst)) {
          customerName = null;
        } else if (status !== "allocated" && status !== "delivered") {
          customerName = null;
        }
      }

      // Notes: build in the exact insertion order the Python uses.
      const noteChunks: Array<[string, unknown]> = [
        ["Fierce", cell(row, COL_NOTES_1)],
        ["Atlas", cell(row, COL_ATLAS_NOTES)],
        ["Expo", cell(row, COL_EXPO_NOTES)],
      ];
      if (isShowTab && tabShowName) noteChunks.splice(0, 0, ["Show", tabShowName]);
      if (homeShowroomNote) noteChunks.splice(isShowTab ? 1 : 0, 0, ["Home", homeShowroomNote]);
      if (estCompNote) noteChunks.splice(0, 0, ["Est Comp", estCompNote]);

      // Spas On Order: customer column may be a destination showroom.
      let rowLocationName = locationName;
      if (sheetName === "Spas On Order" && customerName) {
        const rawLast = (isBlank(cell(row, COL_LAST_NAME)) ? "" : String(cell(row, COL_LAST_NAME)).trim()).toLowerCase();
        const firstPart = rawLast.split(",")[0].trim();
        if (firstPart in DESTINATION_SHOWROOM_MAP) {
          rowLocationName = DESTINATION_SHOWROOM_MAP[firstPart];
          customerName = null;
        }
      }

      const data: ExtractedRow = {
        serial_number: null,
        order_number: null,
        location_name: rowLocationName,
        status,
        model_code: isBlank(cell(row, COL_MODEL)) ? null : String(cell(row, COL_MODEL)).trim(),
        shell_color: isBlank(cell(row, COL_SHELL)) ? null : String(cell(row, COL_SHELL)).trim(),
        cabinet_color: isBlank(cell(row, COL_CABINET)) ? null : String(cell(row, COL_CABINET)).trim(),
        wrap_status: normalizeWrap(cell(row, COL_WRAP)),
        customer_name: customerName,
        fin_balance: finBalance,
        received_date: parseDate(cell(row, COL_COMPLETED)),
        notes: mergeNotes(noteChunks),
        show_name: isShowTab ? tabShowName : null,
        _source_tab: sheetName,
      };

      if (isOrderNumber(rawKey)) {
        if (status !== "delivered") data.status = "on_order";
        const key = rawKey.toUpperCase();
        data.order_number = key;
        if (!onOrder.has(key)) onOrder.set(key, data);
      } else {
        data.serial_number = rawKey;
        if (!serialized.has(rawKey)) serialized.set(rawKey, data);
      }
    }
  }

  return { serialized: [...serialized.values()], onOrder: [...onOrder.values()] };
}
