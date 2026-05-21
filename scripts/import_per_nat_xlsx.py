#!/usr/bin/env python3
"""
Import all 454 Per Nat rows from Natalie's XLSX into per_nat_entries.

Run AFTER migration 085_per_nat_entries.sql is applied.

For each XLSX row:
  1. Fuzzy-match against contracts table by customer last name.
  2. If matched → link contract_id (use first preference: not already in
     per_nat_entries via contract_flag backfill).
  3. If unmatched → contract_id stays NULL (XLSX-only entry).

Also extracts the salesperson name from the notes column (XLSX rows often
start with "Tom's Deal." / "Conner Brady's Deal." etc.) so the salesperson
filter on the Per Nat page works even for unlinked rows.
"""

import os
import re
import sys
import warnings
from datetime import datetime
from pathlib import Path

try:
    from openpyxl import load_workbook
    from supabase import create_client
except ImportError as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)

warnings.filterwarnings("ignore")

XLSX_PATH = "/Users/williedowns/Downloads/Per Nat.xlsx"

# Match patterns like "Tom's Deal.", "Conner Brady's Deal.", "Mark Long's Deal."
SALESPERSON_RX = re.compile(r"^([A-Z][a-zA-Z'\s\-]{1,30})\'s\s+Deal\b")


def norm(s):
    if not s:
        return ""
    return re.sub(r"[^a-z0-9]", "", s.lower())


def name_keys(raw):
    if not raw:
        return set()
    s = re.sub(r"\([^)]*\)", " ", raw)
    s = re.sub(r"[/&,]", " ", s)
    tokens = [t for t in s.split() if len(t) > 1]
    keys = set()
    if len(tokens) >= 1:
        keys.add(norm(tokens[-1]))
    if len(tokens) >= 2:
        keys.add(norm(tokens[-2] + tokens[-1]))
    return keys


def extract_salesperson(notes):
    if not notes:
        return None
    m = SALESPERSON_RX.match(notes.strip())
    if m:
        return m.group(1).strip()
    return None


def parse_date(raw):
    if not raw:
        return None
    s = str(raw).strip()
    # Already ISO?
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    return None


def load_xlsx_rows(path, sheet_name, status):
    wb = load_workbook(path, data_only=True)
    if sheet_name not in wb.sheetnames:
        return []
    ws = wb[sheet_name]
    rows = []
    for r in range(2, ws.max_row + 1):
        date_v = ws.cell(r, 1).value
        timeframe = ws.cell(r, 2).value
        customer = ws.cell(r, 3).value
        serial = ws.cell(r, 4).value
        model = ws.cell(r, 5).value
        color = ws.cell(r, 6).value
        skirt = ws.cell(r, 7).value
        notes = ws.cell(r, 8).value
        fierce = ws.cell(r, 10).value
        if not customer or not isinstance(customer, str):
            continue
        cn = customer.strip()
        if len(cn) < 3 or cn.startswith("="):
            continue
        rows.append({
            "sale_date": parse_date(date_v),
            "timeframe_text": str(timeframe).strip() if timeframe else None,
            "customer_name": cn,
            "_keys": list(name_keys(cn)),
            "serial_number": str(serial).strip() if serial else None,
            "model": str(model).strip() if model else None,
            "color": str(color).strip() if color else None,
            "skirt": str(skirt).strip() if skirt else None,
            "notes": str(notes).strip() if notes else None,
            "fierce_notes": str(fierce).strip() if fierce else None,
            "salesperson_name": extract_salesperson(str(notes) if notes else None),
            "status": status,
            "reason": "low_deposit" if notes and "low deposit" in notes.lower() else (
                "future_delivery" if timeframe else "manual"
            ),
            "source": "xlsx_import",
        })
    return rows


