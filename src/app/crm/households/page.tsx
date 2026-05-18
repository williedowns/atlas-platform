export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/utils";

interface HouseholdRow {
  id: string;
  name: string;
  household_type: string;
  lifecycle_stage: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  score: number;
  last_activity_at: string | null;
  created_at: string;
  owner: { id: string; full_name: string | null } | null;
  member_count: number;
}

const STAGE_STYLE: Record<string, string> = {
  lead: "bg-slate-100 text-slate-600",
  mql: "bg-blue-100 text-blue-700",
  sql: "bg-purple-100 text-purple-700",
  customer: "bg-green-100 text-green-700",
  inactive: "bg-slate-50 text-slate-400",
};

export default async function CrmHouseholdsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stage?: string }>;
}) {
  const { q, stage } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, organization:organizations(role_permissions)")
    .eq("id", user.id)
    .single();

  if (!["admin", "manager"].includes(profile?.role ?? "")) {
    redirect("/dashboard");
  }

  const orgPerms = (profile?.organization as any)?.role_permissions;

  let query = supabase
    .from("households")
    .select(`
      id, name, household_type, lifecycle_stage, city, state, zip, score,
      last_activity_at, created_at,
      owner:profiles!owner_id(id, full_name)
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (q?.trim()) {
    const term = `%${q.trim()}%`;
    query = query.or(`name.ilike.${term},city.ilike.${term},zip.ilike.${term}`);
  }
  if (stage && stage !== "all") {
    query = query.eq("lifecycle_stage", stage);
  }

  const { data: hhRaw } = await query;
  const households = (hhRaw ?? []) as unknown as HouseholdRow[];

  // Member counts (separate query — JOIN counts via embedded select aren't
  // exposed in Supabase JS as cleanly; do a single batch lookup).
  const ids = households.map((h) => h.id);
  let memberMap = new Map<string, number>();
  if (ids.length > 0) {
    const { data: memberRows } = await supabase
      .from("contacts")
      .select("household_id")
      .in("household_id", ids);
    for (const row of memberRows ?? []) {
      if (row.household_id) {
        memberMap.set(row.household_id, (memberMap.get(row.household_id) ?? 0) + 1);
      }
    }
  }

  const STAGES = ["all", "lead", "mql", "sql", "customer", "inactive"];
  const activeStage = stage ?? "all";

  return (
    <AppShell role={profile?.role} userName={profile?.full_name} orgPerms={orgPerms}>
      <AppHeader
        title="Households"
        subtitle={`${households.length} household${households.length === 1 ? "" : "s"}`}
        backHref="/crm"
        actions={
          <Link
            href="/crm/households/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00929C] hover:bg-[#007a82] text-white text-xs font-semibold transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            New Household
          </Link>
        }
      />

      <div className="bg-white border-b border-slate-100 sticky top-[65px] z-10">
        <form className="flex items-center gap-2 px-4 py-3" action="/crm/households" method="get">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search by name, city, or zip…"
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C]"
            />
          </div>
          {activeStage !== "all" && <input type="hidden" name="stage" value={activeStage} />}
          <button
            type="submit"
            className="px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            Search
          </button>
          {(q || activeStage !== "all") && (
            <Link
              href="/crm/households"
              className="px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              Clear
            </Link>
          )}
        </form>

        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
          {STAGES.map((s) => (
            <Link
              key={s}
              href={
                s === "all"
                  ? q
                    ? `/crm/households?q=${encodeURIComponent(q)}`
                    : "/crm/households"
                  : `/crm/households?${q ? `q=${encodeURIComponent(q)}&` : ""}stage=${s}`
              }
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors capitalize ${
                activeStage === s
                  ? "bg-[#010F21] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      <main className="max-w-4xl mx-auto pb-24">
        {households.length === 0 ? (
          q || activeStage !== "all" ? (
            <EmptyState
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
              title="No households match"
              description="Try a different search or clear filters."
              action={{ label: "Clear filters", href: "/crm/households" }}
            />
          ) : (
            <EmptyState
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              }
              title="No households yet"
              description="A household groups multiple contacts (couples, families, HOAs) under one deal. Create one from scratch, or open any contact and click 'Create household from this contact'."
              action={{ label: "Create a household", href: "/crm/households/new" }}
            />
          )
        ) : (
          <ul className="divide-y divide-slate-100 bg-white">
            {households.map((h) => {
              const memberCount = memberMap.get(h.id) ?? 0;
              const location = [h.city, h.state, h.zip].filter(Boolean).join(", ");
              return (
                <li key={h.id}>
                  <Link
                    href={`/crm/households/${h.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00929C]/20 to-[#00929C]/5 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-[#00929C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900 group-hover:text-[#00929C] transition-colors truncate">
                            {h.name}
                          </p>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                              STAGE_STYLE[h.lifecycle_stage] ?? "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {h.lifecycle_stage}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate">
                          {memberCount} member{memberCount === 1 ? "" : "s"}
                          {location && ` · ${location}`}
                          {h.owner?.full_name && ` · ${h.owner.full_name}`}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {h.last_activity_at
                            ? `Active ${formatDate(h.last_activity_at)}`
                            : `Created ${formatDate(h.created_at)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {h.score > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-[#00929C]/10 text-[#00929C] text-[11px] font-semibold tabular-nums">
                          {h.score}
                        </span>
                      )}
                      <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </AppShell>
  );
}
