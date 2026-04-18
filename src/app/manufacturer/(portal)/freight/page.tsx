import {
  SHIPMENTS,
  shipmentStats,
  carrierPerformance,
  openClaims,
  type ShipmentStatus,
} from "@/lib/manufacturer/mock-data";
import FreightClient from "./FreightClient";

export default async function FreightPage() {
  const stats = shipmentStats();
  const carriers = carrierPerformance();
  const claims = openClaims();

  const statusCounts: Record<ShipmentStatus, number> = {
    scheduled: 0, picked_up: 0, in_transit: 0, out_for_delivery: 0,
    delivered: 0, delayed: 0, exception: 0,
  };
  for (const s of SHIPMENTS) statusCounts[s.status]++;

  return (
    <FreightClient
      shipments={SHIPMENTS}
      stats={stats}
      carriers={carriers}
      claims={claims}
      statusCounts={statusCounts}
    />
  );
}
