import { getEnrichedData } from "@/lib/manufacturer/enriched-data";
import {
  revenueTrendLast30Days,
  MODEL_LINES,
  type ModelLine,
} from "@/lib/manufacturer/mock-data";
import CommandCenterClient from "./CommandCenterClient";

export default async function CommandCenterPage() {
  const { dealers, contracts, shows } = await getEnrichedData();

  const lastHourContracts = contracts.filter((c) => c.minutesAgo < 60);
  const todaysContracts = contracts.filter((c) => c.minutesAgo < 60 * 24);
  const liveShows = shows.filter((s) => s.status === "live");

  const mix: Record<ModelLine, { units: number; revenue: number; discount: number }> = {
    "Michael Phelps Legend": { units: 0, revenue: 0, discount: 0 },
    Twilight: { units: 0, revenue: 0, discount: 0 },
    Clarity: { units: 0, revenue: 0, discount: 0 },
    "H2X Fitness": { units: 0, revenue: 0, discount: 0 },
    "MP Signature Swim Spa": { units: 0, revenue: 0, discount: 0 },
  };
  for (const c of contracts) {
    mix[c.modelLine].units++;
    mix[c.modelLine].revenue += c.actualPrice;
    mix[c.modelLine].discount += c.discount;
  }
  for (const m of MODEL_LINES) {
    if (!mix[m]) mix[m] = { units: 0, revenue: 0, discount: 0 };
  }

  const trend14d = revenueTrendLast30Days().slice(-14);

  return (
    <CommandCenterClient
      data={{
        totalDealers: dealers.length,
        revenueToday: todaysContracts.reduce((s, c) => s + c.actualPrice, 0),
        unitsToday: todaysContracts.length,
        revenueLastHour: lastHourContracts.reduce((s, c) => s + c.actualPrice, 0),
        unitsLastHour: lastHourContracts.length,
        totalInventoryUnits: dealers.reduce((s, d) => s + d.inventoryUnits, 0),
        mix,
        trend14d,
        lastHourContracts,
        liveShows,
      }}
    />
  );
}
