/**
 * TaxRateProvenance — read-only display of WHERE a contract's tax rate came from.
 *
 * Reads the audit-log columns added in migration 098:
 *   tax_rate_source
 *   tax_rate_effective_date
 *   tax_rate_jurisdictions
 *   tax_rate_resolved_at
 *
 * Renders a color-coded card with the rate provenance + jurisdiction breakdown
 * so admins (and auditors) can see at a glance HOW a rate was determined.
 *
 * If source is NULL (legacy / pre-audit-log contract), shows a gray "no
 * provenance" notice. If source is `manual_admin_override`, shows an amber
 * warning — manual overrides aren't backed by a state DOR lookup.
 */
import { Card, CardContent } from "@/components/ui/card";

interface Jurisdiction {
  name: string;
  type: string;
  rate: number;
}

interface Props {
  taxRate: number;
  taxRateSource: string | null;
  taxRateEffectiveDate: string | null; // ISO date or DOR-format string
  taxRateJurisdictions: Jurisdiction[] | null;
  taxRateResolvedAt: string | null; // ISO timestamp
}

interface SourceMeta {
  label: string;
  badgeClass: string;
  cardClass: string;
  description: string;
  trust: "high" | "medium" | "low" | "unknown";
}

function metaForSource(source: string | null): SourceMeta {
  if (!source) {
    return {
      label: "No provenance",
      badgeClass: "bg-slate-100 text-slate-600",
      cardClass: "border-slate-200",
      description:
        "This contract predates the audit log. Rate origin is unknown. New contracts will capture this automatically.",
      trust: "unknown",
    };
  }
  if (source.startsWith("show_location:")) {
    return {
      label: "Pinned venue",
      badgeClass: "bg-blue-100 text-blue-800",
      cardClass: "border-blue-200",
      description:
        "Rate from a verified Atlas venue (pinned in Tax Venues). Reliable for repeat shows at this location.",
      trust: "high",
    };
  }
  if (source === "tx_comptroller_api") {
    return {
      label: "TX Comptroller API",
      badgeClass: "bg-emerald-100 text-emerald-800",
      cardClass: "border-emerald-200",
      description:
        "Live lookup against Texas Comptroller's rate locator. State-authoritative.",
      trust: "high",
    };
  }
  if (source === "ks_dor_lookup") {
    return {
      label: "KS DOR lookup",
      badgeClass: "bg-emerald-100 text-emerald-800",
      cardClass: "border-emerald-200",
      description:
        "Live lookup against Kansas Department of Revenue. State-authoritative.",
      trust: "high",
    };
  }
  if (source === "ok_csa_rate_locator") {
    return {
      label: "OK rate locator",
      badgeClass: "bg-emerald-100 text-emerald-800",
      cardClass: "border-emerald-200",
      description:
        "Live lookup against Oklahoma OU CSA rate locator. State-authoritative.",
      trust: "high",
    };
  }
  if (source === "ar_gis_lookup") {
    return {
      label: "AR GIS lookup",
      badgeClass: "bg-emerald-100 text-emerald-800",
      cardClass: "border-emerald-200",
      description:
        "Live lookup against Arkansas DFA / GIS rate locator. State-authoritative.",
      trust: "high",
    };
  }
  if (source === "manual_admin_override") {
    return {
      label: "Manual admin override",
      badgeClass: "bg-amber-100 text-amber-800",
      cardClass: "border-amber-300",
      description:
        "An admin set this rate by hand. No state DOR backing. Verify before audit.",
      trust: "medium",
    };
  }
  if (source === "legacy_default") {
    return {
      label: "Legacy default",
      badgeClass: "bg-slate-100 text-slate-700",
      cardClass: "border-slate-200",
      description:
        "Pre-lookup-system default rate. Should be migrated to a verified source.",
      trust: "low",
    };
  }
  return {
    label: source,
    badgeClass: "bg-slate-100 text-slate-700",
    cardClass: "border-slate-200",
    description: "Unrecognized source. Check the audit log.",
    trust: "unknown",
  };
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function TaxRateProvenance({
  taxRate,
  taxRateSource,
  taxRateEffectiveDate,
  taxRateJurisdictions,
  taxRateResolvedAt,
}: Props) {
  const meta = metaForSource(taxRateSource);
  const jurisdictions = Array.isArray(taxRateJurisdictions) ? taxRateJurisdictions : [];

  return (
    <Card className={`border-2 ${meta.cardClass}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-[#010F21]">Tax rate provenance</p>
              <span
                className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${meta.badgeClass}`}
              >
                {meta.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">{meta.description}</p>
          </div>
          <p className="text-lg font-bold text-[#00929C] shrink-0">
            {(taxRate * 100).toFixed(3)}%
          </p>
        </div>

        {(taxRateResolvedAt || taxRateEffectiveDate) && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            {taxRateResolvedAt && (
              <div>
                <p className="text-slate-500">Resolved</p>
                <p className="text-slate-800 font-medium">
                  {formatTimestamp(taxRateResolvedAt)}
                </p>
              </div>
            )}
            {taxRateEffectiveDate && (
              <div>
                <p className="text-slate-500">Source effective date</p>
                <p className="text-slate-800 font-medium">{taxRateEffectiveDate}</p>
              </div>
            )}
          </div>
        )}

        {jurisdictions.length > 0 && (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="text-left font-medium pb-1">Jurisdiction</th>
                <th className="text-left font-medium pb-1">Type</th>
                <th className="text-right font-medium pb-1">Rate</th>
              </tr>
            </thead>
            <tbody>
              {jurisdictions.map((j, i) => (
                <tr key={`${j.name}-${i}`} className="border-t border-slate-200">
                  <td className="py-1">{j.name}</td>
                  <td className="py-1 text-slate-500">{j.type}</td>
                  <td className="py-1 text-right">
                    {(j.rate * 100).toFixed(3)}%
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 font-bold">
                <td className="py-1">Combined</td>
                <td></td>
                <td className="py-1 text-right">
                  {(taxRate * 100).toFixed(3)}%
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {meta.trust === "medium" && (
          <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
            ⚠ This rate was set manually. Before relying on it for audit, verify against the state DOR lookup at the show address.
          </div>
        )}
        {meta.trust === "low" && (
          <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
            ⚠ Legacy default rate. Re-resolve via the Tax Venues lookup at the next admin opportunity.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
