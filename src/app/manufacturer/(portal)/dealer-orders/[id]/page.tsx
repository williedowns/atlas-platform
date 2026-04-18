import Link from "next/link";
import { notFound } from "next/navigation";
import {
  dealerOrderById,
  DEALER_ORDER_STATUS_LABELS,
  DEALER_ORDER_STATUS_COLORS,
  type DealerOrderStatus,
} from "@/lib/manufacturer/mock-data";
import { MS_BRAND } from "@/lib/manufacturer/brand";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const STATUS_FLOW: DealerOrderStatus[] = [
  "submitted",
  "approved",
  "in_production",
  "ready_to_ship",
  "shipped",
  "delivered",
];

export default async function DealerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = dealerOrderById(id);
  if (!order) notFound();

  const statusColor = DEALER_ORDER_STATUS_COLORS[order.status];
  const currentIdx = STATUS_FLOW.indexOf(order.status);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <Link href="/manufacturer/dealer-orders" className="hover:text-cyan-700">
          Dealer Orders
        </Link>
        <span>/</span>
        <span className="text-slate-800 font-semibold font-mono">{order.orderNumber}</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-900 font-mono">{order.orderNumber}</h2>
            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{ color: statusColor, backgroundColor: `${statusColor}18` }}
            >
              {DEALER_ORDER_STATUS_LABELS[order.status]}
            </span>
            {order.priority === "rush" && (
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
                Rush
              </span>
            )}
            {order.creditHold && (
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-100 text-red-800">
                Credit Hold
              </span>
            )}
          </div>
          <p className="text-slate-600 mt-1">
            <Link href={`/manufacturer/dealers/${order.dealerId}`} className="font-semibold hover:text-cyan-700">
              {order.dealerName}
            </Link>{" "}
            · {order.dealerCity}, {order.dealerState} · {order.dealerTier} tier dealer
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Order Total</p>
          <p className="text-4xl font-black mt-1" style={{ color: MS_BRAND.colors.primary }}>
            {fmtCurrency(order.total)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {order.unitCount} units · {order.paymentTerms.replace("_", " ")}
          </p>
        </div>
      </div>

      {/* Status pipeline */}
      {order.status !== "draft" && order.status !== "cancelled" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-4 text-sm">Order Pipeline</h3>
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 right-0 top-4 h-0.5 bg-slate-200" />
            <div
              className="absolute left-0 top-4 h-0.5 transition-all"
              style={{
                width: `${(currentIdx / (STATUS_FLOW.length - 1)) * 100}%`,
                backgroundColor: statusColor,
              }}
            />
            {STATUS_FLOW.map((s, idx) => {
              const reached = idx <= currentIdx;
              const current = idx === currentIdx;
              return (
                <div key={s} className="relative z-10 flex flex-col items-center">
                  <div
                    className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-bold"
                    style={{
                      backgroundColor: reached ? statusColor : "#FFFFFF",
                      borderColor: reached ? statusColor : "#CBD5E1",
                      color: reached ? "#FFFFFF" : "#94A3B8",
                    }}
                  >
                    {reached ? "✓" : idx + 1}
                  </div>
                  <p
                    className={`text-[10px] mt-2 font-semibold uppercase tracking-widest whitespace-nowrap ${
                      current ? "" : "text-slate-500"
                    }`}
                    style={current ? { color: statusColor } : {}}
                  >
                    {DEALER_ORDER_STATUS_LABELS[s]}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Line items */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">Line Items</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {order.lines.length} line{order.lines.length !== 1 ? "s" : ""} · {order.unitCount} units total
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Model</th>
                <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Options</th>
                <th className="px-5 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Qty</th>
                <th className="px-5 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Unit Cost</th>
                <th className="px-5 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {order.lines.map((l, i) => (
                <tr key={i}>
                  <td className="px-5 py-3">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
                      style={{
                        color: MS_BRAND.modelLineColors[l.modelLine],
                        backgroundColor: `${MS_BRAND.modelLineColors[l.modelLine]}15`,
                      }}
                    >
                      {l.modelLine}
                    </span>
                    <p className="text-sm text-slate-800 mt-1 font-semibold">{l.model}</p>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600">
                    <p>{l.color}</p>
                    <p className="text-slate-500">{l.cabinet} cabinet</p>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">{l.qty}</td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    <p className="text-slate-900">{fmtCurrency(l.unitCost)}</p>
                    <p className="text-[10px] text-slate-400 line-through">{fmtCurrency(l.unitMsrp)}</p>
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-slate-900 tabular-nums">
                    {fmtCurrency(l.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-slate-200">
              <tr>
                <td colSpan={4} className="px-5 py-2 text-right text-sm font-semibold text-slate-700">Subtotal</td>
                <td className="px-5 py-2 text-right font-semibold tabular-nums">{fmtCurrency(order.subtotal)}</td>
              </tr>
              <tr>
                <td colSpan={4} className="px-5 py-2 text-right text-sm text-slate-600">Freight</td>
                <td className="px-5 py-2 text-right text-slate-700 tabular-nums">{fmtCurrency(order.freight)}</td>
              </tr>
              <tr>
                <td colSpan={4} className="px-5 py-3 text-right text-sm font-bold text-slate-900">Total</td>
                <td className="px-5 py-3 text-right font-black text-slate-900 tabular-nums text-lg">
                  {fmtCurrency(order.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Sidebar details */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
              Order Timeline
            </h4>
            <div className="space-y-3 text-sm">
              <TimelineRow label="Placed" date={order.placedAt} done />
              <TimelineRow label="Approved" date={order.approvedAt} done={!!order.approvedAt} />
              <TimelineRow label="Promised Ship" date={order.promisedShipAt} done={false} projected />
              <TimelineRow label="Shipped" date={order.shippedAt} done={!!order.shippedAt} />
              <TimelineRow label="Delivered" date={order.deliveredAt} done={!!order.deliveredAt} />
              {order.cancelledAt && <TimelineRow label="Cancelled" date={order.cancelledAt} done cancelled />}
            </div>
          </div>

          {(order.status === "shipped" || order.status === "delivered") && order.trackingNumber && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
                Shipment
              </h4>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Carrier</span>
                  <span className="font-semibold text-slate-900">{order.carrier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Tracking</span>
                  <span className="font-mono text-xs text-slate-900">{order.trackingNumber}</span>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
              Payment
            </h4>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Terms</span>
                <span className="font-semibold text-slate-900 capitalize">
                  {order.paymentTerms.replace("_", " ")}
                </span>
              </div>
              {order.creditHold && (
                <div className="mt-2 p-2 rounded bg-red-50 border border-red-200 text-xs text-red-800">
                  <span className="font-bold">Credit hold:</span> dealer at credit limit. CFO approval required to release.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineRow({
  label,
  date,
  done,
  projected,
  cancelled,
}: {
  label: string;
  date: Date | undefined;
  done: boolean;
  projected?: boolean;
  cancelled?: boolean;
}) {
  const color = cancelled ? "#DC2626" : done ? "#059669" : projected ? "#D97706" : "#94A3B8";
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-slate-700">{label}</span>
      </div>
      <span className={`text-xs tabular-nums ${date ? "text-slate-700" : "text-slate-400"}`}>
        {date
          ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          : "—"}
      </span>
    </div>
  );
}
