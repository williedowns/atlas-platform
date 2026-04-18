import Link from "next/link";
import { notFound } from "next/navigation";
import {
  workOrderById,
  WORK_ORDER_STATUS_LABELS,
  WORK_ORDER_STATUS_COLORS,
  STATION_LABELS,
  DEFECT_CATEGORY_LABELS,
} from "@/lib/manufacturer/mock-data";
import { MS_BRAND } from "@/lib/manufacturer/brand";

const fmtDT = (d: Date) =>
  d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const fmtMin = (m: number | undefined) => {
  if (!m) return "—";
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h > 0 ? `${h}h ${r}m` : `${r}m`;
};

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const wo = workOrderById(id);
  if (!wo) notFound();

  const statusColor = WORK_ORDER_STATUS_COLORS[wo.status];
  const completedStations = wo.steps.filter((s) => s.status === "complete").length;
  const totalStations = wo.steps.length;
  const progressPct = (completedStations / totalStations) * 100;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <Link href="/manufacturer/factory" className="hover:text-cyan-700">Factory OS</Link>
        <span>/</span>
        <span className="text-slate-800 font-semibold font-mono">{wo.workOrderNumber}</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-900 font-mono">{wo.workOrderNumber}</h2>
            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{ color: statusColor, backgroundColor: `${statusColor}18` }}
            >
              {WORK_ORDER_STATUS_LABELS[wo.status]}
            </span>
            {wo.priority === "rush" && (
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
                Rush
              </span>
            )}
            {wo.firstPassYield === false && (
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-100 text-red-800">
                QC Rework
              </span>
            )}
          </div>
          <p className="text-slate-600 mt-1">
            <span
              className="inline-block px-2 py-0.5 rounded text-xs font-semibold mr-2"
              style={{
                color: MS_BRAND.modelLineColors[wo.modelLine],
                backgroundColor: `${MS_BRAND.modelLineColors[wo.modelLine]}15`,
              }}
            >
              {wo.modelLine}
            </span>
            {wo.model} · {wo.color} · {wo.cabinet}
          </p>
          <p className="text-slate-600 mt-0.5">
            For{" "}
            <Link href={`/manufacturer/dealers/${wo.dealerId}`} className="font-semibold hover:text-cyan-700">
              {wo.dealerName}
            </Link>
            {" · Order "}
            <Link href={`/manufacturer/dealer-orders/${wo.orderId}`} className="font-semibold hover:text-cyan-700 font-mono">
              {wo.orderNumber}
            </Link>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Serial Number</p>
          <p className="text-2xl font-black mt-1 font-mono text-slate-900">{wo.serialNumber}</p>
          <p className="text-xs text-slate-500 mt-1">Batch {wo.batchId}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-bold text-slate-900">Production Progress</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {completedStations} of {totalStations} stations complete ·{" "}
              {wo.currentStation ? `currently at ${STATION_LABELS[wo.currentStation]}` : wo.status === "complete" ? "delivered to staging" : "not started"}
            </p>
          </div>
          <p
            className="text-2xl font-black tabular-nums"
            style={{ color: statusColor }}
          >
            {progressPct.toFixed(0)}%
          </p>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${progressPct}%`, backgroundColor: statusColor }}
          />
        </div>
      </div>

      {/* Station pipeline */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-bold text-slate-900 mb-4">Station Pipeline</h3>
        <div className="space-y-3">
          {wo.steps.map((s, idx) => {
            const isCurrent = s.status === "in_progress";
            const isDone = s.status === "complete";
            const isPending = s.status === "pending";
            const qcFail = s.qc && (s.qc.result === "fail" || s.qc.result === "fix_in_place");
            const dotColor = isDone
              ? (qcFail ? "#D97706" : "#059669")
              : isCurrent
              ? statusColor
              : "#CBD5E1";

            return (
              <div key={idx} className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white"
                    style={{
                      backgroundColor: dotColor,
                      boxShadow: isCurrent ? `0 0 0 3px ${statusColor}40` : "none",
                    }}
                  >
                    {isDone ? "✓" : idx + 1}
                  </div>
                  {idx < wo.steps.length - 1 && (
                    <div
                      className="w-0.5 h-12 mt-1"
                      style={{ backgroundColor: isDone ? dotColor : "#E2E8F0" }}
                    />
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{STATION_LABELS[s.station]}</p>
                      {s.operator && (
                        <p className="text-xs text-slate-600">Operator: {s.operator}</p>
                      )}
                      {s.qc && (
                        <p
                          className="text-[10px] font-semibold uppercase tracking-widest mt-1"
                          style={{
                            color:
                              s.qc.result === "pass"
                                ? "#059669"
                                : s.qc.result === "fix_in_place"
                                ? "#D97706"
                                : "#DC2626",
                          }}
                        >
                          QC {s.qc.result.replace("_", " ")} · {s.qc.inspector}
                          {s.qc.defectCategory && ` · ${DEFECT_CATEGORY_LABELS[s.qc.defectCategory]}`}
                        </p>
                      )}
                      {s.qc?.notes && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{s.qc.notes}</p>
                      )}
                    </div>
                    <div className="text-right text-xs text-slate-500 tabular-nums whitespace-nowrap ml-3">
                      {s.startedAt && <p>Started {fmtDT(s.startedAt)}</p>}
                      {s.completedAt && <p>Done {fmtDT(s.completedAt)}</p>}
                      {s.minutesSpent !== undefined && (
                        <p className="font-semibold text-slate-700 mt-0.5">{fmtMin(s.minutesSpent)}</p>
                      )}
                      {isPending && <p className="text-slate-400">Pending</p>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* QC events summary */}
      {wo.qcEvents.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">QC History</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {wo.qcEvents.length} checkpoint{wo.qcEvents.length !== 1 ? "s" : ""} ·{" "}
              {wo.qcEvents.filter((q) => q.result === "pass").length} pass · {" "}
              {wo.qcEvents.filter((q) => q.result === "fix_in_place").length} fix-in-place · {" "}
              {wo.qcEvents.filter((q) => q.result === "fail").length} fail
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Station</th>
                <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Inspector</th>
                <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Result</th>
                <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Defect</th>
                <th className="px-5 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {wo.qcEvents.map((q, i) => {
                const resColor =
                  q.result === "pass" ? "#059669" : q.result === "fix_in_place" ? "#D97706" : "#DC2626";
                return (
                  <tr key={i}>
                    <td className="px-5 py-3 font-semibold text-slate-800">{STATION_LABELS[q.station]}</td>
                    <td className="px-5 py-3 text-slate-700 text-xs">{q.inspector}</td>
                    <td className="px-5 py-3">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: resColor, backgroundColor: `${resColor}18` }}
                      >
                        {q.result.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-600">
                      {q.defectCategory ? DEFECT_CATEGORY_LABELS[q.defectCategory] : "—"}
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-slate-500 tabular-nums">
                      {fmtDT(q.timestamp)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