def fetch_contracts_index(sb):
    """Return a dict of name-key → list of (contract_id, status, already_linked)."""
    index = {}
    page_size = 1000
    start = 0
    while True:
        result = (
            sb.table("contracts")
            .select("id, status, total, customer:customers(first_name, last_name)")
            .range(start, start + page_size - 1)
            .execute()
        )
        batch = result.data or []
        for c in batch:
            cust = c.get("customer") or {}
            first = (cust.get("first_name") or "").strip()
            last = (cust.get("last_name") or "").strip()
            keys = set()
            if last:
                keys.add(norm(last))
            if first and last:
                keys.add(norm(first + last))
            for k in keys:
                index.setdefault(k, []).append(c)
        if len(batch) < page_size:
            break
        start += page_size
    # Get already-linked contract IDs to avoid duplicate links
    already = set()
    page_size = 1000
    start = 0
    while True:
        result = (
            sb.table("per_nat_entries")
            .select("contract_id")
            .not_.is_("contract_id", "null")
            .range(start, start + page_size - 1)
            .execute()
        )
        batch = result.data or []
        for r in batch:
            already.add(r["contract_id"])
        if len(batch) < page_size:
            break
        start += page_size
    return index, already


def main():
    env_path = Path(__file__).parent.parent / ".env.local"
    for line in env_path.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

    sb = create_client(
        os.environ["NEXT_PUBLIC_SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )

    print("=== Per Nat XLSX import ===")
    print("Loading XLSX sheets...")
    active = load_xlsx_rows(XLSX_PATH, "Per NatTim", "active")
    completed = load_xlsx_rows(XLSX_PATH, "Completed", "completed")
    cancelled = load_xlsx_rows(XLSX_PATH, "Cancelled", "cancelled")
    all_rows = active + completed + cancelled
    print(f"  Active: {len(active)}, Completed: {len(completed)}, Cancelled: {len(cancelled)}")
    print(f"  Total: {len(all_rows)}")

    print("Indexing existing contracts and per_nat_entries...")
    index, already_linked = fetch_contracts_index(sb)
    print(f"  {len(already_linked)} entries already linked to a contract")

    matched = 0
    unmatched = 0
    inserts = []
    for row in all_rows:
        # Find a candidate contract
        candidates = []
        for k in row["_keys"]:
            for c in index.get(k, []):
                if c["id"] in already_linked:
                    continue
                candidates.append(c)
        # Deduplicate, prefer non-cancelled
        seen = set()
        uniq = []
        for c in candidates:
            if c["id"] not in seen:
                seen.add(c["id"])
                uniq.append(c)
        uniq.sort(key=lambda c: (
            c.get("status") in ("cancelled", "delivered"),
            -(c.get("total") or 0),
        ))

        link_id = None
        if uniq:
            link_id = uniq[0]["id"]
            already_linked.add(link_id)  # don't link two XLSX rows to same contract
            matched += 1
        else:
            unmatched += 1

        record = {
            "contract_id": link_id,
            "source": row["source"],
            "sale_date": row["sale_date"],
            "customer_name": row["customer_name"],
            "model": row["model"],
            "color": row["color"],
            "skirt": row["skirt"],
            "serial_number": row["serial_number"],
            "salesperson_name": row["salesperson_name"],
            "timeframe_text": row["timeframe_text"],
            "notes": row["notes"],
            "fierce_notes": row["fierce_notes"],
            "status": row["status"],
            "reason": row["reason"],
        }
        inserts.append(record)

    print(f"  Matched to a contract: {matched}")
    print(f"  Unmatched (XLSX-only): {unmatched}")
    print()

    if "--dry-run" in sys.argv:
        print("--dry-run: not inserting. Sample 3 inserts:")
        for r in inserts[:3]:
            print(f"  {r}")
        return

    print(f"Inserting {len(inserts)} rows into per_nat_entries...")
    # Batch in chunks of 100
    batch_size = 100
    inserted = 0
    for i in range(0, len(inserts), batch_size):
        chunk = inserts[i:i + batch_size]
        result = sb.table("per_nat_entries").insert(chunk).execute()
        inserted += len(result.data or [])
        print(f"  Inserted batch {i // batch_size + 1}: {len(result.data or [])} rows (running total: {inserted})")

    print()
    print(f"=== Done: {inserted} entries imported ===")


if __name__ == "__main__":
    main()
