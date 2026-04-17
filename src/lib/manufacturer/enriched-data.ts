/**
 * Server-side enriched data: returns mock dealers with Atlas's entry replaced
 * by live Supabase data. Uses React cache() so the live Atlas fetch happens
 * once per request even when multiple pages or sections consume it.
 *
 * Import from Server Components only — it pulls in atlas-live.ts which uses
 * the service-role key and is server-only.
 */

import "server-only";
import { cache } from "react";
import {
  DEALERS,
  CONTRACTS,
  SHOWS,
  SHOWROOMS,
  ATLAS_DEALER_ID,
  type Dealer,
  type Contract,
  type Show,
  type Showroom,
} from "./mock-data";
import { getAtlasLiveBundle } from "./atlas-live";

export interface EnrichedData {
  dealers: Dealer[];
  contracts: Contract[];
  shows: Show[];
  showrooms: Showroom[];
  atlasIsLive: boolean;
  atlasLiveSummary: {
    ytdContracts: number;
    ytdRevenue: number;
    locations: number;
    leads: number;
    inventory: number;
  } | null;
}

export const getEnrichedData = cache(async (): Promise<EnrichedData> => {
  const atlasBase = DEALERS.find((d) => d.id === ATLAS_DEALER_ID);
  if (!atlasBase) {
    return {
      dealers: DEALERS,
      contracts: CONTRACTS,
      shows: SHOWS,
      showrooms: SHOWROOMS,
      atlasIsLive: false,
      atlasLiveSummary: null,
    };
  }

  const live = await getAtlasLiveBundle(atlasBase);
  if (!live) {
    return {
      dealers: DEALERS,
      contracts: CONTRACTS,
      shows: SHOWS,
      showrooms: SHOWROOMS,
      atlasIsLive: false,
      atlasLiveSummary: null,
    };
  }

  // Replace Atlas mock dealer entry with live dealer
  const dealers = DEALERS.map((d) => (d.id === ATLAS_DEALER_ID ? live.dealer : d));

  // Replace Atlas showrooms: remove any mock Atlas showrooms, add live ones
  const showrooms = [
    ...SHOWROOMS.filter((s) => s.dealerId !== ATLAS_DEALER_ID),
    ...live.showrooms,
  ];

  // Merge contracts: remove any mock Atlas contracts (there shouldn't be any since mock
  // generates random dealer IDs), then prepend live Atlas contracts so they show up
  // in "recent" / "live" feeds.
  const contracts = [
    ...live.recentContracts,
    ...CONTRACTS.filter((c) => c.dealerId !== ATLAS_DEALER_ID),
  ].sort((a, b) => a.minutesAgo - b.minutesAgo);

  // Merge shows: mock shows + Atlas live shows
  const shows = [
    ...SHOWS.filter((s) => s.dealerId !== ATLAS_DEALER_ID),
    ...live.liveShows,
  ];

  return {
    dealers,
    contracts,
    shows,
    showrooms,
    atlasIsLive: true,
    atlasLiveSummary: {
      ytdContracts: live.dataHealth.contractsCount,
      ytdRevenue: live.dealer.ytdRevenue,
      locations: live.dataHealth.locationsCount,
      leads: live.dataHealth.leadsCount,
      inventory: live.dataHealth.inventoryCount,
    },
  };
});

/** Convenience helpers that mirror the mock-data exports but operate on enriched data. */

export const getEnrichedDealers = cache(async () => (await getEnrichedData()).dealers);
export const getEnrichedContracts = cache(async () => (await getEnrichedData()).contracts);
export const getEnrichedShows = cache(async () => (await getEnrichedData()).shows);
export const getEnrichedShowrooms = cache(async () => (await getEnrichedData()).showrooms);
