import { getEnrichedData } from "@/lib/manufacturer/enriched-data";
import PriceRealizationClient from "./PriceRealizationClient";

export default async function PriceRealizationPage() {
  const { dealers, contracts } = await getEnrichedData();

  let totalList = 0;
  let totalActual = 0;
  let totalDiscount = 0;
  const buckets: Record<string, number> = { "0%": 0, "0-3%": 0, "3-6%": 0, "6-10%": 0, "10%+": 0 };
  for (const c of contracts) {
    totalList += c.listPrice;
    totalActual += c.actualPrice;
    totalDiscount += c.discount;
    const p = c.discountPct * 100;
    if (p < 0.1) buckets["0%"]++;
    else if (p < 3) buckets["0-3%"]++;
    else if (p < 6) buckets["3-6%"]++;
    else if (p < 10) buckets["6-10%"]++;
    else buckets["10%+"]++;
  }
  const stats = {
    totalList,
    totalActual,
    totalDiscount,
    realizationPct: totalList > 0 ? (totalActual / totalList) * 100 : 0,
    avgDiscountPct: totalList > 0 ? (totalDiscount / totalList) * 100 : 0,
    buckets,
  };

  // Per-dealer discount outliers (need ≥10 contracts to rank)
  const byDealer: Record<string, { totalList: number; totalActual: number; n: number }> = {};
  for (const c of contracts) {
    if (!byDealer[c.dealerId]) byDealer[c.dealerId] = { totalList: 0, totalActual: 0, n: 0 };
    byDealer[c.dealerId].totalList += c.listPrice;
    byDealer[c.dealerId].totalActual += c.actualPrice;
    byDealer[c.dealerId].n++;
  }
  const outliers = Object.entries(byDealer)
    .map(([dealerId, v]) => {
      const dealer = dealers.find((d) => d.id === dealerId);
      if (!dealer) return null;
      return {
        dealer,
        avgDiscountPct: v.totalList > 0 ? ((v.totalList - v.totalActual) / v.totalList) * 100 : 0,
        contracts: v.n,
      };
    })
    .filter(
      (x): x is { dealer: import("@/lib/manufacturer/mock-data").Dealer; avgDiscountPct: number; contracts: number } =>
        x !== null && x.contracts >= 10
    )
    .sort((a, b) => b.avgDiscountPct - a.avgDiscountPct)
    .slice(0, 10);

  return <PriceRealizationClient data={{ stats, outliers }} />;
}
