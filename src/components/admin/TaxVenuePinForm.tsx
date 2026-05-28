"use client";

/**
 * TaxVenuePinForm — admin tool to look up a tax rate for a venue and pin it
 * into tax_show_locations.
 *
 * Flow:
 *   1. Admin enters venue name + address (state/zip/street/city)
 *   2. Clicks "Look up rate" → POST /api/tax/lookup
 *   3. UI displays returned combined rate + jurisdiction breakdown + warnings
 *   4. If outcome is high-confidence (tx_api/ks_api/ok_api), enable "Pin this venue"
 *   5. Pin click → POST /api/tax/venues → on success, parent page re-fetches list
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type StateCode = "TX" | "LA" | "OK" | "KS" | "AR";

interface JurisdictionBreakdown {
  name: string;
  type: string;
  rate: number;
}

interface LookupResult {
  outcome:
    | "show_location"
    | "tx_api"
    | "ks_api"
    | "ok_api"
    | "by_zip"
    | "requires_verification"
    | "no_data";
  combined_rate: number | null;
  state: StateCode;
  jurisdictions: JurisdictionBreakdown[];
  source: string | null;
  effective_date: string | null;
  warning: string | null;
  verified_by: string | null;
}

const HIGH_CONFIDENCE_OUTCOMES = new Set<LookupResult["outcome"]>([
  "tx_api",
  "ks_api",
  "ok_api",
  "show_location",
]);

export default function TaxVenuePinForm({
  currentUserEmail,
}: {
  currentUserEmail: string;
}) {
  const router = useRouter();
  const [venueName, setVenueName] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState<StateCode>("TX");
  const [zip, setZip] = useState("");
  const [notes, setNotes] = useState("");

  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"lookup" | "pin" | null>(null);

  async function runLookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLookup(null);
    if (!/^\d{5}$/.test(zip)) {
      setError("ZIP must be 5 digits");
      return;
    }
    setBusy("lookup");
    try {
      const res = await fetch("/api/tax/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state,
          zip,
          street_address: street.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? `Lookup failed (${res.status})`);
        return;
      }
      setLookup(body as LookupResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function pinVenue() {
    if (!lookup || lookup.combined_rate === null) return;
    setError(null);
    if (!venueName.trim()) {
      setError("Venue name required to pin");
      return;
    }
    if (!city.trim()) {
      setError("City required to pin");
      return;
    }
    setBusy("pin");
    try {
      const verifier = `${currentUserEmail} via ${lookup.source ?? "lookup"} on ${new Date()
        .toISOString()
        .slice(0, 10)}`;
      const res = await fetch("/api/tax/venues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venue_name: venueName.trim(),
          street_address: street.trim() || null,
          city: city.trim(),
          state,
          zip,
          combined_rate: lookup.combined_rate,
          jurisdictions: lookup.jurisdictions,
          verified_by: verifier,
          verification_notes: notes.trim() || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? `Pin failed (${res.status})`);
        return;
      }
      // Reset + refresh list
      setVenueName("");
      setStreet("");
      setCity("");
      setZip("");
      setNotes("");
      setLookup(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const highConfidence = lookup && HIGH_CONFIDENCE_OUTCOMES.has(lookup.outcome);
  const isLA = state === "LA";

  return (
    <Card className="border-2 border-[#00929C]/20">
      <CardContent className="space-y-4 p-5">
        <div>
          <h2 className="text-lg font-bold text-[#010F21]">Pin a tax venue</h2>
          <p className="text-xs text-slate-500 mt-1">
            Look up a rate at a show address, then save the verified rate so
            future contracts at the same venue skip the live API call.
          </p>
        </div>

        <form onSubmit={runLookup} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700">
              Venue name (required to pin) *
            </label>
            <Input
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              placeholder="e.g. Texas State Fair Park"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">
                Street address (required for live lookup)
              </label>
              <Input
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="3921 Martin Luther King Jr Blvd"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">City</label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Dallas"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">State</label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value as StateCode)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="TX">TX</option>
                <option value="LA">LA</option>
                <option value="OK">OK</option>
                <option value="KS">KS</option>
                <option value="AR">AR</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-700">ZIP</label>
              <Input
                value={zip}
                onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                placeholder="75215"
                maxLength={5}
              />
            </div>
          </div>

          {isLA && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              Louisiana home-rule parishes — the state lookup is not reliable.
              Call the destination parish&apos;s Sales Tax Department to verify
              the combined rate, then enter it below by hand (use Notes to
              record who you spoke with).
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-700">
              Verification notes (optional)
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Verified with Ian Allena 2026-05-27"
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={busy !== null}>
              {busy === "lookup" ? "Looking up..." : "Look up rate"}
            </Button>
            {lookup && highConfidence && (
              <Button
                type="button"
                onClick={pinVenue}
                disabled={busy !== null}
                className="bg-[#00929C] hover:bg-[#00929C]/90"
              >
                {busy === "pin" ? "Pinning..." : "Pin this venue"}
              </Button>
            )}
          </div>
        </form>

        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
            {error}
          </div>
        )}

        {lookup && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-2">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold text-[#010F21]">
                {lookup.combined_rate !== null
                  ? `${(lookup.combined_rate * 100).toFixed(3)}%`
                  : "—"}
              </p>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded ${
                  highConfidence
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {lookup.outcome}
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Source: {lookup.source ?? "—"}
              {lookup.effective_date ? ` · Effective ${lookup.effective_date}` : ""}
            </p>
            {lookup.warning && (
              <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                ⚠ {lookup.warning}
              </p>
            )}
            {lookup.jurisdictions.length > 0 && (
              <table className="w-full text-xs mt-2">
                <thead>
                  <tr className="text-slate-500">
                    <th className="text-left font-medium pb-1">Jurisdiction</th>
                    <th className="text-left font-medium pb-1">Type</th>
                    <th className="text-right font-medium pb-1">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {lookup.jurisdictions.map((j, i) => (
                    <tr key={`${j.name}-${i}`} className="border-t border-slate-200">
                      <td className="py-1">{j.name}</td>
                      <td className="py-1 text-slate-500">{j.type}</td>
                      <td className="py-1 text-right">
                        {(j.rate * 100).toFixed(3)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
