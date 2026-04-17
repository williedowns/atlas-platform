import { getEnrichedData } from "@/lib/manufacturer/enriched-data";
import InventoryClient from "./InventoryClient";

export default async function InventoryPage() {
  const { dealers } = await getEnrichedData();

  // Age buckets (across all dealers including live Atlas)
  const ageBuckets: Record<string, number> = { "0-30": 0, "30-60": 0, "60-90": 0, "90+": 0 };
  for (const d of dealers) {
    if (d.avgInventoryAge <= 30) ageBuckets["0-30"] += d.inventoryUnits;
    else if (d.avgInventoryAge <= 60) ageBuckets["30-60"] += d.inventoryUnits;
    else if (d.avgInventoryAge <= 90) ageBuckets["60-90"] += d.inventoryUnits;
    else ageBuckets["90+"] += d.inventoryUnits;
  }

  // Regional breakdown
  const regional: Record<string, { units: number; revenue: number; dealers: number }> = {};
  for (const d of dealers) {
    if (!regional[d.region]) regional[d.region] = { units: 0, revenue: 0, dealers: 0 };
    regional[d.region].dealers++;
    regional[d.region].units += d.inventoryUnits;
    regional[d.region].revenue += d.ytdRevenue;
  }

  const topInventoryDealers = [...dealers]
    .sort((a, b) => b.inventoryUnits - a.inventoryUnits)
    .slice(0, 10);

  const agingOutliers = [...dealers]
    .sort((a, b) => b.avgInventoryAge - a.avgInventoryAge)
    .slice(0, 8);

  const totalInventoryUnits = dealers.reduce((s, d) => s + d.inventoryUnits, 0);
  const avgInventoryAge =
    dealers.length > 0
      ? Math.round(dealers.reduce((s, d) => s + d.avgInventoryAge, 0) / dealers.length)
      : 0;

  return (
    <InventoryClient
      data={{
        ageBuckets,
        regional,
        topInventoryDealers,
        agingOutliers,
        totalInventoryUnits,
        totalDealers: dealers.length,
        avgInventoryAge,
      }}
    />
  );
}
