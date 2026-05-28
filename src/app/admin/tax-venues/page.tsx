export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import AppShell from "@/components/layout/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import TaxVenuePinForm from "@/components/admin/TaxVenuePinForm";

interface VenueRow {
  id: string;
  venue_name: string;
  street_address: string | null;
  city: string;
  state: string;
  zip: string;
  combined_rate: number;
  jurisdictions: Array<{ name: string; type: string; rate: number }> | null;
  verified_by: string;
  verified_at: string;
  verification_notes: string | null;
}

export default async function AdminTaxVenuesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "manager", "bookkeeper"].includes(profile.role)) {
    redirect("/dashboard");
  }

  const { data: venues } = await supabase
    .from("tax_show_locations")
    .select(
      "id, venue_name, street_address, city, state, zip, combined_rate, jurisdictions, verified_by, verified_at, verification_notes"
    )
    .eq("active", true)
    .order("verified_at", { ascending: false });

  const rows = (venues ?? []) as VenueRow[];

  return (
    <AppShell
      role={profile.role}
      userName={(profile as { full_name?: string }).full_name ?? undefined}
    >
      <AppHeader
        title="Tax venues"
        subtitle="Pin verified sales tax rates for known show locations"
        backHref="/admin"
      />

      <main className="px-5 py-6 space-y-5 max-w-4xl mx-auto pb-24">
        <TaxVenuePinForm currentUserEmail={user.email ?? "unknown"} />

        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-base font-bold text-[#010F21]">
              Pinned venues ({rows.length})
            </h2>
            <Link
              href="/admin"
              className="text-xs text-[#00929C] hover:underline"
            >
              ← Back to Admin
            </Link>
          </div>

          {rows.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-slate-500">
                No venues pinned yet. Use the form above to look up and pin a
                rate.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {rows.map((v) => (
                <VenueRow key={v.id} v={v} />
              ))}
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}

function VenueRow({ v }: { v: VenueRow }) {
  const verifiedDate = v.verified_at?.slice(0, 10) ?? "";
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-[#010F21] truncate">
              {v.venue_name}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {v.street_address ? `${v.street_address}, ` : ""}
              {v.city}, {v.state} {v.zip}
            </p>
          </div>
          <p className="text-lg font-bold text-[#00929C] shrink-0">
            {(v.combined_rate * 100).toFixed(3)}%
          </p>
        </div>

        {v.jurisdictions && v.jurisdictions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {v.jurisdictions.map((j, i) => (
              <span
                key={`${j.name}-${i}`}
                className="text-[10px] font-medium bg-slate-100 text-slate-700 rounded px-1.5 py-0.5"
                title={`${j.type} · ${(j.rate * 100).toFixed(3)}%`}
              >
                {j.name} {(j.rate * 100).toFixed(2)}%
              </span>
            ))}
          </div>
        )}

        <p className="text-[11px] text-slate-400 leading-tight">
          Verified by {v.verified_by} on {verifiedDate}
          {v.verification_notes ? ` · ${v.verification_notes}` : ""}
        </p>
      </CardContent>
    </Card>
  );
}
