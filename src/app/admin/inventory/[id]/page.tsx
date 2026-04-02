export const dynamic = "force-dynamic";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStatusColor, getUnitTypeLabel, getCabinetName, getModelDisplayName, INVENTORY_STATUSES } from "@/lib/inventory-constants";
import { UnitDetailActions } from "@/components/inventory/UnitDetailActions";

export default async function InventoryUnitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isAdmin = ["admin", "manager"].includes(profile?.role ?? "");

  const [{ data: unit }, { data: transfers }, { data: locations }, { data: shows }] = await Promise.all([
    supabase
      .from("inventory_units")
      .select(`
        *,
        product:products(id, name, category, line, model_code),
        location:locations(id, name, city, state),
        show:shows(id, name, venue_name),
        contract:contracts(id, contract_number, status, customer:customers(first_name, last_name))
      `)
      .eq("id", id)
      .single(),
      // Note: model_code, delivery_team, customer_name, fin_balance are included via *
    supabase
      .from("inventory_transfers")
      .select(`
        id, notes, created_at,
        from_location:locations!from_location_id(name),
        to_location:locations!to_location_id(name),
        from_show:shows!from_show_id(name),
        to_show:shows!to_show_id(name),
        transferred_by:profiles!transferred_by(full_name)
      `)
      .eq("unit_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("locations").select("id, name, city, state").eq("active", true).order("name"),
    supabase.from("shows").select("id, name, venue_name").eq("active", true).order("name"),
  ]);

  if (!unit) notFound();

  const product = unit.product as any;
  const location = unit.location as any;
  const show = unit.show as any;
  const contract = unit.contract as any;

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <Link href="/admin/inventory" className="p-2 rounded-lg hover:bg-white/10">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold truncate">{product?.name ?? getModelDisplayName((unit as any).model_code) ?? "Unit Detail"}</h1>
            <p className="text-[#00929C] text-xs">
              {unit.serial_number ?? unit.order_number ?? "No identifier"}
            </p>
          </div>
          <Badge variant={getStatusColor(unit.status)}>
            {INVENTORY_STATUSES.find((s) => s.value === unit.status)?.label ?? unit.status}
          </Badge>
        </div>
      </header>

      <main className="px-4 py-5 max-w-2xl mx-auto space-y-4 pb-24">

        {/* Unit Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Unit Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-slate-500">Product</p>
                <p className="font-medium">{product?.name ?? getModelDisplayName((unit as any).model_code) ?? "—"}</p>
              </div>
              <div>
                <p className="text-slate-500">Type</p>
                <p className="font-medium">{getUnitTypeLabel(unit.unit_type)}</p>
              </div>
              <div>
                <p className="text-slate-500">Serial #</p>
                <p className="font-mono font-medium">{unit.serial_number ?? "—"}</p>
              </div>
              <div>
                <p className="text-slate-500">Order #</p>
                <p className="font-mono font-medium">{unit.order_number ?? "—"}</p>
              </div>
              <div>
                <p className="text-slate-500">Shell Color</p>
                <p className="font-medium">{unit.shell_color ?? "—"}</p>
              </div>
              <div>
                <p className="text-slate-500">Cabinet</p>
                <p className="font-medium">{unit.cabinet_color ? getCabinetName(unit.cabinet_color) : "—"}</p>
              </div>
              <div>
                <p className="text-slate-500">Wrap Status</p>
                <p className="font-medium">{unit.wrap_status === "WR" ? "Wrapped" : unit.wrap_status === "UN" ? "Unwrapped" : "—"}</p>
              </div>
              <div>
                <p className="text-slate-500">Received</p>
                <p className="font-medium">{unit.received_date ? formatDate(unit.received_date) : "—"}</p>
              </div>
            </div>
            {unit.notes && (
              <div>
                <p className="text-slate-500">Notes</p>
                <p className="text-slate-700 mt-0.5">{unit.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Current Location */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Current Location</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {show?.name ? (
              <div className="flex items-center gap-2">
                <span className="text-[#00929C] font-semibold">📍 {show.name}</span>
                <Badge variant="default">At Show</Badge>
              </div>
            ) : location?.name ? (
              <p className="font-medium">{location.name} — {location.city}, {location.state}</p>
            ) : (
              <p className="text-slate-400">No location assigned</p>
            )}
            {unit.sub_location && (
              <p className="text-slate-500">Sub-location: {unit.sub_location}</p>
            )}
          </CardContent>
        </Card>

        {/* Legacy customer / delivery info from spreadsheet import */}
        {(unit.customer_name || unit.fin_balance || unit.delivery_team || (unit as any).delivery_info || (unit as any).foundation_financing || (unit as any).scheduled_owes) && !contract && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Customer & Delivery</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {unit.customer_name && (
                <div>
                  <p className="text-slate-500">Customer</p>
                  <p className="font-medium flex items-center gap-2">
                    {unit.customer_name}
                    {(unit as any).scheduled_owes && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Scheduled — Owes</span>
                    )}
                  </p>
                </div>
              )}
              {unit.delivery_team && (
                <div>
                  <p className="text-slate-500">Delivery Team</p>
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                    unit.delivery_team === "atlas" ? "bg-cyan-100 text-cyan-700" :
                    unit.delivery_team === "fierce" ? "bg-purple-100 text-purple-700" :
                    "bg-orange-100 text-orange-700"
                  }`}>
                    {unit.delivery_team === "atlas" ? "Atlas Delivery"
                      : unit.delivery_team === "fierce" ? "Fierce Delivery"
                      : "Houston / Aaron"}
                  </span>
                </div>
              )}
              {unit.fin_balance && (
                <div>
                  <p className="text-slate-500">Finance Balance</p>
                  <p className={`font-medium ${unit.fin_balance === "PIF" ? "text-emerald-600" : unit.fin_balance.startsWith("Need") ? "text-amber-600" : "text-slate-900"}`}>
                    {unit.fin_balance}
                    {(unit as any).foundation_financing && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Foundation Financing</span>
                    )}
                  </p>
                </div>
              )}
              {!(unit as any).fin_balance && (unit as any).foundation_financing && (
                <div>
                  <p className="text-slate-500">Financing</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Foundation Financing</span>
                </div>
              )}
              {(unit as any).delivery_info && (
                <div>
                  <p className="text-slate-500">Delivery / Completion Info</p>
                  <p className="font-medium text-slate-700">{(unit as any).delivery_info}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Contract link */}
        {contract && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Allocated to Contract</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <Link href={`/contracts/${contract.id}`} className="text-[#00929C] font-semibold hover:underline">
                {contract.contract_number}
              </Link>
              <p className="text-slate-500 mt-0.5">
                {contract.customer?.first_name} {contract.customer?.last_name} · {contract.status}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Admin actions */}
        {isAdmin && (
          <UnitDetailActions
            unit={{
              id: unit.id,
              status: unit.status,
              location_id: unit.location_id,
              show_id: unit.show_id,
              unit_type: unit.unit_type,
              shell_color: unit.shell_color,
              cabinet_color: unit.cabinet_color,
              wrap_status: unit.wrap_status,
              sub_location: unit.sub_location,
              serial_number: unit.serial_number,
              order_number: unit.order_number,
              notes: unit.notes,
              delivery_team: unit.delivery_team,
              customer_name: unit.customer_name,
              fin_balance: unit.fin_balance,
              delivery_info: (unit as any).delivery_info,
              foundation_financing: (unit as any).foundation_financing ?? false,
              scheduled_owes: (unit as any).scheduled_owes ?? false,
            }}
            locations={locations ?? []}
            shows={shows ?? []}
          />
        )}

        {/* Transfer History */}
        {transfers && transfers.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Transfer History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-slate-100">
                {transfers.map((t: any) => {
                  const from = t.from_show?.name ?? t.from_location?.name ?? "—";
                  const to = t.to_show?.name ?? t.to_location?.name ?? "—";
                  return (
                    <li key={t.id} className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">
                        {from} → {to}
                      </p>
                      {t.notes && <p className="text-xs text-slate-500 mt-0.5">{t.notes}</p>}
                      <p className="text-xs text-slate-400 mt-0.5">
                        {t.transferred_by?.full_name ?? "System"} · {formatDate(t.created_at)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
