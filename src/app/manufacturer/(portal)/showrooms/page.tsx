import { getEnrichedData } from "@/lib/manufacturer/enriched-data";
import ShowroomsClient from "./ShowroomsClient";

export default async function ShowroomsPage() {
  const { dealers, showrooms, atlasIsLive } = await getEnrichedData();

  const totalShowrooms = showrooms.length;
  const totalDealers = dealers.length;
  const avgShowroomsPerDealer = +(totalShowrooms / Math.max(1, totalDealers)).toFixed(2);
  const dealersWithMultipleShowrooms = dealers.filter((d) => d.showroomCount >= 2).length;
  const showroomRevenueYtd = dealers.reduce((s, d) => s + d.showroomRevenueYtd, 0);
  const showRevenueYtd = dealers.reduce((s, d) => s + d.showRevenueYtd, 0);

  const buckets: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6+": 0 };
  for (const d of dealers) {
    const key = d.showroomCount >= 6 ? "6+" : String(d.showroomCount);
    buckets[key] = (buckets[key] ?? 0) + 1;
  }
  const distribution = Object.entries(buckets).map(([count, d]) => ({ count, dealers: d }));

  const topByCount = [...dealers]
    .sort((a, b) => b.showroomCount - a.showroomCount || b.ytdRevenue - a.ytdRevenue)
    .slice(0, 10);

  const expansionCandidates = [...dealers]
    .filter((d) => d.showroomCount === 1 && (d.tier === "Platinum" || d.tier === "Gold"))
    .sort((a, b) => b.ytdRevenue - a.ytdRevenue)
    .slice(0, 10);

  const byRegion: Record<string, { showrooms: number; dealers: number; avgPerDealer: number }> = {};
  for (const d of dealers) {
    if (!byRegion[d.region]) byRegion[d.region] = { showrooms: 0, dealers: 0, avgPerDealer: 0 };
    byRegion[d.region].showrooms += d.showroomCount;
    byRegion[d.region].dealers++;
  }
  for (const k of Object.keys(byRegion)) {
    byRegion[k].avgPerDealer = +(byRegion[k].showrooms / byRegion[k].dealers).toFixed(2);
  }
  const regionData = Object.entries(byRegion).map(([region, stats]) => ({ region, ...stats }));

  const topRooms = [...showrooms].sort((a, b) => b.ytdRevenue - a.ytdRevenue).slice(0, 10);

  return (
    <ShowroomsClient
      atlasIsLive={atlasIsLive}
      data={{
        totalShowrooms,
        totalDealers,
        avgShowroomsPerDealer,
        dealersWithMultipleShowrooms,
        showroomRevenueYtd,
        showRevenueYtd,
        distribution,
        topByCount,
        expansionCandidates,
        regionData,
        topRooms,
        dealers,
      }}
    />
  );
}
