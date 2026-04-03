export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getStatusColor, getUnitTypeLabel, getCabinetName, INVENTORY_STATUSES } from "@/lib/inventory-constants";
import BottomNav from "@/components/layout/BottomNav";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const statusFilter = params.status ?? "available";
  const search = params.q ?? "";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, assigned_location_id")
    .eq("id", user.id)
    .single();

  const isAdmin = ["admin", "manager"].includes(profile?.role ?? "");

  // Build query — reps see their location/show; admins see all
  let query = supabase
    .from("inventory_units")
    .select(`
      id, serial_number, order_number, status, unit_type,
      shell_color, cabinet_color, sub_location, received_date, notes,
      product:products(id, name, category, line, model_code),
      location:locations(id, name, city, state),
      show:shows(id, name, venue_name)
    `)
    .not("status", "eq", "delivered")
    .order("created_at", { ascending: false })
    .limit(200);

  if (statusFilter === "available") {
    query = query.in("status", ["at_location", "at_show"]);
  } else if (statusFilter === "on_order") {
    query = query.in("status", ["on_order", "in_factory", "in_transit"]);
  } else if (statusFilter === "allocated") {
    query = query.eq("status", "allocated");
  }

  if (!isAdmin && profile?.assigned_location_id) {
    query = query.eq("location_id", profile.assigned_location_id);
  }

  const { data: units } = await query;

  const rows = (units ?? []).filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const product = u.product as any;
    return (
      u.serial_number?.toLowerCase().includes(q) ||
      u.order_number?.toLowerCase().includes(q) ||
      product?.name?.toLowerCase().includes(q) ||
      product?.model_code?.toLowerCase().includes(q) ||
      u.shell_color?.toLowerCase().includes(q)
    );
  });

  // Stats
  const { data: allUnits } = await supabase
    .from("inventory_units")
    .select("status")
    .not("status", "eq", "delivered");

  const statCounts = (allUnits ?? []).reduce<Record<string, number>>((acc, u) => {
    acc[u.status] = (acc[u.status] ?? 0) + 1;
    return acc;
  }, {});
  const availableCount = (statCounts["at_location"] ?? 0) + (statCounts["at_show"] ?? 0);
  const onOrderCount = (statCounts["on_order"] ?? 0) + (statCounts["in_factory"] ?? 0) + (statCounts["in_transit"] ?? 0);
  const allocatedCount = statCounts["allocated"] ?? 0;

  const FILTERS = [
    { value: "available", label: "Available", count: availableCount },
    { value: "on_order",  label: "On Order",  count: onOrderCount },
    { value: "allocated", label: "Allocated", count: allocatedCount },
    { value: "all",       label: "All Active", count: (allUnits ?? []).length },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Inventory</h1>
            <p className="text-white/60 text-xs mt-0.5">{rows.length} units shown</p>
          </div>
          {isAdmin && (
            <Link
              href="/admin/inventory/new"
              className="flex items-center gap-1.5 bg-[#00929C] text-white text-sm font-semibold px-4 py-2 rounded-lg"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Unit
            </Link>
          )}
        </div>
      </header>

      <main className="pb-24">
        {/* Stats Strip */}
        <div className="grid grid-cols-3 gap-3 px-4 pt-4 pb-2">
          {[
            { label: "Available", count: availableCount, color: "text-emerald-600" },
            { label: "Allocated", count: allocatedCount, color: "text-amber-600" },
            { label: "On Order",  count: onOrderCount,   color: "text-slate-500" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-3 text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.count}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search */}
        <div className="px-4 pb-2 pt-1">
          <form method="get" action="/inventory">
            <input
              name="q"
              defaultValue={search}
              placeholder="Search serial, model, color…"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
            />
            {statusFilter !== "available" && (
              <input type="hidden" name="status" value={statusFilter} />
            )}
          </form>
        </div>

        {/* Filter Chips */}
        <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-hide">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={`/inventory?status=${f.value}${search ? `&q=${search}` : ""}`}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                statusFilter === f.value
                  ? "bg-[#00929C] text-white"
                  : "bg-white text-slate-600 border border-slate-200"
              }`}
            >
              {f.label} <span className="opacity-70">({f.count})</span>
            </Link>
          ))}
        </div>

        {/* Unit List */}
        {rows.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-lg font-medium">No units found</p>
            <p className="text-sm mt-1">Try a different filter or search term</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 mt-1">
            {rows.map((unit) => {
              const product = unit.product as any;
              const location = unit.location as any;
              const show = unit.show as any;
              const where = show?.name ?? location?.name ?? "—";
              return (
                <li key={unit.id}>
                  <Link
                    href={`/admin/inventory/${unit.id}`}
                    className="flex items-center justify-between px-4 py-4 bg-white hover:bg-slate-50 active:bg-slate-100 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">
                        {product?.name ?? "Unknown Product"}
                      </p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {unit.serial_number ?? unit.order_number ?? "No serial"}
                        {unit.shell_color ? ` · ${unit.shell_color}` : ""}
                        {unit.cabinet_color ? ` / ${getCabinetName(unit.cabinet_color)}` : ""}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{where}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 ml-3">
                      <Badge variant={getStatusColor(unit.status)}>
                        {INVENTORY_STATUSES.find((s) => s.value === unit.status)?.label ?? unit.status}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {getUnitTypeLabel(unit.unit_type)}
                      </Badge>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <BottomNav role={profile?.role} />
    </div>
  );
}
