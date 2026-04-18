import {
  WARRANTY_CLAIMS,
  warrantyStats,
  defectRateByModel,
  defectCategoryBreakdown,
  warrantyMonthlyTrend,
  type WarrantyClaimStatus,
} from "@/lib/manufacturer/mock-data";
import WarrantyClient from "./WarrantyClient";

export default async function WarrantyPage() {
  const stats = warrantyStats();
  const defectByModel = defectRateByModel();
  const defectByCategory = defectCategoryBreakdown();
  const monthlyTrend = warrantyMonthlyTrend();

  const statusCounts: Record<WarrantyClaimStatus, number> = {
    submitted: 0, under_review: 0, approved: 0, parts_shipped: 0,
    scheduled: 0, in_service: 0, resolved: 0, denied: 0,
  };
  for (const c of WARRANTY_CLAIMS) statusCounts[c.status]++;

  return (
    <WarrantyClient
      claims={WARRANTY_CLAIMS}
      stats={stats}
      defectByModel={defectByModel}
      defectByCategory={defectByCategory}
      monthlyTrend={monthlyTrend}
      statusCounts={statusCounts}
    />
  );
}
