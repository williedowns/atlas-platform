import { getEnrichedData } from "@/lib/manufacturer/enriched-data";
import LeaderboardClient from "./LeaderboardClient";

export default async function LeaderboardPage() {
  const { dealers, atlasIsLive } = await getEnrichedData();
  return <LeaderboardClient dealers={dealers} atlasIsLive={atlasIsLive} />;
}
