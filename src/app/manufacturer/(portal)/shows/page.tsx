import { getEnrichedData } from "@/lib/manufacturer/enriched-data";
import ShowsClient from "./ShowsClient";

export default async function ShowsPage() {
  const { shows } = await getEnrichedData();
  return <ShowsClient shows={shows} />;
}
