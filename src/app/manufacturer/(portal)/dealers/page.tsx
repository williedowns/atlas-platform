import { getEnrichedData } from "@/lib/manufacturer/enriched-data";
import DealersClient from "./DealersClient";

export default async function DealersPage() {
  const { dealers, atlasIsLive } = await getEnrichedData();
  return <DealersClient dealers={dealers} atlasIsLive={atlasIsLive} />;
}
