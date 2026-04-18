export const dynamic = "force-dynamic";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/ui/AppHeader";
import { ShowDailyTrendChart } from "@/components/shows/ShowDailyTrendChart";
import { SectionCard } from "@/components/ui/SectionCard";
import { formatCurrency, formatDate } from "@/lib/utils";

const STATUS_COLORS: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  draft: "secondary",
  pending_signature: "warning",
  signed: "default",
  deposit_collected: "success",
  delivered: "success",
  cancelled: "destructive",
};

export default async function ShowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: show } = await supabase
    .from("shows")
    .select("*, location:locations(*)")
    .eq("id", id)
    .single();

  if (!show) notFound();

  const { data: contracts } = await supabase
    .from("contracts")
    .select("*, customer:customers(first_name, last_name)")
    .eq("show_id", id)
    .order("created_at", { ascending: false });

  const totalRevenue = contracts?.reduce((s, c) => s + (c.total ?? 0), 0) ?? 0;
  const totalDeposits = contracts?.reduce((s, c) => s + (c.deposit_paid ?? 0), 0) ?? 0;

  // Daily trend — bucket contracts by day between show start and end (capped at today)
  const trendMap = new Map<string, { revenue: number; contracts: number }>();
  const showStartDate = new Date(show.start_date + "T00:00:00");
  const showEndDate = new Date(show.end_date + "T00:00:00");
  const todayISO = new Date().toISOString().split("T")[0];
  const todayDate = new Date(todayISO + "T00:00:00");
  const cursor = new Date(showStartDate);
  while (cursor <= showEndDate) {
    const key = cursor.toISOString().split("T")[0];
    trendMap.set(key, { revenue: 0, contracts: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  for (const c of contracts ?? []) {
    const key = c.created_at?.split("T")[0];
    if (!key || !trendMap.has(key)) continue;
    const b = trendMap.get(key)!;
    b.revenue += c.total ?? 0;
    b.contracts += 1;
  }
  const trendData = Array.from(trendMap.entries()).map(([date, vals]) => {
    const d = new Date(date + "T00:00:00");
    return {
      date,
      label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      isToday: date === todayISO,
      revenue: vals.revenue,
      contracts: vals.contracts,
    };
  });
  // Only render trend if show started by today or earlier
  const showTrendChart = showStartDate <= todayDate;

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        title={show.name}
        subtitle={`${show.venue_name} · ${show.city}, ${show.state}`}
        backHref="/shows"
      />

      <main className="px-5 py-6 space-y-4 max-w-2xl mx-auto pb-24">
        {/* Show Info */}
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-sm text-slate-500">{show.address}, {show.city}, {show.state} {show.zip}</p>
            <p className="text-sm font-medium text-slate-700">
              {formatDate(show.start_date)}
              {show.start_date !== show.end_date && ` – ${formatDate(show.end_date)}`}
            </p>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-[#00929C]">{contracts?.length ?? 0}</p>
              <p className="text-xs text-slate-500 mt-1">Contracts</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold text-slate-900">{formatCurrency(totalRevenue)}</p>
              <p className="text-xs text-slate-500 mt-1">Revenue</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalDeposits)}</p>
              <p className="text-xs text-slate-500 mt-1">Deposits</p>
            </CardContent>
          </Card>
        </div>

        {/* Daily trend chart */}
        {showTrendChart && (
          <SectionCard
            title="Daily Revenue"
            subtitle={`${trendData.length} day${trendData.length === 1 ? "" : "s"} · today highlighted in teal`}
          >
            <ShowDailyTrendChart data={trendData} />
          </SectionCard>
        )}

        {/* CTAs */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/contracts/new" className="col-span-2">
            <Button variant="accent" size="xl" className="w-full text-lg font-bold">
              + Start New Contract
            </Button>
          </Link>
          <Link href={`/shows/${id}/checkin`}>
            <Button variant="default" size="lg" className="w-full bg-slate-700 hover:bg-slate-800 text-white font-semibold">
              Check-In Leads
            </Button>
          </Link>
          <Link href={`/shows/${id}/floor`}>
            <Button variant="default" size="lg" className="w-full bg-[#010F21] hover:bg-[#0B1929] text-white font-semibold border border-[#00929C]/40">
              <span className="inline-flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Floor Mode
              </span>
            </Button>
          </Link>
        </div>

        {/* Contracts list */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Contracts ({contracts?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!contracts?.length ? (
              <p className="text-center text-slate-500 py-6 px-4">
                No contracts yet. Tap &ldquo;Start New Contract&rdquo; to begin.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {contracts.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/contracts/${c.id}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 active:bg-slate-100"
                    >
                      <div>
                        <p className="font-medium text-slate-900">
                          {c.customer?.first_name} {c.customer?.last_name}
                        </p>
                        <p className="text-xs text-slate-500">{c.contract_number}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(c.total)}</p>
                        <Badge variant={STATUS_COLORS[c.status] ?? "secondary"} className="mt-1 text-xs">
                          {c.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
