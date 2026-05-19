export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { Card } from "@/components/ui/card";
import ShowSalesList, { type ShowRow } from "./ShowSalesList";

/**
 * "Show Sales" landing — Lori's daily entry point.
 *
 * Lists every show (most recent first), with per-show contract counts and
 * primary "Open Workbook" / secondary ".xlsx download" actions.
 */
export default async function ShowSalesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, organization:organizations(role_permissions)")
    .eq("id", user.id)
    .single();

  const allowed = ["admin", "manager", "sales_admin"];
  if (!allowed.includes(profile?.role as string)) redirect("/dashboard");

  // ── Fetch all shows ────────────────────────────────────────────────────
  // .limit(500) covers Atlas's full historical + active footprint.
  const { data: showsRaw } = await supabase
    .from("shows")
    .select("id, name, venue_name, city, state, start_date, end_date")
    .order("start_date", { ascending: false })
    .limit(500);

  // ── Per-show contract counts ───────────────────────────────────────────
  // Naïve `.in()` on contracts hit the postgrest 1000-row default, so 2k+
  // contracts came back truncated and many shows showed "No deals yet"
  // when they actually had data. Paginate with .range() to grab everything.
  const showIds = (showsRaw ?? []).map((s) => s.id);
  const countByShow = new Map<string, number>();
  if (showIds.length) {
    const PAGE = 1000;
    let offset = 0;
    while (true) {
      const { data: page, error } = await supabase
        .from("contracts")
        .select("show_id")
        .in("show_id", showIds)
        .range(offset, offset + PAGE - 1);
      if (error || !page || page.length === 0) break;
      page.forEach((row) => {
        if (row.show_id) {
          countByShow.set(row.show_id, (countByShow.get(row.show_id) ?? 0) + 1);
        }
      });
      if (page.length < PAGE) break;
      offset += PAGE;
    }
  }

  const shows: ShowRow[] = (showsRaw ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    venue_name: s.venue_name ?? null,
    city: s.city ?? null,
    state: s.state ?? null,
    start_date: s.start_date,
    end_date: s.end_date,
    contract_count: countByShow.get(s.id) ?? 0,
  }));

  const totalContracts = shows.reduce((sum, s) => sum + s.contract_count, 0);

  const orgPerms = (profile?.organization as { role_permissions?: unknown } | null)
    ?.role_permissions;

  return (
    <AppShell
      role={profile?.role}
      userName={profile?.full_name}
      orgPerms={orgPerms as never}
    >
      <AppHeader
        title="Show Sales"
        subtitle={`${shows.length} shows · ${totalContracts.toLocaleString()} contracts on file`}
      />

      <main className="px-5 py-6 max-w-5xl mx-auto pb-24 space-y-6">
        <Card className="p-5 bg-gradient-to-br from-[#010F21] to-[#024452] text-white">
          <div className="flex items-start gap-4">
            <div className="text-3xl">📊</div>
            <div className="text-sm leading-relaxed">
              <p className="font-semibold mb-1">
                Lori&apos;s show-sales workbooks, in-system.
              </p>
              <p className="text-white/80">
                Click <span className="font-semibold text-white">Open Workbook</span> on
                any show to view and edit its live sales spreadsheet — autosaves as you
                type. Click{" "}
                <span className="font-semibold text-white">Download .xlsx</span> to grab
                a snapshot of the full 9-tab Lori-format workbook with current data and
                all override values merged in.
              </p>
            </div>
          </div>
        </Card>

        <ShowSalesList shows={shows} />
      </main>
    </AppShell>
  );
}
