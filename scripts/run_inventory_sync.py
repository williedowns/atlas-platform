#!/usr/bin/env python3
"""Apply the inventory sync directly via Supabase REST API in batches.

Uses SUPABASE_SERVICE_ROLE_KEY. Avoids the SQL-Editor paste route entirely so
we get real success/failure feedback per batch instead of a vague "ran".

Strategy:
  - Serialized rows: bulk upsert via POST + Prefer: resolution=merge-duplicates
    on the existing serial_number unique constraint.
  - On-order rows (no serial): query by order_number, then PATCH if found
    else POST. No unique constraint on order_number to upsert against.
"""

from __future__ import annotations

import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from gen_inventory_sync import DEFAULT_XLSX, extract_rows   # noqa: E402

PROJECT_REF = "cmlfptrtzxvwzkdhvoqh"
BASE = f"https://{PROJECT_REF}.supabase.co/rest/v1"
ENV_LOCAL = Path(__file__).resolve().parent.parent / ".env.local"
BATCH_SIZE = 200

# Atlas Spas org. Required on every inventory_units row — RLS hides any row
# without it from the running app even when the service-role write succeeded.
ATLAS_ORG_ID = "1fd36038-0ead-491b-a03f-b438086ab39b"


def load_key() -> str:
    for line in ENV_LOCAL.read_text().splitlines():
        if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("missing SUPABASE_SERVICE_ROLE_KEY")


def request(method: str, path: str, key: str, body=None, prefer: str | None = None) -> tuple[int, bytes]:
    url = f"{BASE}{path}"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def resolve_location_ids(key: str) -> dict[str, str]:
    code, body = request("GET", "/locations?select=id,name", key)
    if code >= 300:
        sys.exit(f"locations fetch failed: {code} {body[:300]}")
    return {r["name"]: r["id"] for r in json.loads(body)}


def to_db_row(r: dict, loc_map: dict[str, str]) -> dict:
    out = {
        "serial_number":   r["serial_number"],
        "order_number":    r["order_number"],
        "location_id":     loc_map.get(r["location_name"]) if r.get("location_name") else None,
        "status":          r["status"],
        "model_code":      r["model_code"],
        "shell_color":     r["shell_color"],
        "cabinet_color":   r["cabinet_color"],
        "wrap_status":     r["wrap_status"],
        "customer_name":   r["customer_name"],
        "fin_balance":     r["fin_balance"],
        "received_date":   r["received_date"],
        "notes":           r["notes"],
        "organization_id": ATLAS_ORG_ID,
    }
    return out


def upsert_serialized(rows: list[dict], key: str, loc_map: dict[str, str]) -> None:
    total = len(rows)
    inserted_or_updated = 0
    failed_batches = 0
    for i in range(0, total, BATCH_SIZE):
        batch = [to_db_row(r, loc_map) for r in rows[i:i + BATCH_SIZE]]
        code, body = request(
            "POST",
            "/inventory_units?on_conflict=serial_number",
            key,
            body=batch,
            prefer="resolution=merge-duplicates,return=minimal",
        )
        if code >= 300:
            failed_batches += 1
            print(f"  batch {i//BATCH_SIZE + 1}: FAILED ({code}) {body.decode()[:200]}", file=sys.stderr)
        else:
            inserted_or_updated += len(batch)
        print(f"  serialized: {min(i+BATCH_SIZE,total):,}/{total:,}", file=sys.stderr, end="\r")
    print(file=sys.stderr)
    print(f"  done: {inserted_or_updated}/{total} rows, {failed_batches} failed batches", file=sys.stderr)


def upsert_on_order(rows: list[dict], key: str, loc_map: dict[str, str]) -> None:
    """Match by order_number — query, then PATCH or POST."""
    inserted = updated = failed = 0
    for r in rows:
        db_row = to_db_row(r, loc_map)
        order_num = db_row["order_number"]
        q = f"/inventory_units?order_number=eq.{urllib.parse.quote(order_num)}&serial_number=is.null&select=id"
        code, body = request("GET", q, key)
        if code >= 300:
            print(f"  query failed for {order_num}: {code} {body.decode()[:150]}", file=sys.stderr)
            failed += 1
            continue
        existing = json.loads(body)
        if existing:
            uid = existing[0]["id"]
            code, body = request(
                "PATCH",
                f"/inventory_units?id=eq.{uid}",
                key,
                body={k: v for k, v in db_row.items() if k != "serial_number"},
                prefer="return=minimal",
            )
            if code >= 300:
                print(f"  PATCH {order_num} failed: {code} {body.decode()[:150]}", file=sys.stderr)
                failed += 1
            else:
                updated += 1
        else:
            code, body = request("POST", "/inventory_units", key, body=[db_row], prefer="return=minimal")
            if code >= 300:
                print(f"  POST {order_num} failed: {code} {body.decode()[:150]}", file=sys.stderr)
                failed += 1
            else:
                inserted += 1
    print(f"  on-order: inserted={inserted}, updated={updated}, failed={failed}", file=sys.stderr)


def main() -> None:
    xlsx = Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else DEFAULT_XLSX
    key = load_key()

    print("Extracting XLSX rows...", file=sys.stderr)
    serialized, on_order = extract_rows(xlsx)
    print(f"  {len(serialized)} serialized + {len(on_order)} on-order", file=sys.stderr)

    print("Resolving locations...", file=sys.stderr)
    loc_map = resolve_location_ids(key)
    missing = {
        r["location_name"]
        for r in serialized + on_order
        if r.get("location_name") and r["location_name"] not in loc_map
    }
    if missing:
        sys.exit(f"locations missing in DB: {missing}")

    started = time.time()
    print("Upserting serialized rows...", file=sys.stderr)
    upsert_serialized(serialized, key, loc_map)
    print("Upserting on-order rows...", file=sys.stderr)
    upsert_on_order(on_order, key, loc_map)
    print(f"\nElapsed: {time.time() - started:.1f}s", file=sys.stderr)


if __name__ == "__main__":
    main()
