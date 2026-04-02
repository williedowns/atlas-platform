"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getStatusColor, getUnitTypeLabel, getCabinetName, getModelDisplayName, INVENTORY_STATUSES } from "@/lib/inventory-constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Unit = Record<string, any>;

interface Props {
  units: Unit[];
}

function matchesSearch(u: Unit, q: string): boolean {
  const s = q.toLowerCase();
  const model = (u.product as any)?.name ?? getModelDisplayName(u.model_code);
  const cabinetName = u.cabinet_color ? getCabinetName(u.cabinet_color).toLowerCase() : "";
  const statusLabel = INVENTORY_STATUSES.find((st) => st.value === u.status)?.label ?? u.status;
  const unitTypeLabel = getUnitTypeLabel(u.unit_type);
  const locationName = (u.show as any)?.name ?? (u.location as any)?.name ?? "";

  return [
    u.serial_number,
    u.order_number,
    u.model_code,
    model,
    u.shell_color,
    u.cabinet_color,
    cabinetName,
    u.customer_name,
    u.fin_balance,
    u.delivery_info,
    u.delivery_team,
    u.notes,
    u.sub_location,
    u.wrap_status,
    statusLabel,
    unitTypeLabel,
    locationName,
    (u.product as any)?.category,
    (u.product as any)?.line,
  ].some((val) => val?.toString().toLowerCase().includes(s));
}

export function InventorySearchTable({ units }: Props) {
  const [query, setQuery] = useState("");

  const displayed = query.trim()
    ? units.filter((u) => matchesSearch(u, query.trim()))
    : units;

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search serial, model, customer, color, location, notes…"
          className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {query.trim() && (
        <p className="text-xs text-slate-500 px-1">
          {displayed.length} result{displayed.length !== 1 ? "s" : ""} for <span className="font-semibold">"{query}"</span>
        </p>
      )}

      {/* Table */}
      {displayed.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <svg className="w-10 h-10 mx-auto mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
          </svg>
          <p className="font-medium">No units match{query ? ` "${query}"` : " this filter"}</p>
          {query && (
            <button onClick={() => setQuery("")} className="mt-1 text-sm text-[#00929C] underline">
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Model</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Serial / Order #</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Config</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Customer / Delivery</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Location</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Status</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayed.map((unit) => {
                  const u = unit as any;
                  const product = unit.product as any;
                  const location = unit.location as any;
                  const show = unit.show as any;

                  const deliveryBadge = u.delivery_team === "atlas"
                    ? <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-cyan-100 text-cyan-700">Atlas Del</span>
                    : u.delivery_team === "fierce"
                    ? <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">Fierce Del</span>
                    : u.delivery_team === "houston_aaron"
                    ? <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700">HOU/Aaron</span>
                    : null;

                  return (
                    <tr key={unit.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900 truncate max-w-[180px]">
                          {product?.name ?? getModelDisplayName(u.model_code)}
                        </p>
                        <p className="text-xs text-slate-400">{getUnitTypeLabel(unit.unit_type)}</p>
                      </td>
                      <td className="py-3 px-4 font-mono text-sm text-slate-700">
                        {unit.serial_number ?? unit.order_number ?? "—"}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {unit.shell_color && <p>{unit.shell_color}</p>}
                        {unit.cabinet_color && <p>{getCabinetName(unit.cabinet_color)}</p>}
                        {!unit.shell_color && !unit.cabinet_color && <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-3 px-4">
                        {u.customer_name && (
                          <p className="text-sm font-medium text-slate-900 truncate max-w-[160px]">
                            {u.scheduled_owes && <span className="text-amber-500 mr-1">⚠</span>}
                            {u.customer_name}
                          </p>
                        )}
                        {u.fin_balance && u.fin_balance !== "PIF" && (
                          <p className="text-xs text-amber-600 font-medium">{u.fin_balance}</p>
                        )}
                        {u.fin_balance === "PIF" && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">PIF</span>
                        )}
                        {u.foundation_financing && (
                          <span className="ml-1 text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">FF</span>
                        )}
                        {u.delivery_info && (
                          <p className="text-xs text-slate-400 truncate max-w-[160px] mt-0.5">{u.delivery_info}</p>
                        )}
                        {deliveryBadge}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {show?.name ? (
                          <span className="text-[#00929C]">📍 {show.name}</span>
                        ) : location?.name ? (
                          location.name
                        ) : "—"}
                        {unit.sub_location && (
                          <p className="text-xs text-slate-400">{unit.sub_location}</p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={getStatusColor(unit.status)}>
                          {INVENTORY_STATUSES.find((s) => s.value === unit.status)?.label ?? unit.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Link
                          href={`/admin/inventory/${unit.id}`}
                          className="text-[#00929C] text-sm font-medium hover:underline"
                        >
                          Edit →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
