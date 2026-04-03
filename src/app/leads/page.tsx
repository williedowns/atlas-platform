export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

const STATUS_COLORS: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  new: "default",
  contacted: "warning",
  hot: "warning",
  converted: "success",
  lost: "destructive",
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  hot: "🔥 Hot",
  converted: "Converted",
  lost: "Lost",
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; show?: string }>;
}) {
  const { status: statusFilter, show: showFilter } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  const isAdmin = ["admin", "manager"].includes(profile?.role ?? "");

  let query = supabase
    .from("leads")
    .select(`
      id, first_name, last_name, phone, email, interest, status, notes, created_at,
      show:shows(id, name),
      assigned_to_profile:profiles!assigned_to(full_name)
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (!isAdmin) query = query.eq("assigned_to", user.id);
  if (statusFilter && statusFilter !== "all") query = query.eq("status", statusFilter);
  if (showFilter) query = query.eq("show_id", showFilter);

  const { data: leadsRaw } = await query;
  const leads = (leadsRaw ?? []) as any[];

  // Count by status for chips
  const counts = leads.reduce((acc: Record<string, number>, l) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1;
    acc.total = (acc.total ?? 0) + 1;
    return acc;
  }, {});

  const FILTER_OPTIONS = [
    { label: `All (${counts.total ?? 0})`, value: "all" },
    { label: `New (${counts.new ?? 0})`, value: "new" },
    { label: `Contacted (${counts.contacted ?? 0})`, value: "contacted" },
    { label: `Hot 🔥 (${counts.hot ?? 0})`, value: "hot" },
    { label: `Converted (${counts.converted ?? 0})`, value: "converted" },
    { label: `Lost (${counts.lost ?? 0})`, value: "lost" },
  ];

  const activeFilter = statusFilter ?? "all";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="p-2 rounded-lg hover:bg-white/10">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold">Leads Pipeline</h1>
            <p className="text-white/60 text-xs mt-0.5">
              {profile?.full_name} · {leads.length} leads
            </p>
          </div>
        </div>
      </header>

      {/* Status filter chips */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto bg-white border-b border-slate-100 scrollbar-hide sticky top-[65px] z-10">
        {FILTER_OPTIONS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "all" ? "/leads" : `/leads?status=${f.value}`}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              activeFilter === f.value
                ? "bg-[#010F21] text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <main className="max-w-2xl mx-auto pb-24">
        {leads.length === 0 ? (
          <div className="text-center py-16 px-4">
            <p className="text-slate-500">No leads found.</p>
            <p className="text-sm text-slate-400 mt-1">Go to a show and use Check-In Leads to capture walk-ins.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 bg-white">
            {leads.map((lead) => (
              <li key={lead.id}>
                <Link
                  href={`/leads/${lead.id}`}
                  className="flex items-center justify-between px-4 py-4 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">
                      {lead.first_name} {lead.last_name ?? ""}
                    </p>
                    <p className="text-sm text-slate-500 truncate">
                      {lead.phone ?? "No phone"}
                      {lead.interest ? ` · ${lead.interest}` : ""}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {lead.show?.name ?? "No show"} · {formatDate(lead.created_at)}
                      {isAdmin && lead.assigned_to_profile?.full_name
                        ? ` · ${lead.assigned_to_profile.full_name}`
                        : ""}
                    </p>
                  </div>
                  <div className="ml-3 flex-shrink-0">
                    <Badge variant={STATUS_COLORS[lead.status] ?? "secondary"}>
                      {STATUS_LABELS[lead.status] ?? lead.status}
                    </Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex safe-bottom">
        <Link href="/dashboard" className="flex-1 flex flex-col items-center py-3 text-slate-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-xs mt-1">Home</span>
        </Link>
        <Link href="/contracts" className="flex-1 flex flex-col items-center py-3 text-slate-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-xs mt-1">Contracts</span>
        </Link>
        <Link href="/leads" className="flex-1 flex flex-col items-center py-3 text-[#00929C]">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="text-xs mt-1 font-medium">Leads</span>
        </Link>
        <Link href="/shows" className="flex-1 flex flex-col items-center py-3 text-slate-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-xs mt-1">Shows</span>
        </Link>
        <Link href="/profile" className="flex-1 flex flex-col items-center py-3 text-slate-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-xs mt-1">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
