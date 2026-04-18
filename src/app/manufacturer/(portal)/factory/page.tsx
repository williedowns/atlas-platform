import {
  WORK_ORDERS,
  factoryStats,
  stationWIP,
  productionThroughputLast7Days,
  qcFailuresByStation,
  STATION_FLOW,
  type WorkOrderStatus,
} from "@/lib/manufacturer/mock-data";
import FactoryClient from "./FactoryClient";

export default async function FactoryPage() {
  const stats = factoryStats();
  const wip = stationWIP();
  const throughput = productionThroughputLast7Days();
  const qcRaw = qcFailuresByStation();

  const wipRows = STATION_FLOW.map((st) => ({
    station: st,
    count: wip[st].count,
    rush: wip[st].rush,
    hold: wip[st].hold,
  }));

  const qcRows = STATION_FLOW.map((st) => ({
    station: st,
    passes: qcRaw[st].passes,
    fails: qcRaw[st].fails,
    fix_in_place: qcRaw[st].fix_in_place,
  }));

  const statusCounts: Record<WorkOrderStatus, number> = {
    queued: 0, in_progress: 0, qc_hold: 0, complete: 0, cancelled: 0,
  };
  for (const wo of WORK_ORDERS) statusCounts[wo.status]++;

  return (
    <FactoryClient
      workOrders={WORK_ORDERS}
      stats={stats}
      stationWIP={wipRows}
      throughput={throughput}
      qcByStation={qcRows}
      statusCounts={statusCounts}
    />
  );
}
