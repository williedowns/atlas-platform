/**
 * Realistic mock dataset for the Master Spas manufacturer portal demo.
 * Deterministic seeded randomness so the numbers stay stable between renders.
 */

type RNG = () => number;
function seededRng(seed: number): RNG {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
const rng = seededRng(20260417);

// Pinned deterministic "now" — both server render and client render agree on time-relative data
const DEMO_NOW_REF = new Date("2026-04-17T16:00:00Z").getTime();
function rInt(min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min;
}
function rPick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
function rPickWeighted<T>(items: { value: T; weight: number }[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = rng() * total;
  for (const it of items) {
    r -= it.weight;
    if (r <= 0) return it.value;
  }
  return items[items.length - 1].value;
}

export const MODEL_LINES = [
  "Michael Phelps Legend",
  "Twilight",
  "Clarity",
  "H2X Fitness",
  "MP Signature Swim Spa",
] as const;
export type ModelLine = (typeof MODEL_LINES)[number];

export const MODEL_LINE_INFO: Record<
  ModelLine,
  { tier: "Premium" | "Mid" | "Value" | "Swim Spa"; msrpLow: number; msrpHigh: number }
> = {
  "Michael Phelps Legend": { tier: "Premium", msrpLow: 14995, msrpHigh: 22995 },
  Twilight: { tier: "Mid", msrpLow: 9995, msrpHigh: 14995 },
  Clarity: { tier: "Value", msrpLow: 5995, msrpHigh: 9995 },
  "H2X Fitness": { tier: "Swim Spa", msrpLow: 17995, msrpHigh: 29995 },
  "MP Signature Swim Spa": { tier: "Swim Spa", msrpLow: 24995, msrpHigh: 39995 },
};

export const MODELS_BY_LINE: Record<ModelLine, string[]> = {
  "Michael Phelps Legend": ["LSX 30", "LSX 800", "LSX 900", "Legend 5"],
  Twilight: ["TS 8.25", "TS 7.25", "TS 6.25", "TS 240"],
  Clarity: ["Balance 7", "Balance 8", "Harmony 7", "Serenity 8"],
  "H2X Fitness": ["Challenger 15D", "Trainer 15D", "Trainer 19D", "Revive 19"],
  "MP Signature Swim Spa": ["MPX Momentum", "MPX Force", "MPX Endurance"],
};

export const COLORS = ["Silver Marble", "Midnight Pearl", "Sterling Opal", "Tuscan Sun", "Platinum"] as const;
export const CABINETS = ["Espresso", "Slate", "Cognac", "Dark Teak"] as const;

const US_REGIONS = [
  { region: "Northeast", states: ["NY", "NJ", "PA", "MA", "CT", "NH", "VT", "ME", "RI"] },
  { region: "Mid-Atlantic", states: ["VA", "MD", "DE", "DC", "WV"] },
  { region: "Southeast", states: ["FL", "GA", "SC", "NC", "TN", "AL", "MS"] },
  { region: "Midwest", states: ["OH", "MI", "IN", "IL", "WI", "MN", "IA", "MO"] },
  { region: "South Central", states: ["TX", "OK", "AR", "LA"] },
  { region: "Mountain", states: ["CO", "UT", "NM", "AZ", "WY", "MT", "ID"] },
  { region: "West", states: ["CA", "OR", "WA", "NV"] },
  { region: "International", states: ["ON", "QC", "BC", "AB", "UK", "GER", "AU", "JP"] },
];

const DEALER_NAME_PREFIXES = [
  "Aqua",
  "Blue Ridge",
  "Crystal",
  "Elite",
  "Family",
  "Great Lakes",
  "Harbor",
  "Heritage",
  "Horizon",
  "Lakeside",
  "Liberty",
  "Midwest",
  "Mountain",
  "Northern",
  "Oasis",
  "Pacific",
  "Paradise",
  "Pinnacle",
  "Premier",
  "Prestige",
  "Pure",
  "Riverside",
  "Signature",
  "Southern",
  "Spa World of",
  "Summit",
  "Sun",
  "Sunset",
  "Tropic",
  "Valley",
];

const DEALER_NAME_SUFFIXES = [
  "Spas",
  "Hot Tubs",
  "Pool & Spa",
  "Spa Company",
  "Spa Gallery",
  "Spa Depot",
  "Backyard Living",
  "Spa Outlet",
  "Hot Tub Warehouse",
  "Pools & Backyard",
  "Leisure",
  "Outdoor Living",
];

const CITY_NAMES_BY_STATE: Record<string, string[]> = {
  NY: ["Albany", "Rochester", "Syracuse", "Buffalo", "White Plains"],
  NJ: ["Newark", "Jersey City", "Edison", "Cherry Hill"],
  PA: ["Pittsburgh", "Philadelphia", "Allentown", "Lancaster"],
  MA: ["Boston", "Worcester", "Springfield"],
  CT: ["Hartford", "Stamford"],
  NH: ["Manchester", "Concord"],
  VT: ["Burlington"],
  ME: ["Portland"],
  RI: ["Providence"],
  VA: ["Richmond", "Virginia Beach", "Roanoke"],
  MD: ["Baltimore", "Annapolis", "Frederick"],
  DE: ["Wilmington"],
  DC: ["Washington"],
  WV: ["Charleston"],
  FL: ["Orlando", "Tampa", "Jacksonville", "Miami", "Naples"],
  GA: ["Atlanta", "Savannah", "Augusta"],
  SC: ["Charleston", "Columbia", "Greenville"],
  NC: ["Charlotte", "Raleigh", "Asheville", "Greensboro"],
  TN: ["Nashville", "Knoxville", "Memphis", "Chattanooga"],
  AL: ["Birmingham", "Huntsville", "Mobile"],
  MS: ["Jackson"],
  OH: ["Columbus", "Cleveland", "Cincinnati", "Toledo"],
  MI: ["Detroit", "Grand Rapids", "Lansing", "Ann Arbor"],
  IN: ["Indianapolis", "Fort Wayne", "Evansville"],
  IL: ["Chicago", "Peoria", "Naperville"],
  WI: ["Milwaukee", "Madison", "Green Bay"],
  MN: ["Minneapolis", "Saint Paul", "Rochester"],
  IA: ["Des Moines", "Cedar Rapids"],
  MO: ["Kansas City", "Saint Louis", "Springfield"],
  TX: ["Dallas", "Houston", "Austin", "San Antonio", "Fort Worth"],
  OK: ["Oklahoma City", "Tulsa"],
  AR: ["Little Rock"],
  LA: ["New Orleans", "Baton Rouge"],
  CO: ["Denver", "Colorado Springs", "Boulder"],
  UT: ["Salt Lake City", "Provo"],
  NM: ["Albuquerque"],
  AZ: ["Phoenix", "Tucson", "Scottsdale"],
  WY: ["Cheyenne"],
  MT: ["Billings"],
  ID: ["Boise"],
  CA: ["Los Angeles", "San Diego", "Sacramento", "San Jose", "Fresno"],
  OR: ["Portland", "Eugene"],
  WA: ["Seattle", "Spokane", "Tacoma"],
  NV: ["Las Vegas", "Reno"],
  ON: ["Toronto", "Ottawa", "Hamilton"],
  QC: ["Montreal", "Quebec City"],
  BC: ["Vancouver", "Victoria"],
  AB: ["Calgary", "Edmonton"],
  UK: ["London", "Manchester", "Birmingham"],
  GER: ["Munich", "Hamburg"],
  AU: ["Sydney", "Melbourne", "Brisbane"],
  JP: ["Tokyo", "Osaka"],
};

export interface Showroom {
  id: string;
  dealerId: string;
  name: string;
  city: string;
  state: string;
  address: string;
  openedDate: string;
  sqft: number;
  staffCount: number;
  ytdUnits: number;
  ytdRevenue: number;
  conversionRate: number;
  avgTicket: number;
  leadsMonth: number;
  isFlagship: boolean;
}

export interface Dealer {
  id: string;
  name: string;
  city: string;
  state: string;
  region: string;
  country: "US" | "CA" | "INT";
  tier: "Platinum" | "Gold" | "Silver" | "Bronze";
  yearsWithMS: number;
  ytdRevenue: number;
  ytdUnits: number;
  q2Revenue: number;
  q1Revenue: number;
  conversionRate: number;
  avgTicket: number;
  inventoryUnits: number;
  avgInventoryAge: number;
  healthScore: number;
  healthTrend: "up" | "down" | "flat";
  leadsMonth: number;
  closedLeadsMonth: number;
  csatScore: number;
  coopSpendYtd: number;
  warrantyClaimsYtd: number;
  activeShow?: boolean;
  showCount30d: number;
  showroomCount: number;
  showroomRevenueYtd: number;
  showRevenueYtd: number;
}

export interface Contract {
  id: string;
  dealerId: string;
  dealerName: string;
  customerName: string;
  modelLine: ModelLine;
  model: string;
  color: string;
  cabinet: string;
  listPrice: number;
  actualPrice: number;
  discount: number;
  discountPct: number;
  createdAt: Date;
  minutesAgo: number;
  state: string;
  region: string;
  venueType: "showroom" | "show";
  venueId?: string;
  venueName?: string;
}

export interface Show {
  id: string;
  dealerId: string;
  dealerName: string;
  name: string;
  city: string;
  state: string;
  region: string;
  startedAt: Date;
  attendance: number;
  contractsSigned: number;
  unitsSold: number;
  revenue: number;
  conversionRate: number;
  leadsCaptured: number;
  status: "live" | "setup" | "closing" | "completed";
}

function generateDealers(): Dealer[] {
  const dealers: Dealer[] = [];
  let dealerIdx = 0;
  for (const { region, states } of US_REGIONS) {
    for (const state of states) {
      const cities = CITY_NAMES_BY_STATE[state] ?? [state];
      const dealersInState = rInt(3, 9);
      for (let i = 0; i < dealersInState; i++) {
        const prefix = rPick(DEALER_NAME_PREFIXES);
        const suffix = rPick(DEALER_NAME_SUFFIXES);
        const city = rPick(cities);
        const tier = rPickWeighted<Dealer["tier"]>([
          { value: "Platinum", weight: 10 },
          { value: "Gold", weight: 25 },
          { value: "Silver", weight: 40 },
          { value: "Bronze", weight: 25 },
        ]);
        const tierMult = tier === "Platinum" ? 3.5 : tier === "Gold" ? 2.2 : tier === "Silver" ? 1.2 : 0.6;
        const ytdUnits = Math.round((rInt(35, 85) * tierMult) / 1.5);
        const avgTicket = rInt(11000, 18500);
        const ytdRevenue = ytdUnits * avgTicket;
        const healthBase = tier === "Platinum" ? 88 : tier === "Gold" ? 78 : tier === "Silver" ? 68 : 55;
        const healthScore = Math.max(20, Math.min(100, healthBase + rInt(-12, 12)));
        const showroomCount = rPickWeighted<number>(
          tier === "Platinum"
            ? [{ value: 3, weight: 20 }, { value: 4, weight: 25 }, { value: 5, weight: 20 }, { value: 6, weight: 15 }, { value: 7, weight: 10 }, { value: 8, weight: 10 }]
            : tier === "Gold"
            ? [{ value: 1, weight: 15 }, { value: 2, weight: 30 }, { value: 3, weight: 30 }, { value: 4, weight: 15 }, { value: 5, weight: 10 }]
            : tier === "Silver"
            ? [{ value: 1, weight: 55 }, { value: 2, weight: 30 }, { value: 3, weight: 15 }]
            : [{ value: 1, weight: 85 }, { value: 2, weight: 15 }]
        );
        const showroomShare = 0.55 + rng() * 0.25;

        dealers.push({
          id: `dlr-${String(dealerIdx).padStart(4, "0")}`,
          name: `${prefix} ${suffix}`,
          city,
          state,
          region,
          country: state.length === 2 && !["ON", "QC", "BC", "AB"].includes(state) && !["UK", "GER", "AU", "JP"].includes(state) ? "US" : ["ON", "QC", "BC", "AB"].includes(state) ? "CA" : "INT",
          tier,
          yearsWithMS: rInt(1, 22),
          ytdRevenue,
          ytdUnits,
          q2Revenue: ytdRevenue * 0.55,
          q1Revenue: ytdRevenue * 0.45,
          conversionRate: rInt(18, 42) + rng(),
          avgTicket,
          inventoryUnits: rInt(4, 28),
          avgInventoryAge: rInt(18, 82),
          healthScore,
          healthTrend: rPickWeighted<Dealer["healthTrend"]>([
            { value: "up", weight: 40 },
            { value: "flat", weight: 35 },
            { value: "down", weight: 25 },
          ]),
          leadsMonth: rInt(25, 180),
          closedLeadsMonth: rInt(5, 45),
          csatScore: 3.8 + rng() * 1.2,
          coopSpendYtd: rInt(2000, 25000),
          warrantyClaimsYtd: rInt(0, 12),
          activeShow: rng() < 0.08,
          showCount30d: rInt(0, 4),
          showroomCount,
          showroomRevenueYtd: Math.round(ytdRevenue * showroomShare),
          showRevenueYtd: Math.round(ytdRevenue * (1 - showroomShare)),
        });
        dealerIdx++;
      }
    }
  }
  return dealers;
}

function generateShowroomsForDealer(dealer: Dealer): Showroom[] {
  const cities = CITY_NAMES_BY_STATE[dealer.state] ?? [dealer.city];
  const rooms: Showroom[] = [];
  for (let i = 0; i < dealer.showroomCount; i++) {
    const city = i === 0 ? dealer.city : rPick(cities);
    const isFlagship = i === 0;
    const sqft = isFlagship ? rInt(6500, 14000) : rInt(3500, 8500);
    const staffCount = isFlagship ? rInt(8, 18) : rInt(4, 10);
    const unitsShare = isFlagship ? 0.35 + rng() * 0.2 : (1 - 0.4) / Math.max(1, dealer.showroomCount - 1);
    const showroomUnits = Math.round((dealer.showroomRevenueYtd / dealer.avgTicket) * unitsShare);
    const ytdRevenue = Math.round(showroomUnits * dealer.avgTicket * (0.95 + rng() * 0.1));
    const openedYearsAgo = isFlagship ? dealer.yearsWithMS : rInt(1, Math.max(2, dealer.yearsWithMS - 1));
    const openedYear = 2026 - openedYearsAgo;
    rooms.push({
      id: `sr-${dealer.id}-${i}`,
      dealerId: dealer.id,
      name: isFlagship ? `${dealer.name} — ${city} Flagship` : `${dealer.name} — ${city}`,
      city,
      state: dealer.state,
      address: `${rInt(100, 9999)} ${rPick(["Main St", "Commerce Blvd", "Market Pl", "Retail Row", "Park Ave", "Highway 30"])}`,
      openedDate: `${openedYear}-${String(rInt(1, 12)).padStart(2, "0")}-${String(rInt(1, 28)).padStart(2, "0")}`,
      sqft,
      staffCount,
      ytdUnits: Math.max(0, showroomUnits),
      ytdRevenue,
      conversionRate: 18 + rng() * 24,
      avgTicket: dealer.avgTicket,
      leadsMonth: Math.round((dealer.leadsMonth / dealer.showroomCount) * (isFlagship ? 1.4 : 0.8)),
      isFlagship,
    });
  }
  return rooms;
}

const FIRST_NAMES = ["Michael", "Jennifer", "David", "Sarah", "Robert", "Linda", "James", "Patricia", "John", "Karen", "William", "Susan", "Richard", "Jessica", "Thomas", "Emily", "Christopher", "Rebecca", "Charles", "Laura", "Daniel", "Amanda", "Matthew", "Michelle", "Mark", "Kimberly", "Steven", "Amy", "Paul", "Melissa"];
const LAST_NAMES = ["Anderson", "Brown", "Clark", "Davis", "Evans", "Fischer", "Garcia", "Hill", "Jackson", "Kelly", "Lewis", "Martinez", "Nelson", "Owens", "Perez", "Quinn", "Roberts", "Smith", "Taylor", "Ustinov", "Vazquez", "Walker", "Young", "Zhang", "Adams", "Baker", "Cooper", "Dunn", "Edwards", "Foster"];

function generateContracts(
  dealers: Dealer[],
  dealerShowrooms: Map<string, Showroom[]>,
  n: number
): Contract[] {
  const out: Contract[] = [];
  for (let i = 0; i < n; i++) {
    const dealer = rPick(dealers);
    const modelLine = rPickWeighted<ModelLine>([
      { value: "Michael Phelps Legend", weight: 25 },
      { value: "Twilight", weight: 30 },
      { value: "Clarity", weight: 20 },
      { value: "H2X Fitness", weight: 15 },
      { value: "MP Signature Swim Spa", weight: 10 },
    ]);
    const info = MODEL_LINE_INFO[modelLine];
    const listPrice = rInt(info.msrpLow, info.msrpHigh);
    const discountPct = Math.max(0, rng() * 0.14 - 0.02);
    const discount = Math.round(listPrice * discountPct);
    const actualPrice = listPrice - discount;
    const minutesAgo = rInt(0, 60 * 24);
    const createdAt = new Date(DEMO_NOW_REF - minutesAgo * 60 * 1000);

    const atShow = rng() < dealer.showRevenueYtd / Math.max(1, dealer.ytdRevenue);
    let venueType: "showroom" | "show" = atShow ? "show" : "showroom";
    let venueId: string | undefined;
    let venueName: string | undefined;
    if (venueType === "showroom") {
      const rooms = dealerShowrooms.get(dealer.id);
      if (rooms && rooms.length) {
        const room = rPickWeighted(
          rooms.map((r) => ({ value: r, weight: r.isFlagship ? 2.5 : 1 }))
        );
        venueId = room.id;
        venueName = room.name;
      } else {
        venueType = "show";
      }
    }

    out.push({
      id: `c-${String(i).padStart(6, "0")}`,
      dealerId: dealer.id,
      dealerName: dealer.name,
      customerName: `${rPick(FIRST_NAMES)} ${rPick(LAST_NAMES)}`,
      modelLine,
      model: rPick(MODELS_BY_LINE[modelLine]),
      color: rPick(COLORS),
      cabinet: rPick(CABINETS),
      listPrice,
      actualPrice,
      discount,
      discountPct,
      createdAt,
      minutesAgo,
      state: dealer.state,
      region: dealer.region,
      venueType,
      venueId,
      venueName,
    });
  }
  return out.sort((a, b) => a.minutesAgo - b.minutesAgo);
}

function generateShows(dealers: Dealer[]): Show[] {
  const activeDealers = dealers.filter((d) => d.activeShow).slice(0, 47);
  return activeDealers.map((d, i) => {
    const hoursRunning = rInt(1, 8);
    const attendance = rInt(40, 520);
    const contractsSigned = rInt(0, Math.max(1, Math.floor(attendance * 0.04)));
    const unitsSold = contractsSigned + rInt(-1, 2);
    const avgTicket = d.avgTicket;
    const revenue = Math.max(0, unitsSold) * avgTicket;
    const leadsCaptured = Math.max(
      contractsSigned,
      rInt(Math.round(attendance * 0.1), Math.round(attendance * 0.35))
    );
    const status: Show["status"] =
      hoursRunning < 2 ? "setup" : hoursRunning > 6 ? "closing" : "live";
    const showNames = [
      "Home & Garden Show",
      "Backyard Living Expo",
      "Spring Home Show",
      "Fall Home Show",
      "Patio & Pool Expo",
      "Summer Living Show",
      "Outdoor Showcase",
    ];
    return {
      id: `show-${i}`,
      dealerId: d.id,
      dealerName: d.name,
      name: `${d.city} ${rPick(showNames)}`,
      city: d.city,
      state: d.state,
      region: d.region,
      startedAt: new Date(DEMO_NOW_REF - hoursRunning * 60 * 60 * 1000),
      attendance,
      contractsSigned,
      unitsSold: Math.max(0, unitsSold),
      revenue,
      conversionRate: (contractsSigned / Math.max(1, leadsCaptured)) * 100,
      leadsCaptured,
      status,
    };
  });
}

export const ATLAS_DEALER_ID = "dlr-atlas";

const ATLAS_DEALER: Dealer = {
  id: ATLAS_DEALER_ID,
  name: "Atlas Spas & Swim Spas",
  city: "Kalamazoo",
  state: "MI",
  region: "Midwest",
  country: "US",
  tier: "Platinum",
  yearsWithMS: 12,
  ytdRevenue: 4820000,
  ytdUnits: 312,
  q2Revenue: 2651000,
  q1Revenue: 2169000,
  conversionRate: 33.6,
  avgTicket: 15449,
  inventoryUnits: 42,
  avgInventoryAge: 38,
  healthScore: 91,
  healthTrend: "up",
  leadsMonth: 285,
  closedLeadsMonth: 96,
  csatScore: 4.8,
  coopSpendYtd: 47500,
  warrantyClaimsYtd: 3,
  activeShow: true,
  showCount30d: 4,
  showroomCount: 6,
  showroomRevenueYtd: 3015000,
  showRevenueYtd: 1805000,
};

export const DEALERS: Dealer[] = [ATLAS_DEALER, ...generateDealers()];

export const SHOWROOMS: Showroom[] = DEALERS.flatMap(generateShowroomsForDealer);
const _dealerShowroomMap = new Map<string, Showroom[]>();
for (const s of SHOWROOMS) {
  const arr = _dealerShowroomMap.get(s.dealerId) ?? [];
  arr.push(s);
  _dealerShowroomMap.set(s.dealerId, arr);
}

export const CONTRACTS: Contract[] = generateContracts(DEALERS, _dealerShowroomMap, 14000);
export const SHOWS: Show[] = generateShows(DEALERS);

// Pinned deterministic "now" so server-render and client-render agree on time-relative data
// (avoids hydration mismatches from Date.now() drift between renders).
export const DEMO_NOW = DEMO_NOW_REF;
export const TODAYS_CONTRACTS: Contract[] = CONTRACTS.filter(
  (c) => c.createdAt.getTime() > DEMO_NOW - 24 * 60 * 60 * 1000
);
export const LAST_HOUR_CONTRACTS: Contract[] = CONTRACTS.filter(
  (c) => c.createdAt.getTime() > DEMO_NOW - 60 * 60 * 1000
);

export const NETWORK_STATS = {
  totalDealers: DEALERS.length,
  activeShows: SHOWS.length,
  unitsToday: TODAYS_CONTRACTS.length,
  revenueToday: TODAYS_CONTRACTS.reduce((s, c) => s + c.actualPrice, 0),
  unitsLastHour: LAST_HOUR_CONTRACTS.length,
  revenueLastHour: LAST_HOUR_CONTRACTS.reduce((s, c) => s + c.actualPrice, 0),
  totalInventoryUnits: DEALERS.reduce((s, d) => s + d.inventoryUnits, 0),
  ytdRevenue: DEALERS.reduce((s, d) => s + d.ytdRevenue, 0),
  ytdUnits: DEALERS.reduce((s, d) => s + d.ytdUnits, 0),
  avgHealthScore: Math.round(
    DEALERS.reduce((s, d) => s + d.healthScore, 0) / DEALERS.length
  ),
  atRiskDealers: DEALERS.filter((d) => d.healthScore < 55).length,
  totalShowrooms: SHOWROOMS.length,
  avgShowroomsPerDealer: +(SHOWROOMS.length / DEALERS.length).toFixed(2),
  showroomRevenueYtd: DEALERS.reduce((s, d) => s + d.showroomRevenueYtd, 0),
  showRevenueYtd: DEALERS.reduce((s, d) => s + d.showRevenueYtd, 0),
  dealersWithMultipleShowrooms: DEALERS.filter((d) => d.showroomCount >= 2).length,
  singleLocationDealers: DEALERS.filter((d) => d.showroomCount === 1).length,
};

export function revenueTrendLast30Days() {
  const out = [];
  for (let i = 29; i >= 0; i--) {
    const base = 18 + Math.sin(i * 0.3) * 6;
    const noise = Math.cos(i * 1.1) * 4;
    const units = Math.max(2, Math.round(base + noise + rInt(-3, 5)));
    out.push({
      day: i === 0 ? "Today" : `-${i}d`,
      date: new Date(DEMO_NOW - i * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      units,
      revenue: units * 13500,
    });
  }
  return out;
}

export function topDealers(n = 10) {
  return [...DEALERS].sort((a, b) => b.ytdRevenue - a.ytdRevenue).slice(0, n);
}

export function bottomDealers(n = 5) {
  return [...DEALERS].sort((a, b) => a.healthScore - b.healthScore).slice(0, n);
}

export function dealerById(id: string) {
  return DEALERS.find((d) => d.id === id);
}

export function contractsForDealer(dealerId: string, limit = 20) {
  return CONTRACTS.filter((c) => c.dealerId === dealerId).slice(0, limit);
}

export function showroomsForDealer(dealerId: string): Showroom[] {
  return SHOWROOMS.filter((s) => s.dealerId === dealerId);
}

export function showroomCountDistribution() {
  const buckets: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6+": 0 };
  for (const d of DEALERS) {
    const key = d.showroomCount >= 6 ? "6+" : String(d.showroomCount);
    buckets[key] = (buckets[key] ?? 0) + 1;
  }
  return Object.entries(buckets).map(([count, dealers]) => ({ count, dealers }));
}

export function topDealersByShowrooms(n = 10) {
  return [...DEALERS]
    .sort((a, b) => b.showroomCount - a.showroomCount || b.ytdRevenue - a.ytdRevenue)
    .slice(0, n);
}

export function showroomExpansionCandidates(n = 10) {
  return [...DEALERS]
    .filter((d) => d.showroomCount === 1 && (d.tier === "Platinum" || d.tier === "Gold"))
    .sort((a, b) => b.ytdRevenue - a.ytdRevenue)
    .slice(0, n);
}

export function showroomsByRegion() {
  const byRegion: Record<string, { showrooms: number; dealers: number; avgPerDealer: number }> = {};
  for (const d of DEALERS) {
    if (!byRegion[d.region]) byRegion[d.region] = { showrooms: 0, dealers: 0, avgPerDealer: 0 };
    byRegion[d.region].showrooms += d.showroomCount;
    byRegion[d.region].dealers++;
  }
  for (const k of Object.keys(byRegion)) {
    byRegion[k].avgPerDealer = +(byRegion[k].showrooms / byRegion[k].dealers).toFixed(2);
  }
  return byRegion;
}

export function topShowrooms(n = 10) {
  return [...SHOWROOMS]
    .sort((a, b) => b.ytdRevenue - a.ytdRevenue)
    .slice(0, n);
}

export function modelMix() {
  const mix: Record<ModelLine, { units: number; revenue: number; discount: number }> = {
    "Michael Phelps Legend": { units: 0, revenue: 0, discount: 0 },
    Twilight: { units: 0, revenue: 0, discount: 0 },
    Clarity: { units: 0, revenue: 0, discount: 0 },
    "H2X Fitness": { units: 0, revenue: 0, discount: 0 },
    "MP Signature Swim Spa": { units: 0, revenue: 0, discount: 0 },
  };
  for (const c of CONTRACTS) {
    mix[c.modelLine].units++;
    mix[c.modelLine].revenue += c.actualPrice;
    mix[c.modelLine].discount += c.discount;
  }
  return mix;
}

export function regionalBreakdown() {
  const byRegion: Record<string, { units: number; revenue: number; dealers: number }> = {};
  for (const d of DEALERS) {
    if (!byRegion[d.region]) byRegion[d.region] = { units: 0, revenue: 0, dealers: 0 };
    byRegion[d.region].dealers++;
    byRegion[d.region].units += d.ytdUnits;
    byRegion[d.region].revenue += d.ytdRevenue;
  }
  return byRegion;
}

export function colorMix() {
  const mix: Record<string, number> = {};
  for (const c of CONTRACTS) {
    mix[c.color] = (mix[c.color] ?? 0) + 1;
  }
  return mix;
}

export function inventoryByAge() {
  return {
    "0-30": DEALERS.filter((d) => d.avgInventoryAge <= 30).reduce((s, d) => s + d.inventoryUnits, 0),
    "30-60": DEALERS.filter((d) => d.avgInventoryAge > 30 && d.avgInventoryAge <= 60).reduce((s, d) => s + d.inventoryUnits, 0),
    "60-90": DEALERS.filter((d) => d.avgInventoryAge > 60 && d.avgInventoryAge <= 90).reduce((s, d) => s + d.inventoryUnits, 0),
    "90+": DEALERS.filter((d) => d.avgInventoryAge > 90).reduce((s, d) => s + d.inventoryUnits, 0),
  };
}

export function priceRealizationStats() {
  let totalList = 0;
  let totalActual = 0;
  let totalDiscount = 0;
  const buckets = { "0%": 0, "0-3%": 0, "3-6%": 0, "6-10%": 0, "10%+": 0 };
  for (const c of CONTRACTS) {
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
  return {
    totalList,
    totalActual,
    totalDiscount,
    realizationPct: (totalActual / totalList) * 100,
    avgDiscountPct: (totalDiscount / totalList) * 100,
    buckets,
  };
}

export function dealerDiscountOutliers(n = 10) {
  const byDealer: Record<string, { dealer: Dealer; totalList: number; totalActual: number; n: number }> = {};
  for (const c of CONTRACTS) {
    const d = DEALERS.find((x) => x.id === c.dealerId);
    if (!d) continue;
    if (!byDealer[c.dealerId]) byDealer[c.dealerId] = { dealer: d, totalList: 0, totalActual: 0, n: 0 };
    byDealer[c.dealerId].totalList += c.listPrice;
    byDealer[c.dealerId].totalActual += c.actualPrice;
    byDealer[c.dealerId].n++;
  }
  return Object.values(byDealer)
    .filter((x) => x.n >= 10)
    .map((x) => ({
      dealer: x.dealer,
      avgDiscountPct: ((x.totalList - x.totalActual) / x.totalList) * 100,
      contracts: x.n,
    }))
    .sort((a, b) => b.avgDiscountPct - a.avgDiscountPct)
    .slice(0, n);
}
