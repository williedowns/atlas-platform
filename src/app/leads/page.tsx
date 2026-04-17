export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import AppShell from "@/components/layout/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";

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
  hot: "Hot",
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
    .select("role, full_name, organization:organizations(role_permissions)")
    .eq("id", user.id)
    .single();

  if (profile?.role === "field_crew") redirect("/field");

  const { hasPermission } = await import("@/lib/permissions");
  const orgPerms = (profile?.organization as any)?.role_permissions;
  if (!hasPermission(orgPerms, profile?.role, "leads")) redirect("/dashboard");

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
    { label: `Hot (${counts.hot ?? 0})`, value: "hot" },
    { label: `Converted (${counts.converted ?? 0})`, value: "converted" },
    { label: `Lost (${counts.lost ?? 0})`, value: "lost" },
  ];

  const activeFilter = statusFilter ?? "all";

  return (
    <AppShell role={profile?.role} userName={profile?.full_name} orgPerms={orgPerms}>
      <AppHeader
        title="Leads Pipeline"
        subtitle={`${leads.length} lead${leads.length === 1 ? "" : "s"}`}
        backHref="/dashboard"
      />

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

      <main className="max-w-4xl mx-auto pb-24">
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

    </AppShell>
  );
}
