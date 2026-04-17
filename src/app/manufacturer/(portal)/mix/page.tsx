import { getEnrichedData } from "@/lib/manufacturer/enriched-data";
import { MODEL_LINES, type ModelLine } from "@/lib/manufacturer/mock-data";
import MixClient from "./MixClient";

export default async function MixPage() {
  const { dealers, contracts } = await getEnrichedData();

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
  // Ensure keys exist
  for (const m of MODEL_LINES) {
    if (!mix[m]) mix[m] = { units: 0, revenue: 0, discount: 0 };
  }

  const colorMix: Record<string, number> = {};
  for (const c of contracts) {
    if (!c.color) continue;
    colorMix[c.color] = (colorMix[c.color] ?? 0) + 1;
  }

  const regional: Record<string, { units: number; revenue: number; dealers: number }> = {};
  for (const d of dealers) {
    if (!regional[d.region]) regional[d.region] = { units: 0, revenue: 0, dealers: 0 };
    regional[d.region].dealers++;
    regional[d.region].units += d.ytdUnits;
    regional[d.region].revenue += d.ytdRevenue;
  }

  return <MixClient data={{ mix, colorMix, regional }} />;
}
