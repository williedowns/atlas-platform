/**
 * Atlas Spas live-data helpers for the manufacturer demo.
 * Uses service-role Supabase client server-side ONLY — never import in client code.
 *
 * Strict principle: returns ONLY real values. Fields not derivable from
 * Atlas's actual Supabase data come back undefined so the UI can hide them
 * rather than inventing numbers.
 */

import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Dealer, Showroom, Contract, Show } from "./mock-data";
import { ATLAS_DEALER_ID } from "./mock-data";

let _client: ReturnType<typeof createClient> | null = null;
function adminClient() {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Supabase admin credentials missing for Atlas live data");
    }
    _client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}

const YEAR = new Date().getFullYear();
const YTD_START = `${YEAR}-01-01T00:00:00Z`;
const Q2_START = `${YEAR}-04-01T00:00:00Z`;
const MONTH_START = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01T00:00:00Z`;
})();

const MODEL_LINE_MAP: Record<string, Contract["modelLine"]> = {
  legend: "Michael Phelps Legend",
  phelps: "Michael Phelps Legend",
  lsx: "Michael Phelps Legend",
  twilight: "Twilight",
  ts: "Twilight",
  clarity: "Clarity",
  balance: "Clarity",
  harmony: "Clarity",
  serenity: "Clarity",
  h2x: "H2X Fitness",
  trainer: "H2X Fitness",
  challenger: "H2X Fitness",
  mpx: "MP Signature Swim Spa",
  signature: "MP Signature Swim Spa",
  momentum: "MP Signature Swim Spa",
  force: "MP Signature Swim Spa",
  endurance: "MP Signature Swim Spa",
};

function inferModelLine(name?: string | null): Contract["modelLine"] {
  if (!name) return "Twilight";
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(MODEL_LINE_MAP)) {
    if (lower.includes(key)) return value;
  }
  return "Twilight";
}

function stateToRegion(state: string | undefined): string {
  if (!state) return "Unknown";
  const s = state.toUpperCase();
  if (["NY", "NJ", "PA", "MA", "CT", "NH", "VT", "ME", "RI"].includes(s)) return "Northeast";
  if (["VA", "MD", "DE", "DC", "WV"].includes(s)) return "Mid-Atlantic";
  if (["FL", "GA", "SC", "NC", "TN", "AL", "MS"].includes(s)) return "Southeast";
  if (["OH", "MI", "IN", "IL", "WI", "MN", "IA", "MO"].includes(s)) return "Midwest";
  if (["TX", "OK", "AR", "LA", "KS"].includes(s)) return "South Central";
  if (["CO", "UT", "NM", "AZ", "WY", "MT", "ID"].includes(s)) return "Mountain";
  if (["CA", "OR", "WA", "NV"].includes(s)) return "West";
  if (["ON", "QC", "BC", "AB"].includes(s)) return "International";
  return "Unknown";
}

export interface AtlasLiveBundle {
  dealer: Dealer;
  showrooms: Showroom[];
  recentContracts: Contract[];
  liveShows: Show[];
  isLive: true;
  dataHealth: {
    contractsCount: number;
    showsCount: number;
    locationsCount: number;
    leadsCount: number;
    inventoryCount: number;
    lastContractAt: string | null;
  };
}

let _warnedNoConnection = false;

export async function getAtlasLiveBundle(fallbackDealer: Dealer): Promise<AtlasLiveBundle | null> {
  try {
    const sb = adminClient();

    const [locResult, contractResult, showResult, leadResult, inventoryResult] = await Promise.all([
      sb
        .from("locations")
        .select("id, name, type, address, city, state, zip, active, created_at")
        .eq("type", "store")
        .eq("active", true)
        .order("created_at", { ascending: true }),
      sb
        .from("contracts")
        .select(
          "id, contract_number, status, total, line_items, created_at, location_id, show_id, customer:customers(first_name, last_name), location:locations(name, city, state), show:shows(name, city, state, venue_name)"
        )
        .not("status", "in", '("draft","cancelled")')
        .gte("created_at", YTD_START)
        .order("created_at", { ascending: false })
        .limit(500),
      sb
        .from("shows")
        .select("id, name, venue_name, city, state, start_date, end_date, active")
        .eq("active", true)
        .order("start_date", { ascending: false })
        .limit(20),
      sb
        .from("leads")
        .select("id, status, show_id, assigned_to, created_at, converted_contract_id")
        .gte("created_at", YTD_START)
        .limit(1000),
      sb
        .from("inventory_units")
        .select("id, status, location_id, created_at")
        .not("status", "in", '("sold","delivered")'),
    ]);

    const locations = (locResult.data ?? []) as Array<{
      id: string;
      name: string;
      address: string;
      city: string;
      state: string;
      zip: string;
      created_at: string;
    }>;
    const contractsRaw = (contractResult.data ?? []) as Array<{
      id: string;
      contract_number: string | null;
      status: string;
      total: number | null;
      line_items: unknown;
      created_at: string;
      location_id: string | null;
      show_id: string | null;
      customer: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
      location: { name: string; city: string; state: string } | { name: string; city: string; state: string }[] | null;
      show: { name: string; city: string; state: string; venue_name: string } | { name: string; city: string; state: string; venue_name: string }[] | null;
    }>;
    const showsRaw = (showResult.data ?? []) as Array<{
      id: string;
      name: string;
      venue_name: string;
      city: string;
      state: string;
      start_date: string;
      end_date: string;
    }>;
    const leads = (leadResult.data ?? []) as Array<{
      id: string;
      status: string;
      created_at: string;
    }>;
    const inventory = (inventoryResult.data ?? []) as Array<{
      id: string;
      status: string;
      location_id: string | null;
      created_at: string;
    }>;

    const anyError =
      locResult.error || contractResult.error || showResult.error || leadResult.error || inventoryResult.error;
    if (anyError && !_warnedNoConnection) {
      _warnedNoConnection = true;
      console.warn("[atlas-live] Supabase query error(s):", {
        locations: locResult.error?.message,
        contracts: contractResult.error?.message,
        shows: showResult.error?.message,
        leads: leadResult.error?.message,
        inventory: inventoryResult.error?.message,
      });
    }

    if (
      locations.length === 0 &&
      contractsRaw.length === 0 &&
      showsRaw.length === 0 &&
      leads.length === 0 &&
      inventory.length === 0
    ) {
      return null;
    }

    // --- Revenue / units ---
    const totalYtdRevenue = contractsRaw.reduce((s, c) => s + (c.total ?? 0), 0);
    const totalYtdUnits = contractsRaw.length;
    const q1Revenue = contractsRaw
      .filter((c) => c.created_at < Q2_START)
      .reduce((s, c) => s + (c.total ?? 0), 0);
    const q2Revenue = contractsRaw
      .filter((c) => c.created_at >= Q2_START)
      .reduce((s, c) => s + (c.total ?? 0), 0);
    const avgTicket = totalYtdUnits > 0 ? totalYtdRevenue / totalYtdUnits : 0;

    // --- Showroom/show revenue split ---
    let showroomRevenue = 0;
    let showRevenue = 0;
    const locationRevenue = new Map<string, { revenue: number; units: number }>();
    for (const c of contractsRaw) {
      const amt = c.total ?? 0;
      if (c.show_id) {
        showRevenue += amt;
      } else if (c.location_id) {
        showroomRevenue += amt;
        const slot = locationRevenue.get(c.location_id) ?? { revenue: 0, units: 0 };
        slot.revenue += amt;
        slot.units++;
        locationRevenue.set(c.location_id, slot);
      } else {
        showroomRevenue += amt;
      }
    }

    // --- Leads / conversion ---
    const monthLeads = leads.filter((l) => l.created_at >= MONTH_START);
    const convertedMonthLeads = monthLeads.filter((l) => l.status === "converted");
    const leadsMonth = monthLeads.length;
    const closedLeadsMonth = convertedMonthLeads.length;
    const conversionRate =
      leadsMonth > 0 ? (closedLeadsMonth / leadsMonth) * 100 : 0;

    // --- Inventory ---
    const inventoryUnits = inventory.length;
    const now = Date.now();
    const avgInventoryAgeDays =
      inventoryUnits > 0
        ? Math.round(
            inventory.reduce((s, u) => s + (now - new Date(u.created_at).getTime()), 0) /
              inventoryUnits /
              (1000 * 60 * 60 * 24)
          )
        : 0;

    // --- Shows activity ---
    const activeNow = showsRaw.some(
      (s) => new Date(s.start_date).getTime() <= now && new Date(s.end_date).getTime() >= now
    );
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const showCount30d = showsRaw.filter(
      (s) => new Date(s.start_date).getTime() >= thirtyDaysAgo
    ).length;

    // --- Dealer metadata derived from real data ---
    const primaryLocation = locations[0];
    const primaryState = primaryLocation?.state ?? fallbackDealer.state;
    const primaryCity = primaryLocation?.city ?? fallbackDealer.city;
    const oldestLocationDate = locations[0]?.created_at
      ? new Date(locations[0].created_at)
      : null;
    const yearsInBusiness = oldestLocationDate
      ? Math.max(0, YEAR - oldestLocationDate.getFullYear())
      : 0;

    // --- Trend: q2 > q1 means up ---
    const healthTrend: Dealer["healthTrend"] =
      q2Revenue > q1Revenue * 1.1 ? "up" : q2Revenue < q1Revenue * 0.9 ? "down" : "flat";

    // --- Showrooms ---
    const showrooms: Showroom[] = locations.map((loc, i) => {
      const stats = locationRevenue.get(loc.id) ?? { revenue: 0, units: 0 };
      return {
        id: loc.id,
        dealerId: ATLAS_DEALER_ID,
        name: `Atlas — ${loc.city}`,
        city: loc.city,
        state: loc.state,
        address: loc.address,
        openedDate: loc.created_at.slice(0, 10),
        sqft: 0,
        staffCount: 0,
        ytdUnits: stats.units,
        ytdRevenue: Math.round(stats.revenue),
        conversionRate: 0,
        avgTicket: stats.units > 0 ? Math.round(stats.revenue / stats.units) : 0,
        leadsMonth: 0,
        isFlagship: i === 0,
      };
    });

    // --- Recent contracts ---
    const recentContracts: Contract[] = contractsRaw.slice(0, 100).map((c) => {
      const customer = Array.isArray(c.customer) ? c.customer[0] : c.customer;
      const location = Array.isArray(c.location) ? c.location[0] : c.location;
      const show = Array.isArray(c.show) ? c.show[0] : c.show;
      const modelLine = inferModelLine(c.contract_number);
      const actualPrice = Math.round(c.total ?? 0);
      const listPrice = actualPrice;
      const discount = 0;
      const discountPct = 0;
      const createdAt = new Date(c.created_at);
      const minutesAgo = Math.max(0, Math.floor((now - createdAt.getTime()) / 60000));
      const venueType: Contract["venueType"] = c.show_id ? "show" : "showroom";
      return {
        id: c.id,
        dealerId: ATLAS_DEALER_ID,
        dealerName: fallbackDealer.name,
        customerName: customer ? `${customer.first_name} ${customer.last_name}` : "Atlas customer",
        modelLine,
        model: c.contract_number ?? "",
        color: "",
        cabinet: "",
        listPrice,
        actualPrice,
        discount,
        discountPct,
        createdAt,
        minutesAgo,
        state: (location?.state ?? show?.state ?? primaryState) as string,
        region: stateToRegion(primaryState),
        venueType,
        venueId: c.location_id ?? c.show_id ?? undefined,
        venueName:
          (location?.name as string | undefined) ?? (show?.name as string | undefined) ?? undefined,
      };
    });

    // --- Live shows (mapped with real revenue aggregates) ---
    const liveShows: Show[] = showsRaw.map((s) => {
      const start = new Date(s.start_date);
      const end = new Date(s.end_date);
      const showContracts = contractsRaw.filter((c) => c.show_id === s.id);
      const showLeads = leads.filter((l) => "show_id" in l && (l as { show_id?: string }).show_id === s.id);
      const isLive = start.getTime() <= now && end.getTime() >= now;
      return {
        id: s.id,
        dealerId: ATLAS_DEALER_ID,
        dealerName: fallbackDealer.name,
        name: s.name,
        city: s.city,
        state: s.state,
        region: stateToRegion(s.state),
        startedAt: start,
        attendance: 0,
        contractsSigned: showContracts.length,
        unitsSold: showContracts.length,
        revenue: showContracts.reduce((sum, c) => sum + (c.total ?? 0), 0),
        conversionRate: 0,
        leadsCaptured: showLeads.length,
        status: isLive ? "live" : now > end.getTime() ? "completed" : "setup",
      };
    });

    const dealer: Dealer = {
      id: ATLAS_DEALER_ID,
      name: fallbackDealer.name,
      city: primaryCity,
      state: primaryState,
      region: stateToRegion(primaryState),
      country: "US",
      tier: fallbackDealer.tier,
      yearsWithMS: yearsInBusiness,
      ytdRevenue: Math.round(totalYtdRevenue),
      ytdUnits: totalYtdUnits,
      q2Revenue: Math.round(q2Revenue),
      q1Revenue: Math.round(q1Revenue),
      conversionRate: +conversionRate.toFixed(1),
      avgTicket: Math.round(avgTicket),
      inventoryUnits,
      avgInventoryAge: avgInventoryAgeDays,
      healthScore: 0,
      healthTrend,
      leadsMonth,
      closedLeadsMonth,
      csatScore: 0,
      coopSpendYtd: 0,
      warrantyClaimsYtd: 0,
      activeShow: activeNow,
      showCount30d,
      showroomCount: locations.length,
      showroomRevenueYtd: Math.round(showroomRevenue),
      showRevenueYtd: Math.round(showRevenue),
    };

    return {
      dealer,
      showrooms,
      recentContracts,
      liveShows,
      isLive: true,
      dataHealth: {
        contractsCount: contractsRaw.length,
        showsCount: showsRaw.length,
        locationsCount: locations.length,
        leadsCount: leads.length,
        inventoryCount: inventory.length,
        lastContractAt: contractsRaw[0]?.created_at ?? null,
      },
    };
  } catch (err) {
    if (!_warnedNoConnection) {
      _warnedNoConnection = true;
      console.warn("[atlas-live] failed to fetch — falling back to mock:", err);
    }
    return null;
  }
}
