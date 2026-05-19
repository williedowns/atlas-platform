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

/**
 * "Show Sales" landing page — Lori's primary daily entry point.
 *
 * Lists every show, most recent first. Each row:
 *   - Primary action: Open Workbook → /shows/[id]/workbook (live editable)
 *   - Secondary action: Download .xlsx → /api/shows/[id]/spreadsheet
 *
 * The actual data lives in contracts + show_deal_overrides — this page is a
 * jump table.
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

  // sales_admin role to be added later. For now: admin + manager.
  const allowed = ["admin", "manager", "sales_admin"];
  if (!allowed.includes(profile?.role as string)) redirect("/dashboard");

  const { data: shows } = await supabase
    .from("shows")
    .select("id, name, venue_name, city, state, start_date, end_date, active")
    .order("start_date", { ascending: false })
    .limit(200);

  // Per-show contract counts so managers can tell at a glance "is there
  // anything to open here?"
  const showIds = (shows ?? []).map((s) => s.id);
  const { data: counts } = showIds.length
    ? await supabase.from("contracts").select("show_id, id").in("show_id", showIds)
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

        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Past Shows ({past.length})
          </h2>
          {past.length === 0 ? (
            <Card>
              <EmptyState
                icon={
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 17v-6a2 2 0 012-2h2a2 2 0 012 2v6m-6 0h6"
                    />
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
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <Link href={`/shows/${show.id}/workbook`} className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
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
        <div className="flex gap-2 sm:shrink-0">
          <Link
            href={`/shows/${show.id}/workbook`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#00929C] hover:bg-[#007a82] text-white text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            Open Workbook
          </Link>
          <a
            href={`/api/shows/${show.id}/spreadsheet`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors whitespace-nowrap"
            title="Download Lori-format show sales XLSX (snapshot)"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
              />
            </svg>
            .xlsx
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
