export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/utils";

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

  // sales_admin coming later — for now, admin + manager can see this section
  const allowed = ["admin", "manager", "sales_admin"];
  if (!allowed.includes(profile?.role as string)) redirect("/dashboard");

  // Pull every show, most recent first. We don't filter to "active" here —
  // Lori needs historical visibility too.
  const { data: shows } = await supabase
    .from("shows")
    .select("id, name, venue_name, city, state, start_date, end_date, active")
    .order("start_date", { ascending: false })
    .limit(200);

  // For each show, count its contracts so the manager can see "is there
  // anything to export?" at a glance.
  const showIds = (shows ?? []).map((s) => s.id);
  const { data: counts } = showIds.length
    ? await supabase
        .from("contracts")
        .select("show_id, id")
        .in("show_id", showIds)
    : { data: [] };
  const countByShow = new Map<string, number>();
  (counts ?? []).forEach((row) => {
    countByShow.set(row.show_id, (countByShow.get(row.show_id) ?? 0) + 1);
  });

  const today = new Date().toISOString().split("T")[0];
  const upcoming = (shows ?? []).filter((s) => s.end_date >= today);
  const past = (shows ?? []).filter((s) => s.end_date < today);

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
        subtitle={`${shows?.length ?? 0} shows · ${counts?.length ?? 0} contracts on file`}
      />

      <main className="px-5 py-6 max-w-5xl mx-auto pb-24 space-y-8">
        <Card className="p-5 bg-gradient-to-br from-[#010F21] to-[#024452] text-white">
          <div className="flex items-start gap-4">
            <div className="text-3xl">📊</div>
            <div className="text-sm leading-relaxed">
              <p className="font-semibold mb-1">Lori&apos;s show-sales workbooks, in-system.</p>
              <p className="text-white/70">
                Click any show below to view or edit its sales data. Click{" "}
                <span className="font-semibold text-white">Export XLSX</span> to download
                the byte-for-byte match of the workbook you&apos;ve been emailing — same
                9 tabs, same formulas, same formatting.
              </p>
              <p className="text-white/60 mt-2 text-xs">
                Most contract data starts in the showroom or CRM; this section is where it
                gets reconciled, finalized, and exported. Many columns will be blank until
                the field-entry forms ship in Phase 1.
              </p>
            </div>
          </div>
        </Card>

        {/* Upcoming / Active shows */}
        {upcoming.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Upcoming &amp; Active ({upcoming.length})
            </h2>
            <div className="space-y-2">
              {upcoming.map((s) => (
                <ShowRow
                  key={s.id}
                  show={s}
                  contractCount={countByShow.get(s.id) ?? 0}
                  active
                />
              ))}
            </div>
          </section>
        )}

        {/* Past shows */}
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Past Shows ({past.length})
          </h2>
          {past.length === 0 ? (
            <Card>
              <EmptyState
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6a2 2 0 012-2h2a2 2 0 012 2v6m-6 0h6" />
                  </svg>
                }
                title="No past shows yet"
                description="Once shows happen, they'll appear here for review and export."
              />
            </Card>
          ) : (
            <div className="space-y-2">
              {past.map((s) => (
                <ShowRow
                  key={s.id}
                  show={s}
                  contractCount={countByShow.get(s.id) ?? 0}
                  active={false}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}

function ShowRow({
  show,
  contractCount,
  active,
}: {
  show: {
    id: string;
    name: string;
    venue_name?: string | null;
    city?: string | null;
    state?: string | null;
    start_date: string;
    end_date: string;
  };
  contractCount: number;
  active: boolean;
}) {
  const dateRange =
    show.start_date === show.end_date
      ? formatDate(show.start_date)
      : `${formatDate(show.start_date)} – ${formatDate(show.end_date)}`;

  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <Link href={`/admin/shows/${show.id}`} className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-slate-900 truncate">{show.name}</p>
            {active && <Badge variant="default">Active</Badge>}
            {contractCount > 0 ? (
              <Badge variant="accent">
                {contractCount} {contractCount === 1 ? "deal" : "deals"}
              </Badge>
            ) : (
              <Badge variant="outline">No deals yet</Badge>
            )}
          </div>
          <p className="text-sm text-slate-500 truncate">
            {show.venue_name ?? ""}
            {show.venue_name && (show.city || show.state) ? " · " : ""}
            {[show.city, show.state].filter(Boolean).join(", ")}
            {" · "}
            {dateRange}
          </p>
        </Link>
        <a
          href={`/api/admin/shows/${show.id}/spreadsheet`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#00929C] hover:bg-[#007a82] text-white text-xs font-semibold transition-colors whitespace-nowrap"
          title="Download Lori-format show sales XLSX"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
          </svg>
          Export XLSX
        </a>
      </CardContent>
    </Card>
  );
}
