# Tax client smoke tests

Live-endpoint smoke tests for the 4 state DOR lookup clients (`src/lib/tax/{tx,ks,ok,ar}*`). Each script hits real state government endpoints with a known address and verifies the response parser still finds the expected fields.

## Why these exist

The state DOR endpoints are scrape-based (KS/OK/AR HTML) or undocumented-public (TX). Any of them could change their response shape without notice. These smoke tests fail loudly when that happens — long before a real Atlas sale gets the wrong tax.

## How to run

```bash
# Run all 4 states (slowest — OK pacing dominates)
bun scripts/tax-tests/smoke-all.ts

# Individual states
bun scripts/tax-tests/tx.ts
bun scripts/tax-tests/ks.ts
bun scripts/tax-tests/ok.ts   # SLOW — OK CSA rate-limits, paces at 5s between requests
bun scripts/tax-tests/ar.ts
```

Each script exits non-zero if any assertion fails — wire into CI for nightly validation if desired.

## What gets tested

For each state, the script picks 4-10 known addresses and verifies:
- HTTP call succeeds (parser auth still works)
- Response parses without errors
- Combined rate is within plausible bounds for the state
- Jurisdiction breakdown is present and sums to combined (sanity check)
- Tyler-style low-confidence cases correctly flag (TX only)

## What to do when a test fails

1. Inspect the failing state's client file (`src/lib/tax/{state}Client.ts`)
2. Hit the state DOR endpoint manually with curl (commands in `docs/tax-system.md`)
3. Compare response to the parser's expected shape
4. Patch the parser — usually a 1-line regex or column-index fix
5. Re-run the smoke test to confirm

## Updating expected addresses

If a venue rate changes (state DOR updated their data), update the expected ranges in the relevant `{state}.ts` script. Don't change the parser unless its OUTPUT is wrong — only the expected VALUES should drift over time.

## CI wiring (when ready)

```yaml
# Example GitHub Actions step
- name: Tax parser smoke tests
  run: bun scripts/tax-tests/smoke-all.ts
  env:
    TX_COMPTROLLER_CLIENT_ID: ${{ secrets.TX_COMPTROLLER_CLIENT_ID }}
    TX_COMPTROLLER_CLIENT_SECRET: ${{ secrets.TX_COMPTROLLER_CLIENT_SECRET }}
```

Defaults are baked in for TX so the env vars are optional unless Texas rotates the public credentials.
