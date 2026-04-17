import { getEnrichedData } from "@/lib/manufacturer/enriched-data";
import { revenueTrendLast30Days } from "@/lib/manufacturer/mock-data";
import OverviewClient from "./OverviewClient";

export default async function OverviewPage() {
  const { dealers, shows, contracts, showrooms, atlasIsLive } = await getEnrichedData();

  const revenueToday = contracts
    .filter((c) => c.minutesAgo < 24 * 60)
    .reduce((s, c) => s + c.actualPrice, 0);
  const unitsToday = contracts.filter((c) => c.minutesAgo < 24 * 60).length;

  const summary = {
    totalDealers: dealers.length,
    totalShowrooms: showrooms.length,
    dealersWithMultipleShowrooms: dealers.filter((d) => d.showroomCount >= 2).length,
    atRiskDealers: dealers.filter((d) => d.healthScore > 0 && d.healthScore < 55).length,
    avgHealthScore: Math.round(
      dealers.filter((d) => d.healthScore > 0).reduce((s, d) => s + d.healthScore, 0) /
        Math.max(1, dealers.filter((d) => d.healthScore > 0).length)
    ),
    ytdUnits: dealers.reduce((s, d) => s + d.ytdUnits, 0),
    ytdRevenue: dealers.reduce((s, d) => s + d.ytdRevenue, 0),
    showroomRevenueYtd: dealers.reduce((s, d) => s + d.showroomRevenueYtd, 0),
    showRevenueYtd: dealers.reduce((s, d) => s + d.showRevenueYtd, 0),
    revenueToday,
    unitsToday,
    activeShows: shows.filter((s) => s.status === "live").length,
  };

  const top = [...dealers].sort((a, b) => b.ytdRevenue - a.ytdRevenue).slice(0, 5);
  const bottom = [...dealers]
    .filter((d) => d.healthScore > 0)
    .sort((a, b) => a.healthScore - b.healthScore)
    .slice(0, 5);
  const liveShows = shows.filter((s) => s.status === "live").slice(0, 4);
  const trend = revenueTrendLast30Days();

  return (
    <OverviewClient
      summary={summary}
      trend={trend}
      top={top}
      bottom={bottom}
      liveShows={liveShows}
      atlasIsLive={atlasIsLive}
    />
  );
}
