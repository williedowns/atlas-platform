#!/usr/bin/env python3
"""Diff the master XLSX against what's actually in inventory_units in Supabase.

Uses SUPABASE_SERVICE_ROLE_KEY from .env.local to read the table directly via
PostgREST. Reports per-row mismatches and orphans in both directions.

Usage: python3 atlas-platform/scripts/verify_inventory_sync.py [xlsx_path]
"""

from __future__ import annotations

import json
import os
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

# Reuse the canonical extraction logic from the sync generator.
sys.path.insert(0, str(Path(__file__).parent))
from gen_inventory_sync import (   # noqa: E402
    DEFAULT_XLSX, TAB_MAP, extract_rows,
)

PROJECT_REF = "cmlfptrtzxvwzkdhvoqh"
POSTGREST_URL = f"https://{PROJECT_REF}.supabase.co/rest/v1"
ENV_LOCAL = Path(__file__).resolve().parent.parent / ".env.local"

# Fields to compare on each matching row.
COMPARE_FIELDS = [
    "status",
    "location_name",     # resolved from location_id via locations table
    "model_code",
    "shell_color",
    "cabinet_color",
    "wrap_status",
    "customer_name",
    "fin_balance",
    "received_date",
    "notes",
]


def load_service_key() -> str:
    """Pull SUPABASE_SERVICE_ROLE_KEY from .env.local."""
    if not ENV_LOCAL.exists():
        sys.exit(f"ERROR: {ENV_LOCAL} not found")
    for line in ENV_LOCAL.read_text().splitlines():
        line = line.strip()
        if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("ERROR: SUPABASE_SERVICE_ROLE_KEY not in .env.local")


