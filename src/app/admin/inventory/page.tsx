export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { INVENTORY_STATUSES } from "@/lib/inventory-constants";
import { InventorySearchTable } from "@/components/inventory/InventorySearchTable";

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const locationFilter = params.loc ?? "all";
  const statusFilter = params.status ?? "all";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Honor the org-level Inventory toggle — admins always pass, managers
  // only if the matrix allows them. Mirrors what /inventory does so the
  // matrix is the single source of truth for both surfaces.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization:organizations(role_permissions)")
    .eq("id", user.id)
    .single();

  const { hasPermission } = await import("@/lib/permissions");
  const orgPerms = (profile?.organization as any)?.role_permissions ?? null;
  if (!hasPermission(orgPerms, profile?.role, "inventory")) redirect("/dashboard");

  const [{ data: units }, { data: locations }, { data: shows }] = await Promise.all([
    supabase
      .from("inventory_units")
      .select(`
        id, serial_number, order_number, status, unit_type,
        shell_color, cabinet_color, sub_location, wrap_status, notes,
        model_code, delivery_team, customer_name, fin_balance,
        product:products(id, name, category, line, model_code),
        location:locations(id, name),
        show:shows(id, name)
      `)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("locations").select("id, name").eq("active", true).order("name"),
    supabase.from("shows").select("id, name").eq("active", true).order("name"),
  ]);

  const allUnits = units ?? [];

  // Filter
  const filtered = allUnits.filter((u) => {
    const loc = u.location as any;
    const show = u.show as any;
    if (locationFilter !== "all") {
      if (locationFilter.startsWith("show-")) {
        if (show?.id !== locationFilter.replace("show-", "")) return false;
      } else {
        if (loc?.id !== locationFilter) return false;
      }
    }
    if (statusFilter !== "all" && u.status !== statusFilter) return false;
    return true;
  });

  // Stats
  const statCounts = allUnits.reduce<Record<string, number>>((acc, u) => {
    acc[u.status] = (acc[u.status] ?? 0) + 1;
    return acc;
  }, {});

  const locationCounts = allUnits.reduce<Record<string, number>>((acc, u) => {
    const key = (u.location as any)?.id ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="p-2 rounded-lg hover:bg-white/10">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-lg font-bold">Inventory Management</h1>
              <p className="text-white/60 text-xs">{filtered.length} of {allUnits.length} units</p>
            </div>
          </div>
          <Link
            href="/admin/inventory/new"
            className="flex items-center gap-1.5 bg-[#00929C] text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Unit
          </Link>
        </div>
      </header>

      <main className="px-4 py-4 max-w-4xl mx-auto pb-24 space-y-4">

        {/* Status KPIs */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Available", count: (statCounts["at_location"] ?? 0) + (statCounts["at_show"] ?? 0), color: "text-emerald-600 bg-emerald-50" },
            { label: "Allocated", count: statCounts["allocated"] ?? 0, color: "text-amber-600 bg-amber-50" },
            { label: "On Order",  count: (statCounts["on_order"] ?? 0) + (statCounts["in_factory"] ?? 0) + (statCounts["in_transit"] ?? 0), color: "text-slate-600 bg-slate-100" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl p-3 text-center ${s.color}`}>
              <p className="text-2xl font-bold">{s.count}</p>
              <p className="text-xs font-medium mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Location breakdown */}
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">By Location</p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/admin/inventory?status=${statusFilter}`}
                className={`px-3 py-1.5 rounded-full text-sm font-medium ${locationFilter === "all" ? "bg-[#010F21] text-white" : "bg-slate-100 text-slate-600"}`}
              >
                All ({allUnits.length})
              </Link>
              {locations?.map((loc) => (
                <Link
                  key={loc.id}
                  href={`/admin/inventory?loc=${loc.id}&status=${statusFilter}`}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium ${locationFilter === loc.id ? "bg-[#010F21] text-white" : "bg-slate-100 text-slate-600"}`}
                >
                  {loc.name} ({locationCounts[loc.id] ?? 0})
                </Link>
              ))}
              {shows?.map((show) => (
                <Link
                  key={show.id}
                  href={`/admin/inventory?loc=show-${show.id}&status=${statusFilter}`}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium ${locationFilter === `show-${show.id}` ? "bg-[#00929C] text-white" : "bg-[#00929C]/10 text-[#00929C]"}`}
                >
                  📍 {show.name}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Status filter chips */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          <Link
            href={`/admin/inventory?loc=${locationFilter}`}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium ${statusFilter === "all" ? "bg-[#00929C] text-white" : "bg-white border border-slate-200 text-slate-600"}`}
          >
            All Statuses
          </Link>
          {INVENTORY_STATUSES.map((s) => (
            <Link
              key={s.value}
              href={`/admin/inventory?loc=${locationFilter}&status=${s.value}`}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium ${statusFilter === s.value ? "bg-[#00929C] text-white" : "bg-white border border-slate-200 text-slate-600"}`}
            >
              {s.label} ({statCounts[s.value] ?? 0})
            </Link>
          ))}
        </div>

        {/* Searchable unit table */}
        <InventorySearchTable units={filtered} />
      </main>
    </div>
  );
}
