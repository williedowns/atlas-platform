// Fetches the live "Hot Tub & Swim Spa Inventory" Google Sheet as an xlsx
// buffer, server-side. Relies on the sheet being shared "anyone with the link
// can view" — the export endpoint then returns the file without auth. If
// sharing is tightened, Google serves an HTML sign-in page instead, which we
// detect and surface as a clear error rather than letting the parser choke.

const EXPORT_BASE = "https://docs.google.com/spreadsheets/d";

export function getSheetId(): string {
  const id = process.env.INVENTORY_SHEET_ID;
  if (!id) {
    throw new Error(
      "INVENTORY_SHEET_ID is not configured. Set it to the Google Sheet ID in the environment.",
    );
  }
  return id;
}

export async function fetchInventoryWorkbook(): Promise<ArrayBuffer> {
  const id = getSheetId();
  const url = `${EXPORT_BASE}/${id}/export?format=xlsx`;

  const res = await fetch(url, { redirect: "follow", cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch inventory sheet (HTTP ${res.status}).`);
  }

  const buf = await res.arrayBuffer();
  // Real xlsx files are ZIP archives starting with "PK\x03\x04". A login wall
  // returns HTML ("<!do..."), so the first bytes tell us which we got.
  const head = new Uint8Array(buf.slice(0, 4));
  const isZip = head[0] === 0x50 && head[1] === 0x4b; // "PK"
  if (!isZip) {
    throw new Error(
      "Google did not return a spreadsheet file. Confirm the sheet is shared " +
        "'Anyone with the link can view' and INVENTORY_SHEET_ID is correct.",
    );
  }
  return buf;
}