def http_get(path: str, key: str) -> list[dict]:
    """GET a PostgREST endpoint, return parsed JSON."""
    url = f"{POSTGREST_URL}{path}"
    req = urllib.request.Request(url, headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        sys.exit(f"HTTP {e.code} for {url}\nBody: {body}")


def fetch_all_inventory(key: str) -> list[dict]:
    """Page through inventory_units (PostgREST default limit is 1000)."""
    all_rows: list[dict] = []
    page_size = 1000
    offset = 0
    select = (
        "serial_number,order_number,status,location_id,model_code,shell_color,"
        "cabinet_color,wrap_status,customer_name,fin_balance,"
        "received_date,notes"
    )
    while True:
        url = f"/inventory_units?select={select}&order=id.asc&limit={page_size}&offset={offset}"
        chunk = http_get(url, key)
        all_rows.extend(chunk)
        if len(chunk) < page_size:
            break
        offset += page_size
    return all_rows


def fetch_locations(key: str) -> dict[str, str]:
    """Returns location_id -> name."""
    rows = http_get("/locations?select=id,name", key)
    return {r["id"]: r["name"] for r in rows}


def norm(v) -> str:
    """Normalize a value for comparison: None and '' both → '' (string)."""
    if v is None:
        return ""
    return str(v).strip()


def compare_row(xlsx_row: dict, db_row: dict, loc_map: dict[str, str]) -> list[tuple[str, str, str]]:
    """Return list of (field, xlsx_value, db_value) mismatches."""
    diffs: list[tuple[str, str, str]] = []
    for field in COMPARE_FIELDS:
        if field == "location_name":
            db_val = loc_map.get(db_row.get("location_id"), "")
        else:
            db_val = db_row.get(field)
        x_val = xlsx_row.get(field)
        if norm(x_val) != norm(db_val):
            diffs.append((field, norm(x_val), norm(db_val)))
    return diffs


def main() -> None:
    xlsx_path = Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else DEFAULT_XLSX
    if not xlsx_path.exists():
        sys.exit(f"ERROR: XLSX not found: {xlsx_path}")

    key = load_service_key()

    print(f"Reading XLSX: {xlsx_path}", file=sys.stderr)
    serialized, on_order = extract_rows(xlsx_path)
    xlsx_by_serial = {r["serial_number"]: r for r in serialized}
    xlsx_by_order  = {r["order_number"]:  r for r in on_order}
    print(f"  XLSX: {len(xlsx_by_serial)} serialized + {len(xlsx_by_order)} on-order", file=sys.stderr)

    print("Fetching from Supabase...", file=sys.stderr)
    loc_map = fetch_locations(key)
    db_rows = fetch_all_inventory(key)
    print(f"  DB:   {len(db_rows)} total rows", file=sys.stderr)

    db_by_serial = {r["serial_number"]: r for r in db_rows if r.get("serial_number")}
    db_by_order  = {r["order_number"]:  r for r in db_rows if not r.get("serial_number") and r.get("order_number")}

    # ── 1. Missing from DB ────────────────────────────────────────────────────
    missing_serials = sorted(set(xlsx_by_serial) - set(db_by_serial))
    missing_orders  = sorted(set(xlsx_by_order)  - set(db_by_order))

    # ── 2. Extra in DB (not in XLSX) ─────────────────────────────────────────
    extra_serials = sorted(set(db_by_serial) - set(xlsx_by_serial))
    extra_orders  = sorted(set(db_by_order)  - set(xlsx_by_order))

    # ── 3. Field mismatches (only on matched keys) ───────────────────────────
    mismatch_summary: dict[str, int] = defaultdict(int)
    mismatch_samples: dict[str, list] = defaultdict(list)
    matched = 0

    for serial in set(xlsx_by_serial) & set(db_by_serial):
        diffs = compare_row(xlsx_by_serial[serial], db_by_serial[serial], loc_map)
        if not diffs:
            matched += 1
            continue
        for field, x, d in diffs:
            mismatch_summary[field] += 1
            if len(mismatch_samples[field]) < 3:
                mismatch_samples[field].append((serial, x, d))

    for order in set(xlsx_by_order) & set(db_by_order):
        diffs = compare_row(xlsx_by_order[order], db_by_order[order], loc_map)
        if not diffs:
            matched += 1
            continue
        for field, x, d in diffs:
            mismatch_summary[field] += 1
            if len(mismatch_samples[field]) < 3:
                mismatch_samples[field].append((order, x, d))

    # ── Report ────────────────────────────────────────────────────────────────
    print()
    print("=" * 70)
    print("INVENTORY DIFF: XLSX vs DB")
    print("=" * 70)
    print(f"  XLSX total:         {len(xlsx_by_serial) + len(xlsx_by_order):,}")
    print(f"  DB total:           {len(db_rows):,}")
    print(f"  Perfect matches:    {matched:,}")
    print(f"  Field mismatches:   {sum(mismatch_summary.values()):,} across "
          f"{len([k for k in mismatch_summary if mismatch_summary[k]])} fields")
    print(f"  Missing from DB:    {len(missing_serials)} serials + {len(missing_orders)} orders")
    print(f"  Extra in DB:        {len(extra_serials)} serials + {len(extra_orders)} orders")
    print()

    if mismatch_summary:
        print("── Field mismatches ──")
        for field in sorted(mismatch_summary, key=lambda k: -mismatch_summary[k]):
            print(f"  {field:22s} {mismatch_summary[field]:5d} rows differ")
            for key_, x, d in mismatch_samples[field][:2]:
                x_short = (x[:60] + "…") if len(x) > 60 else x
                d_short = (d[:60] + "…") if len(d) > 60 else d
                print(f"      {key_}: xlsx={x_short!r}  db={d_short!r}")
        print()

    if missing_serials:
        print(f"── Missing from DB ({len(missing_serials)} serials, first 10) ──")
        for s in missing_serials[:10]:
            r = xlsx_by_serial[s]
            print(f"  {s}  ({r['_source_tab']}, status={r['status']}, model={r['model_code']})")
        print()

    if missing_orders:
        print(f"── Missing from DB ({len(missing_orders)} orders) ──")
        for o in missing_orders[:10]:
            print(f"  {o}")
        print()

    if extra_serials:
        print(f"── Extra in DB ({len(extra_serials)} serials, first 10) — "
              "rows in DB that are NOT in the new XLSX ──")
        for s in extra_serials[:10]:
            r = db_by_serial[s]
            print(f"  {s}  (status={r.get('status')}, model={r.get('model_code')}, "
                  f"customer={r.get('customer_name')})")
        print()


if __name__ == "__main__":
    main()
