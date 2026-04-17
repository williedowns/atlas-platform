import { getEnrichedData } from "@/lib/manufacturer/enriched-data";
import SellThroughClient from "./SellThroughClient";

export default async function SellThroughPage() {
  const { contracts } = await getEnrichedData();
  // Only show last 24h
  const todaysContracts = contracts.filter((c) => c.minutesAgo < 60 * 24);
  return <SellThroughClient contracts={todaysContracts} />;
}
