import {
  DEALER_ORDERS,
  dealerOrderStats,
  orderCountByStatus,
} from "@/lib/manufacturer/mock-data";
import DealerOrdersClient from "./DealerOrdersClient";

export default async function DealerOrdersPage() {
  const stats = dealerOrderStats();
  const countsByStatus = orderCountByStatus();

  return (
    <DealerOrdersClient
      orders={DEALER_ORDERS}
      stats={{
        totalOrders: stats.totalOrders,
        last24hCount: stats.last24hCount,
        last24hValue: stats.last24hValue,
        last7dCount: stats.last7dCount,
        last7dValue: stats.last7dValue,
        inProductionCount: stats.inProductionCount,
        inProductionUnits: stats.inProductionUnits,
        readyToShipCount: stats.readyToShipCount,
        shippedCount: stats.shippedCount,
        awaitingApprovalCount: stats.awaitingApprovalCount,
        creditHoldCount: stats.creditHoldCount,
        rushOrderCount: stats.rushOrderCount,
        backlogValue: stats.backlogValue,
        unitsInPipeline: stats.unitsInPipeline,
      }}
      countsByStatus={countsByStatus}
    />
  );
}
