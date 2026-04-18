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

// ═══════════════════════════════════════════════════════════════════
// DealerOrder module (Module 2 of comprehensive build-out)
// B2B orders placed by dealers to the manufacturer.
// ═══════════════════════════════════════════════════════════════════

export type DealerOrderStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "in_production"
  | "ready_to_ship"
  | "shipped"
  | "delivered"
  | "cancelled";

export const DEALER_ORDER_STATUS_LABELS: Record<DealerOrderStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  in_production: "In Production",
  ready_to_ship: "Ready to Ship",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const DEALER_ORDER_STATUS_COLORS: Record<DealerOrderStatus, string> = {
  draft: "#94A3B8",
  submitted: "#0891B2",
  approved: "#7C3AED",
  in_production: "#D97706",
  ready_to_ship: "#EAB308",
  shipped: "#0EA5E9",
  delivered: "#059669",
  cancelled: "#DC2626",
};

export type PaymentTerms = "prepay" | "net_15" | "net_30" | "net_60" | "floor_plan";

export interface DealerOrderLine {
  modelLine: ModelLine;
  model: string;
  color: string;
  cabinet: string;
  qty: number;
  unitCost: number; // dealer wholesale cost
  unitMsrp: number; // for reference
  lineTotal: number;
}

export interface DealerOrder {
  id: string;
  orderNumber: string;
  dealerId: string;
  dealerName: string;
  dealerCity: string;
  dealerState: string;
  dealerTier: Dealer["tier"];
  status: DealerOrderStatus;
  lines: DealerOrderLine[];
  unitCount: number;
  subtotal: number;
  freight: number;
  total: number;
  paymentTerms: PaymentTerms;
  placedAt: Date;
  placedMinutesAgo: number;
  approvedAt?: Date;
  promisedShipAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  carrier?: string;
  trackingNumber?: string;
  notes?: string;
  creditHold: boolean;
  priority: "standard" | "rush";
}

const CARRIERS = ["Old Dominion", "Estes Express", "XPO Logistics", "Saia LTL", "R+L Carriers"];

function wholesalePriceFor(msrp: number, tier: Dealer["tier"]): number {
  const discount =
    tier === "Platinum" ? 0.4 : tier === "Gold" ? 0.37 : tier === "Silver" ? 0.34 : 0.31;
  return Math.round(msrp * (1 - discount));
}

function generateDealerOrders(dealers: Dealer[], n: number): DealerOrder[] {
  const out: DealerOrder[] = [];
  const now = DEMO_NOW_REF;

  for (let i = 0; i < n; i++) {
    const dealer = rPick(dealers);
    // Larger / better-tier dealers place more orders of more units.
    const tierOrderMult =
      dealer.tier === "Platinum" ? 3 : dealer.tier === "Gold" ? 2 : dealer.tier === "Silver" ? 1 : 0.6;
    const numLines = Math.max(1, Math.round(rInt(1, 4) * tierOrderMult * 0.6));
    const lines: DealerOrderLine[] = [];
    let subtotal = 0;
    let unitCount = 0;

    for (let j = 0; j < numLines; j++) {
      const modelLine = rPickWeighted<ModelLine>([
        { value: "Michael Phelps Legend", weight: 22 },
        { value: "Twilight", weight: 32 },
        { value: "Clarity", weight: 22 },
        { value: "H2X Fitness", weight: 14 },
        { value: "MP Signature Swim Spa", weight: 10 },
      ]);
      const info = MODEL_LINE_INFO[modelLine];
      const msrp = rInt(info.msrpLow, info.msrpHigh);
      const unitCost = wholesalePriceFor(msrp, dealer.tier);
      const qty = rInt(1, 3);
      const lineTotal = unitCost * qty;
      lines.push({
        modelLine,
        model: rPick(MODELS_BY_LINE[modelLine]),
        color: rPick(COLORS),
        cabinet: rPick(CABINETS),
        qty,
        unitCost,
        unitMsrp: msrp,
        lineTotal,
      });
      subtotal += lineTotal;
      unitCount += qty;
    }

    const freight = Math.round(250 + unitCount * rInt(180, 320));
    const total = subtotal + freight;

    // Distribute placedAt over last 90 days, weighted toward recent
    const minutesAgo = Math.max(0, Math.floor(Math.pow(rng(), 0.5) * 90 * 24 * 60));
    const placedAt = new Date(now - minutesAgo * 60 * 1000);

    // Status depends on how long ago it was placed
    let status: DealerOrderStatus;
    const ageDays = minutesAgo / 60 / 24;
    if (ageDays > 45) {
      status = rPickWeighted<DealerOrderStatus>([
        { value: "delivered", weight: 80 },
        { value: "shipped", weight: 15 },
        { value: "cancelled", weight: 5 },
      ]);
    } else if (ageDays > 21) {
      status = rPickWeighted<DealerOrderStatus>([
        { value: "delivered", weight: 40 },
        { value: "shipped", weight: 35 },
        { value: "ready_to_ship", weight: 15 },
        { value: "in_production", weight: 10 },
      ]);
    } else if (ageDays > 7) {
      status = rPickWeighted<DealerOrderStatus>([
        { value: "shipped", weight: 20 },
        { value: "ready_to_ship", weight: 25 },
        { value: "in_production", weight: 40 },
        { value: "approved", weight: 15 },
      ]);
    } else if (ageDays > 1) {
      status = rPickWeighted<DealerOrderStatus>([
        { value: "approved", weight: 40 },
        { value: "in_production", weight: 30 },
        { value: "submitted", weight: 20 },
        { value: "draft", weight: 10 },
      ]);
    } else {
      status = rPickWeighted<DealerOrderStatus>([
        { value: "submitted", weight: 50 },
        { value: "approved", weight: 30 },
        { value: "draft", weight: 20 },
      ]);
    }

    const approvedAt =
      status !== "draft" && status !== "submitted" ? new Date(placedAt.getTime() + rInt(30, 180) * 60 * 1000) : undefined;
    const promisedShipAt =
      approvedAt ? new Date(approvedAt.getTime() + rInt(14, 28) * 24 * 60 * 60 * 1000) : undefined;
    // Shipped/delivered dates must fall between approval and "now" — never future
    const shippedAt =
      status === "shipped" || status === "delivered"
        ? new Date(
            Math.min(
              now - rInt(60, 2880) * 60 * 1000, // at least 1h, up to 2d ago
              (approvedAt?.getTime() ?? placedAt.getTime()) + rInt(10, 28) * 24 * 60 * 60 * 1000
            )
          )
        : undefined;
    const deliveredAt =
      status === "delivered" && shippedAt
        ? new Date(Math.min(now - rInt(0, 1440) * 60 * 1000, shippedAt.getTime() + rInt(2, 7) * 24 * 60 * 60 * 1000))
        : undefined;
    const cancelledAt =
      status === "cancelled" ? new Date(placedAt.getTime() + rInt(60, 2880) * 60 * 1000) : undefined;

    const paymentTerms = rPickWeighted<PaymentTerms>([
      { value: "net_30", weight: 55 },
      { value: "net_60", weight: 15 },
      { value: "net_15", weight: 10 },
      { value: "prepay", weight: 10 },
      { value: "floor_plan", weight: 10 },
    ]);

    out.push({
      id: `ord-${String(i).padStart(6, "0")}`,
      orderNumber: "MS-" + new Date(placedAt).getFullYear().toString().slice(-2) +
        String(placedAt.getMonth() + 1).padStart(2, "0") + "-" +
        String(10000 + i).padStart(5, "0"),
      dealerId: dealer.id,
      dealerName: dealer.name,
      dealerCity: dealer.city,
      dealerState: dealer.state,
      dealerTier: dealer.tier,
      status,
      lines,
      unitCount,
      subtotal,
      freight,
      total,
      paymentTerms,
      placedAt,
      placedMinutesAgo: minutesAgo,
      approvedAt,
      promisedShipAt,
      shippedAt,
      deliveredAt,
      cancelledAt,
      carrier: status === "shipped" || status === "delivered" ? rPick(CARRIERS) : undefined,
      trackingNumber:
        status === "shipped" || status === "delivered"
          ? "1Z" + rInt(100000000, 999999999).toString() + rInt(100, 999).toString()
          : undefined,
      creditHold: rng() < 0.04 && status === "submitted",
      priority: rng() < 0.1 ? "rush" : "standard",
    });
  }
  return out.sort((a, b) => a.placedMinutesAgo - b.placedMinutesAgo);
}

export const DEALER_ORDERS: DealerOrder[] = generateDealerOrders(DEALERS, 520);

export function ordersForDealer(dealerId: string, limit?: number): DealerOrder[] {
  const out = DEALER_ORDERS.filter((o) => o.dealerId === dealerId);
  return typeof limit === "number" ? out.slice(0, limit) : out;
}

export function dealerOrderById(id: string): DealerOrder | undefined {
  return DEALER_ORDERS.find((o) => o.id === id);
}

export function dealerOrderStats() {
  const now = DEMO_NOW_REF;
  const last24h = DEALER_ORDERS.filter((o) => o.placedMinutesAgo < 24 * 60);
  const last7d = DEALER_ORDERS.filter((o) => o.placedMinutesAgo < 7 * 24 * 60);
  const inProduction = DEALER_ORDERS.filter((o) => o.status === "in_production");
  const readyToShip = DEALER_ORDERS.filter((o) => o.status === "ready_to_ship");
  const shipped = DEALER_ORDERS.filter((o) => o.status === "shipped");
  const awaitingApproval = DEALER_ORDERS.filter((o) => o.status === "submitted");
  const creditHolds = DEALER_ORDERS.filter((o) => o.creditHold);
  const rush = DEALER_ORDERS.filter((o) => o.priority === "rush" && o.status !== "delivered" && o.status !== "cancelled");

  const backlogValue = DEALER_ORDERS.filter(
    (o) => !["delivered", "cancelled"].includes(o.status)
  ).reduce((s, o) => s + o.total, 0);

  const unitsInPipeline = DEALER_ORDERS.filter(
    (o) => !["delivered", "cancelled", "draft"].includes(o.status)
  ).reduce((s, o) => s + o.unitCount, 0);

  return {
    totalOrders: DEALER_ORDERS.length,
    last24hCount: last24h.length,
    last24hValue: last24h.reduce((s, o) => s + o.total, 0),
    last7dCount: last7d.length,
    last7dValue: last7d.reduce((s, o) => s + o.total, 0),
    inProductionCount: inProduction.length,
    inProductionUnits: inProduction.reduce((s, o) => s + o.unitCount, 0),
    readyToShipCount: readyToShip.length,
    shippedCount: shipped.length,
    awaitingApprovalCount: awaitingApproval.length,
    creditHoldCount: creditHolds.length,
    rushOrderCount: rush.length,
    backlogValue,
    unitsInPipeline,
    shouldUnused: now, // avoid unused warning
  };
}

export function orderCountByStatus() {
  const counts: Record<DealerOrderStatus, number> = {
    draft: 0, submitted: 0, approved: 0, in_production: 0,
    ready_to_ship: 0, shipped: 0, delivered: 0, cancelled: 0,
  };
  for (const o of DEALER_ORDERS) counts[o.status]++;
  return counts;
}

export function topDealersByOrderValue(n = 10) {
  const byDealer: Record<string, { dealer: Dealer; total: number; count: number; units: number }> = {};
  for (const o of DEALER_ORDERS) {
    if (o.status === "cancelled") continue;
    const d = DEALERS.find((x) => x.id === o.dealerId);
    if (!d) continue;
    if (!byDealer[o.dealerId]) byDealer[o.dealerId] = { dealer: d, total: 0, count: 0, units: 0 };
    byDealer[o.dealerId].total += o.total;
    byDealer[o.dealerId].count++;
    byDealer[o.dealerId].units += o.unitCount;
  }
  return Object.values(byDealer).sort((a, b) => b.total - a.total).slice(0, n);
}

// ═══════════════════════════════════════════════════════════════════
// Freight & Logistics module (Module 3 of comprehensive build-out)
// Shipments, carrier performance, tracking, damage claims.
// ═══════════════════════════════════════════════════════════════════

export type ShipmentStatus =
  | "scheduled"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "delayed"
  | "exception";

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  scheduled: "Scheduled",
  picked_up: "Picked Up",
  in_transit: "In Transit",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  delayed: "Delayed",
  exception: "Exception",
};

export const SHIPMENT_STATUS_COLORS: Record<ShipmentStatus, string> = {
  scheduled: "#94A3B8",
  picked_up: "#0891B2",
  in_transit: "#0EA5E9",
  out_for_delivery: "#EAB308",
  delivered: "#059669",
  delayed: "#D97706",
  exception: "#DC2626",
};

export type ServiceLevel = "LTL" | "FTL" | "white_glove" | "drop_ship";

export interface ShipmentEvent {
  timestamp: Date;
  minutesAgo: number;
  location: string;
  status: string;
  description: string;
}

export interface DamageClaim {
  id: string;
  shipmentId: string;
  filedAt: Date;
  severity: "minor" | "moderate" | "major";
  description: string;
  status: "open" | "under_review" | "approved" | "denied" | "resolved";
  resolutionAmount?: number;
  resolvedAt?: Date;
}

export interface Shipment {
  id: string;
  shipmentNumber: string;
  orderId: string;
  orderNumber: string;
  dealerId: string;
  dealerName: string;
  dealerCity: string;
  dealerState: string;
  carrier: string;
  serviceLevel: ServiceLevel;
  trackingNumber: string;
  originCity: string;
  originState: string;
  destCity: string;
  destState: string;
  milesDistance: number;
  unitCount: number;
  weightLbs: number;
  freightCost: number;
  quotedFreight: number;
  status: ShipmentStatus;
  scheduledPickup: Date;
  actualPickup?: Date;
  estimatedDelivery: Date;
  actualDelivery?: Date;
  transitDaysActual?: number;
  transitDaysExpected: number;
  onTime?: boolean;
  events: ShipmentEvent[];
  claim?: DamageClaim;
  podSignature?: string;
  podReceivedBy?: string;
}

// Rough driving distance (mi) by state relative to Fort Wayne, IN
const STATE_DISTANCE_MI: Record<string, number> = {
  IN: 120, OH: 210, MI: 290, IL: 260, KY: 340, TN: 520, WV: 460,
  PA: 540, NY: 710, MA: 920, CT: 820, NJ: 700, NH: 960, VT: 900, ME: 1080, RI: 880,
  VA: 570, MD: 590, DE: 640, DC: 570, FL: 1080, GA: 770, SC: 770, NC: 680, AL: 730, MS: 870,
  WI: 340, MN: 580, IA: 460, MO: 500, TX: 1180, OK: 880, AR: 750, LA: 960,
  CO: 1230, UT: 1620, NM: 1440, AZ: 1790, WY: 1390, MT: 1640, ID: 1900,
  CA: 2090, OR: 2150, WA: 2160, NV: 1900, KS: 700,
  ON: 440, QC: 760, BC: 2100, AB: 1630,
  UK: 3900, DE_COUNTRY: 4300, AU: 8800, JP: 6300,
};

const FREIGHT_CARRIERS: { name: string; quality: number }[] = [
  { name: "Old Dominion", quality: 0.94 },
  { name: "Estes Express", quality: 0.91 },
  { name: "XPO Logistics", quality: 0.88 },
  { name: "Saia LTL", quality: 0.90 },
  { name: "R+L Carriers", quality: 0.87 },
  { name: "FedEx Freight", quality: 0.93 },
  { name: "YRC Freight", quality: 0.84 },
  { name: "ABF Freight", quality: 0.89 },
];

function distanceMi(state: string): number {
  return STATE_DISTANCE_MI[state] ?? 800;
}

function buildShipmentEvents(
  status: ShipmentStatus,
  scheduledPickup: Date,
  actualPickup: Date | undefined,
  estimatedDelivery: Date,
  actualDelivery: Date | undefined,
  originCity: string,
  originState: string,
  destCity: string,
  destState: string,
  carrier: string,
  now: number
): ShipmentEvent[] {
  const events: ShipmentEvent[] = [];
  const addEvent = (date: Date, location: string, s: string, description: string) => {
    events.push({
      timestamp: date,
      minutesAgo: Math.max(0, Math.floor((now - date.getTime()) / 60000)),
      location,
      status: s,
      description,
    });
  };

  addEvent(scheduledPickup, `${originCity}, ${originState}`, "Scheduled", `Pickup scheduled with ${carrier}`);

  if (status === "scheduled") return events;

  if (actualPickup) {
    addEvent(actualPickup, `${originCity}, ${originState}`, "Picked Up", "Picked up from Master Spas warehouse");
  }

  // Intermediate stops along the way
  if (status !== "picked_up" && actualPickup) {
    const transitHours = estimatedDelivery.getTime() - actualPickup.getTime();
    const stops = [
      { fraction: 0.3, city: "Indianapolis", state: "IN" },
      { fraction: 0.55, city: "Dallas", state: "TX" },
      { fraction: 0.8, city: `Near ${destCity}`, state: destState },
    ];
    for (const stop of stops) {
      const t = new Date(actualPickup.getTime() + transitHours * stop.fraction);
      if (t.getTime() > now) break;
      addEvent(t, `${stop.city}, ${stop.state}`, "In Transit", `Departed ${carrier} terminal`);
    }
  }

  if (status === "out_for_delivery") {
    const t = new Date(now - 2 * 60 * 60 * 1000);
    addEvent(t, `${destCity}, ${destState}`, "Out for Delivery", "On delivery truck");
  }

  if (status === "delayed") {
    const t = new Date(now - rInt(60, 720) * 60 * 1000);
    addEvent(t, `${destCity}, ${destState}`, "Delayed", "Weather delay — new ETA pending");
  }

  if (status === "exception") {
    const t = new Date(now - rInt(60, 720) * 60 * 1000);
    addEvent(t, `In transit`, "Exception", "Missed delivery window — carrier reassigning driver");
  }

  if (status === "delivered" && actualDelivery) {
    addEvent(
      actualDelivery,
      `${destCity}, ${destState}`,
      "Delivered",
      "Delivered — signature on file"
    );
  }

  return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

function generateShipments(orders: DealerOrder[]): Shipment[] {
  const now = DEMO_NOW_REF;
  const out: Shipment[] = [];
  let shipmentCounter = 1;

  for (const o of orders) {
    if (!["approved", "in_production", "ready_to_ship", "shipped", "delivered"].includes(o.status)) continue;

    const dealer = DEALERS.find((d) => d.id === o.dealerId);
    if (!dealer) continue;

    const carrier = rPickWeighted(
      FREIGHT_CARRIERS.map((c) => ({ value: c, weight: Math.round(c.quality * 100) }))
    );
    const serviceLevel: ServiceLevel = rPickWeighted<ServiceLevel>([
      { value: "LTL", weight: 60 },
      { value: "FTL", weight: 20 },
      { value: "white_glove", weight: 15 },
      { value: "drop_ship", weight: 5 },
    ]);

    // Shipment status derived from order status
    let status: ShipmentStatus;
    if (o.status === "approved" || o.status === "in_production") status = "scheduled";
    else if (o.status === "ready_to_ship") {
      status = rPickWeighted<ShipmentStatus>([
        { value: "scheduled", weight: 50 },
        { value: "picked_up", weight: 50 },
      ]);
    } else if (o.status === "shipped") {
      const r = rng();
      if (r < 0.04) status = "delayed";
      else if (r < 0.07) status = "exception";
      else if (r < 0.2) status = "out_for_delivery";
      else status = "in_transit";
    } else {
      // delivered
      status = "delivered";
    }

    const miles = distanceMi(dealer.state);
    const weightPerUnit = 750; // avg hot tub weight lbs
    const weightLbs = o.unitCount * weightPerUnit;
    // Freight rate: LTL ~$0.70/mi base + $2/lb adder; FTL flat rate
    const quotedFreight =
      serviceLevel === "LTL"
        ? Math.round(250 + miles * 0.55 + weightLbs * 0.12)
        : serviceLevel === "FTL"
        ? Math.round(800 + miles * 1.1)
        : serviceLevel === "white_glove"
        ? Math.round(500 + miles * 1.2 + weightLbs * 0.2)
        : Math.round(200 + miles * 0.4);
    const freightCost = Math.round(quotedFreight * (0.95 + rng() * 0.15)); // actual varies 95-110%

    const transitDaysExpected = Math.max(2, Math.round(miles / 350) + (serviceLevel === "LTL" ? 2 : 1));
    const scheduledPickup = o.approvedAt
      ? new Date(o.approvedAt.getTime() + rInt(7, 18) * 24 * 60 * 60 * 1000)
      : new Date(o.placedAt.getTime() + rInt(10, 25) * 24 * 60 * 60 * 1000);

    const actualPickup =
      status !== "scheduled" ? o.shippedAt ?? new Date(scheduledPickup.getTime() + rInt(-30, 120) * 60 * 1000) : undefined;

    const estimatedDelivery = actualPickup
      ? new Date(actualPickup.getTime() + transitDaysExpected * 24 * 60 * 60 * 1000)
      : new Date(scheduledPickup.getTime() + transitDaysExpected * 24 * 60 * 60 * 1000);

    const actualDelivery = status === "delivered" ? o.deliveredAt : undefined;

    const transitDaysActual =
      actualDelivery && actualPickup
        ? Math.round((actualDelivery.getTime() - actualPickup.getTime()) / (24 * 60 * 60 * 1000))
        : undefined;

    const onTime =
      transitDaysActual !== undefined ? transitDaysActual <= transitDaysExpected : undefined;

    const events = buildShipmentEvents(
      status,
      scheduledPickup,
      actualPickup,
      estimatedDelivery,
      actualDelivery,
      "Fort Wayne",
      "IN",
      dealer.city,
      dealer.state,
      carrier.name,
      now
    );

    // ~3% of delivered shipments have a damage claim
    let claim: DamageClaim | undefined;
    if (status === "delivered" && rng() < 0.03) {
      const severity = rPickWeighted<DamageClaim["severity"]>([
        { value: "minor", weight: 60 },
        { value: "moderate", weight: 30 },
        { value: "major", weight: 10 },
      ]);
      const filedAt = new Date((actualDelivery ?? new Date(now)).getTime() + rInt(60, 7200) * 60 * 1000);
      const resolved = rng() < 0.55;
      claim = {
        id: `claim-${shipmentCounter}`,
        shipmentId: `ship-${shipmentCounter}`,
        filedAt,
        severity,
        description:
          severity === "major"
            ? "Shell cracked during offload — unit unusable"
            : severity === "moderate"
            ? "Cabinet corner damaged, delivery accepted with note"
            : "Minor scuff on cabinet, delivery accepted",
        status: resolved
          ? (rng() < 0.8 ? "resolved" : "denied")
          : rPickWeighted<DamageClaim["status"]>([
              { value: "open", weight: 50 },
              { value: "under_review", weight: 35 },
              { value: "approved", weight: 15 },
            ]),
        resolutionAmount: resolved
          ? severity === "major"
            ? rInt(4000, 12000)
            : severity === "moderate"
            ? rInt(500, 2500)
            : rInt(100, 500)
          : undefined,
        resolvedAt: resolved ? new Date(filedAt.getTime() + rInt(3, 21) * 24 * 60 * 60 * 1000) : undefined,
      };
    }

    const shipmentNumber =
      "SH-" +
      new Date(scheduledPickup).getFullYear().toString().slice(-2) +
      String(scheduledPickup.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(10000 + shipmentCounter).padStart(5, "0");

    out.push({
      id: `ship-${shipmentCounter}`,
      shipmentNumber,
      orderId: o.id,
      orderNumber: o.orderNumber,
      dealerId: o.dealerId,
      dealerName: o.dealerName,
      dealerCity: o.dealerCity,
      dealerState: o.dealerState,
      carrier: carrier.name,
      serviceLevel,
      trackingNumber: o.trackingNumber ?? `1Z${rInt(100000000, 999999999)}${rInt(100, 999)}`,
      originCity: "Fort Wayne",
      originState: "IN",
      destCity: dealer.city,
      destState: dealer.state,
      milesDistance: miles,
      unitCount: o.unitCount,
      weightLbs,
      freightCost,
      quotedFreight,
      status,
      scheduledPickup,
      actualPickup,
      estimatedDelivery,
      actualDelivery,
      transitDaysActual,
      transitDaysExpected,
      onTime,
      events,
      claim,
      podSignature: status === "delivered" ? ["John Smith", "Mary Johnson", "Robert Brown", "Lisa Davis"][shipmentCounter % 4] : undefined,
      podReceivedBy: status === "delivered" ? "Store Manager" : undefined,
    });
    shipmentCounter++;
  }
  return out;
}

export const SHIPMENTS: Shipment[] = generateShipments(DEALER_ORDERS);

export function shipmentById(id: string): Shipment | undefined {
  return SHIPMENTS.find((s) => s.id === id);
}

export function shipmentStats() {
  const now = DEMO_NOW_REF;
  const active = SHIPMENTS.filter((s) =>
    ["scheduled", "picked_up", "in_transit", "out_for_delivery", "delayed", "exception"].includes(s.status)
  );
  const inTransit = SHIPMENTS.filter((s) =>
    ["picked_up", "in_transit", "out_for_delivery"].includes(s.status)
  );
  const deliveredThisMonth = SHIPMENTS.filter(
    (s) => s.actualDelivery && s.actualDelivery.getTime() > now - 30 * 24 * 60 * 60 * 1000
  );
  const deliveredToday = SHIPMENTS.filter(
    (s) => s.actualDelivery && s.actualDelivery.getTime() > now - 24 * 60 * 60 * 1000
  );
  const onTimeDeliveries = deliveredThisMonth.filter((s) => s.onTime === true);
  const delayed = SHIPMENTS.filter((s) => ["delayed", "exception"].includes(s.status));
  const openClaims = SHIPMENTS.filter((s) => s.claim && ["open", "under_review"].includes(s.claim.status));
  const resolvedClaimsMonth = SHIPMENTS.filter(
    (s) => s.claim?.status === "resolved" && s.claim.resolvedAt && s.claim.resolvedAt.getTime() > now - 30 * 24 * 60 * 60 * 1000
  );

  const totalFreightSpend = SHIPMENTS.reduce((sum, s) => sum + s.freightCost, 0);
  const avgFreightPerShipment = SHIPMENTS.length > 0 ? totalFreightSpend / SHIPMENTS.length : 0;
  const totalUnitsInTransit = inTransit.reduce((sum, s) => sum + s.unitCount, 0);
  const avgTransitDays =
    deliveredThisMonth.length > 0
      ? deliveredThisMonth.reduce((sum, s) => sum + (s.transitDaysActual ?? 0), 0) /
        deliveredThisMonth.length
      : 0;

  return {
    total: SHIPMENTS.length,
    active: active.length,
    inTransit: inTransit.length,
    deliveredThisMonth: deliveredThisMonth.length,
    deliveredToday: deliveredToday.length,
    onTimePct: deliveredThisMonth.length > 0 ? (onTimeDeliveries.length / deliveredThisMonth.length) * 100 : 0,
    delayedCount: delayed.length,
    openClaimsCount: openClaims.length,
    resolvedClaimsCount: resolvedClaimsMonth.length,
    totalFreightSpend,
    avgFreightPerShipment,
    totalUnitsInTransit,
    avgTransitDays: +avgTransitDays.toFixed(1),
    totalClaimsCost: SHIPMENTS.filter((s) => s.claim?.resolutionAmount).reduce(
      (sum, s) => sum + (s.claim?.resolutionAmount ?? 0),
      0
    ),
  };
}

export function carrierPerformance() {
  const byCarrier: Record<
    string,
    { shipments: number; onTime: number; delivered: number; avgTransit: number; totalSpend: number; claims: number }
  > = {};
  for (const s of SHIPMENTS) {
    if (!byCarrier[s.carrier])
      byCarrier[s.carrier] = { shipments: 0, onTime: 0, delivered: 0, avgTransit: 0, totalSpend: 0, claims: 0 };
    byCarrier[s.carrier].shipments++;
    byCarrier[s.carrier].totalSpend += s.freightCost;
    if (s.claim) byCarrier[s.carrier].claims++;
    if (s.actualDelivery) {
      byCarrier[s.carrier].delivered++;
      if (s.onTime) byCarrier[s.carrier].onTime++;
      if (s.transitDaysActual) byCarrier[s.carrier].avgTransit += s.transitDaysActual;
    }
  }
  return Object.entries(byCarrier)
    .map(([carrier, v]) => ({
      carrier,
      shipments: v.shipments,
      onTimePct: v.delivered > 0 ? (v.onTime / v.delivered) * 100 : 0,
      avgTransit: v.delivered > 0 ? +(v.avgTransit / v.delivered).toFixed(1) : 0,
      totalSpend: v.totalSpend,
      claimsRate: v.shipments > 0 ? +((v.claims / v.shipments) * 100).toFixed(2) : 0,
      claims: v.claims,
    }))
    .sort((a, b) => b.shipments - a.shipments);
}

export function openClaims() {
  return SHIPMENTS.filter((s) => s.claim && ["open", "under_review", "approved"].includes(s.claim.status))
    .map((s) => ({ shipment: s, claim: s.claim! }))
    .sort((a, b) => b.claim.filedAt.getTime() - a.claim.filedAt.getTime());
}

// ═══════════════════════════════════════════════════════════════════
// Warranty & Service Network (Module 4 of comprehensive build-out)
// Claims filed by dealers, parts shipped, service calls dispatched.
// ═══════════════════════════════════════════════════════════════════

export type WarrantyClaimStatus =
  | "submitted"
  | "under_review"
  | "approved"
  | "parts_shipped"
  | "scheduled"
  | "in_service"
  | "resolved"
  | "denied";

export const WARRANTY_STATUS_LABELS: Record<WarrantyClaimStatus, string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  parts_shipped: "Parts Shipped",
  scheduled: "Service Scheduled",
  in_service: "In Service",
  resolved: "Resolved",
  denied: "Denied",
};

export const WARRANTY_STATUS_COLORS: Record<WarrantyClaimStatus, string> = {
  submitted: "#0891B2",
  under_review: "#D97706",
  approved: "#7C3AED",
  parts_shipped: "#0EA5E9",
  scheduled: "#EAB308",
  in_service: "#F59E0B",
  resolved: "#059669",
  denied: "#DC2626",
};

export type DefectCategory =
  | "pump"
  | "jets"
  | "shell"
  | "electrical"
  | "heater"
  | "controls"
  | "cover"
  | "filter"
  | "lighting"
  | "other";

export const DEFECT_CATEGORY_LABELS: Record<DefectCategory, string> = {
  pump: "Pump",
  jets: "Jets",
  shell: "Shell",
  electrical: "Electrical",
  heater: "Heater",
  controls: "Controls / Topside",
  cover: "Cover",
  filter: "Filter",
  lighting: "Lighting",
  other: "Other",
};

export type ResolutionType = "parts_only" | "service_call" | "unit_replacement" | "denied" | "pending";

export type ClaimSeverity = "minor" | "moderate" | "major";

export interface WarrantyPart {
  name: string;
  partNumber: string;
  qty: number;
  unitCost: number;
}

export interface WarrantyEvent {
  timestamp: Date;
  minutesAgo: number;
  status: string;
  description: string;
  actor: string;
}

export interface WarrantyClaim {
  id: string;
  claimNumber: string;
  serialNumber: string;
  contractId?: string; // original sale contract
  dealerId: string;
  dealerName: string;
  dealerCity: string;
  dealerState: string;
  customerName: string;
  modelLine: ModelLine;
  model: string;
  productionDate: Date;
  deliveredDate: Date;
  warrantyAgeMonths: number;
  filedAt: Date;
  filedMinutesAgo: number;
  category: DefectCategory;
  severity: ClaimSeverity;
  description: string;
  status: WarrantyClaimStatus;
  resolutionType: ResolutionType;
  parts: WarrantyPart[];
  techAssigned?: string;
  scheduledServiceDate?: Date;
  resolvedAt?: Date;
  resolutionDays?: number;
  customerSatisfaction?: number; // 1-5
  totalCost: number;
  events: WarrantyEvent[];
  notes?: string;
}

const DEFECT_DESCRIPTIONS: Record<DefectCategory, string[]> = {
  pump: [
    "Circulation pump not priming, customer reports gurgling",
    "Pump humming but not moving water",
    "Pump leaking at seal",
    "Pump motor burned out — no power to unit",
  ],
  jets: [
    "3 jets not producing pressure",
    "Jet insert cracked, water spraying over shell",
    "Diverter valve stuck",
    "Air venturi clogged, weak jet performance",
  ],
  shell: [
    "Hairline crack on shell corner",
    "Pinhole leak in footwell",
    "Blistering on seat — suspected UV issue",
    "Shell discoloration after first fill",
  ],
  electrical: [
    "GFCI trips when heater engages",
    "No power to unit after storm",
    "Control pack burn marks visible",
    "Breaker trips intermittently",
  ],
  heater: [
    "Heater not turning on, LCD shows flow error",
    "Heater element corroded, pressure drop",
    "Water not reaching set temperature",
    "Heater thermostat stuck",
  ],
  controls: [
    "Topside display blank",
    "Touch panel unresponsive",
    "SNAPP app not connecting to unit",
    "Unit flashing error code FL1",
  ],
  cover: [
    "Cover seam torn along hinge",
    "Waterlogged foam core",
    "Cover lock straps broken",
    "Cover skin peeling after 8 months",
  ],
  filter: [
    "Filter bracket cracked",
    "Filter won't stay seated in canister",
    "Standpipe o-ring failure",
  ],
  lighting: [
    "LED strip out on jet ring 1",
    "Underwater light flickering",
    "Waterfall LED not turning on",
  ],
  other: [
    "Ozonator not working, customer smells sulfur",
    "Water care system not dispensing",
    "Audio system no sound, Bluetooth not pairing",
  ],
};

const PARTS_CATALOG: Record<DefectCategory, { name: string; partNumber: string; cost: number }[]> = {
  pump: [
    { name: "2.5HP Circulation Pump", partNumber: "MS-PMP-250", cost: 485 },
    { name: "Pump Wet End Seal Kit", partNumber: "MS-PMP-SEAL", cost: 78 },
    { name: "Pump Motor Assembly", partNumber: "MS-PMP-MTR", cost: 320 },
  ],
  jets: [
    { name: "Directional Jet Insert", partNumber: "MS-JET-DIR", cost: 32 },
    { name: "Rotating Jet Assembly", partNumber: "MS-JET-ROT", cost: 58 },
    { name: "Diverter Valve Kit", partNumber: "MS-JET-DIV", cost: 110 },
  ],
  shell: [
    { name: "Shell Patch Repair Kit", partNumber: "MS-SHL-RPR", cost: 180 },
    { name: "Replacement Shell", partNumber: "MS-SHL-FULL", cost: 3200 },
  ],
  electrical: [
    { name: "50A GFCI Breaker", partNumber: "MS-ELE-GFCI", cost: 145 },
    { name: "Control Box Assembly", partNumber: "MS-ELE-CTRL", cost: 780 },
    { name: "50A Wire Harness", partNumber: "MS-ELE-HARN", cost: 210 },
  ],
  heater: [
    { name: "5.5kW Heater Element", partNumber: "MS-HTR-55", cost: 245 },
    { name: "Heater Sensor", partNumber: "MS-HTR-SNS", cost: 68 },
    { name: "Flow Switch", partNumber: "MS-HTR-FLOW", cost: 95 },
  ],
  controls: [
    { name: "Topside Control Panel", partNumber: "MS-CTL-TOP", cost: 395 },
    { name: "Main Control Board", partNumber: "MS-CTL-MAIN", cost: 520 },
    { name: "WiFi Gateway Module", partNumber: "MS-CTL-WIFI", cost: 185 },
  ],
  cover: [
    { name: "Replacement Cover (6x7)", partNumber: "MS-CVR-67", cost: 620 },
    { name: "Cover Lock Strap Set", partNumber: "MS-CVR-LOCK", cost: 85 },
    { name: "Cover Lifter", partNumber: "MS-CVR-LFT", cost: 310 },
  ],
  filter: [
    { name: "Filter Canister", partNumber: "MS-FLT-CAN", cost: 175 },
    { name: "Standpipe O-Ring Kit", partNumber: "MS-FLT-ORING", cost: 22 },
  ],
  lighting: [
    { name: "LED Light Assembly", partNumber: "MS-LIT-LED", cost: 95 },
    { name: "LED Controller", partNumber: "MS-LIT-CTL", cost: 145 },
  ],
  other: [
    { name: "Ozonator Module", partNumber: "MS-OZN-STD", cost: 220 },
    { name: "Audio System Replacement", partNumber: "MS-AUD-BT", cost: 380 },
  ],
};

const TECH_NAMES = [
  "Mike Anderson", "Sarah Johnson", "Tom Rodriguez", "Jessica Martinez",
  "David Chen", "Amanda Wright", "Robert Kim", "Lisa Patel",
];

function generateWarrantyClaims(orders: DealerOrder[]): WarrantyClaim[] {
  const now = DEMO_NOW_REF;
  const claims: WarrantyClaim[] = [];
  let claimCounter = 1;

  // Only delivered orders can have warranty claims
  const delivered = orders.filter((o) => o.status === "delivered" && o.deliveredAt);

  for (const order of delivered) {
    // ~7% of delivered units generate a warranty claim (realistic for year 1-2)
    for (const line of order.lines) {
      for (let unitIdx = 0; unitIdx < line.qty; unitIdx++) {
        if (rng() > 0.07) continue; // skip if no claim

        const deliveredDate = order.deliveredAt!;
        const warrantyAgeMinutes = Math.max(60, Math.floor(rng() * (now - deliveredDate.getTime()) / 60000));
        const filedAt = new Date(deliveredDate.getTime() + warrantyAgeMinutes * 60 * 1000);
        if (filedAt.getTime() > now) continue;
        const filedMinutesAgo = Math.max(0, Math.floor((now - filedAt.getTime()) / 60000));
        const warrantyAgeMonths = Math.max(
          0,
          (filedAt.getTime() - deliveredDate.getTime()) / (30 * 24 * 60 * 60 * 1000)
        );

        const category = rPickWeighted<DefectCategory>([
          { value: "pump", weight: 18 },
          { value: "jets", weight: 14 },
          { value: "electrical", weight: 16 },
          { value: "heater", weight: 13 },
          { value: "controls", weight: 12 },
          { value: "cover", weight: 9 },
          { value: "shell", weight: 5 },
          { value: "filter", weight: 6 },
          { value: "lighting", weight: 4 },
          { value: "other", weight: 3 },
        ]);

        const severity = rPickWeighted<ClaimSeverity>([
          { value: "minor", weight: 55 },
          { value: "moderate", weight: 35 },
          { value: "major", weight: 10 },
        ]);

        const description = rPick(DEFECT_DESCRIPTIONS[category]);

        // Age-based status distribution
        const daysSinceFiled = filedMinutesAgo / 60 / 24;
        let status: WarrantyClaimStatus;
        if (daysSinceFiled > 45) {
          status = rPickWeighted<WarrantyClaimStatus>([
            { value: "resolved", weight: 85 },
            { value: "denied", weight: 10 },
            { value: "in_service", weight: 5 },
          ]);
        } else if (daysSinceFiled > 14) {
          status = rPickWeighted<WarrantyClaimStatus>([
            { value: "resolved", weight: 50 },
            { value: "in_service", weight: 20 },
            { value: "scheduled", weight: 15 },
            { value: "parts_shipped", weight: 10 },
            { value: "denied", weight: 5 },
          ]);
        } else if (daysSinceFiled > 5) {
          status = rPickWeighted<WarrantyClaimStatus>([
            { value: "parts_shipped", weight: 30 },
            { value: "scheduled", weight: 25 },
            { value: "approved", weight: 25 },
            { value: "in_service", weight: 10 },
            { value: "under_review", weight: 10 },
          ]);
        } else if (daysSinceFiled > 1) {
          status = rPickWeighted<WarrantyClaimStatus>([
            { value: "under_review", weight: 35 },
            { value: "approved", weight: 30 },
            { value: "submitted", weight: 25 },
            { value: "denied", weight: 10 },
          ]);
        } else {
          status = rPickWeighted<WarrantyClaimStatus>([
            { value: "submitted", weight: 65 },
            { value: "under_review", weight: 35 },
          ]);
        }

        // Determine resolution type
        let resolutionType: ResolutionType;
        if (status === "denied") resolutionType = "denied";
        else if (severity === "major" && category === "shell" && rng() < 0.6) resolutionType = "unit_replacement";
        else if (severity === "minor" && rng() < 0.7) resolutionType = "parts_only";
        else if (["resolved", "in_service", "scheduled", "parts_shipped"].includes(status)) {
          resolutionType = rPickWeighted<ResolutionType>([
            { value: "service_call", weight: 60 },
            { value: "parts_only", weight: 35 },
            { value: "unit_replacement", weight: 5 },
          ]);
        } else resolutionType = "pending";

        // Generate parts list
        const partsAvailable = PARTS_CATALOG[category];
        const numParts = severity === "major" ? rInt(2, 3) : rInt(1, 2);
        const parts: WarrantyPart[] = [];
        for (let p = 0; p < numParts; p++) {
          const part = partsAvailable[Math.min(p, partsAvailable.length - 1)];
          parts.push({
            name: part.name,
            partNumber: part.partNumber,
            qty: 1,
            unitCost: part.cost,
          });
        }
        if (resolutionType === "unit_replacement") {
          parts.length = 0;
          parts.push({
            name: `Replacement Unit — ${line.model}`,
            partNumber: `MS-UNIT-RPL`,
            qty: 1,
            unitCost: line.unitMsrp * 0.6, // COGS estimate
          });
        }

        const partsCost = parts.reduce((s, p) => s + p.unitCost * p.qty, 0);
        const laborCost =
          resolutionType === "service_call" || resolutionType === "unit_replacement"
            ? severity === "major"
              ? rInt(800, 1500)
              : severity === "moderate"
              ? rInt(300, 700)
              : rInt(150, 300)
            : 0;
        const freightCost = resolutionType !== "denied" && resolutionType !== "pending" ? rInt(60, 280) : 0;
        const totalCost = status === "denied" ? 0 : partsCost + laborCost + freightCost;

        const techAssigned =
          ["scheduled", "in_service", "resolved"].includes(status) && resolutionType !== "denied"
            ? rPick(TECH_NAMES)
            : undefined;

        const scheduledServiceDate =
          ["scheduled", "in_service", "resolved"].includes(status) && resolutionType !== "denied"
            ? new Date(filedAt.getTime() + rInt(3, 10) * 24 * 60 * 60 * 1000)
            : undefined;

        const resolvedAt =
          status === "resolved"
            ? new Date(
                Math.min(
                  now - rInt(60, 4320) * 60 * 1000,
                  filedAt.getTime() + rInt(2, 21) * 24 * 60 * 60 * 1000
                )
              )
            : status === "denied"
            ? new Date(filedAt.getTime() + rInt(1, 5) * 24 * 60 * 60 * 1000)
            : undefined;

        const resolutionDays =
          resolvedAt ? Math.round((resolvedAt.getTime() - filedAt.getTime()) / (24 * 60 * 60 * 1000)) : undefined;

        const customerSatisfaction =
          status === "resolved" && resolutionType !== "denied"
            ? rPickWeighted<number>([
                { value: 5, weight: 40 },
                { value: 4, weight: 30 },
                { value: 3, weight: 15 },
                { value: 2, weight: 10 },
                { value: 1, weight: 5 },
              ])
            : undefined;

        const productionDate = new Date(
          deliveredDate.getTime() - rInt(14, 60) * 24 * 60 * 60 * 1000
        );

        // Serial number
        const serialNumber =
          "MS" +
          productionDate.getFullYear().toString().slice(-2) +
          (line.modelLine === "Michael Phelps Legend"
            ? "L"
            : line.modelLine === "Twilight"
            ? "T"
            : line.modelLine === "Clarity"
            ? "C"
            : line.modelLine === "H2X Fitness"
            ? "H"
            : "S") +
          String(100000 + claimCounter * 37).slice(-6);

        // Events timeline
        const events: WarrantyEvent[] = [];
        const addEvent = (timestamp: Date, s: string, description: string, actor: string) => {
          if (timestamp.getTime() > now) return;
          events.push({
            timestamp,
            minutesAgo: Math.max(0, Math.floor((now - timestamp.getTime()) / 60000)),
            status: s,
            description,
            actor,
          });
        };

        addEvent(filedAt, "Filed", `Claim submitted by ${order.dealerName}`, "Dealer");

        if (status !== "submitted") {
          const reviewedAt = new Date(filedAt.getTime() + rInt(60, 720) * 60 * 1000);
          addEvent(reviewedAt, "Under Review", "Warranty team reviewing documentation", "Warranty Team");
        }

        if (!["submitted", "under_review", "denied"].includes(status)) {
          const approvedAt = new Date(filedAt.getTime() + rInt(720, 2880) * 60 * 1000);
          addEvent(
            approvedAt,
            "Approved",
            resolutionType === "unit_replacement"
              ? "Approved for unit replacement"
              : resolutionType === "service_call"
              ? "Approved for service call"
              : "Approved — parts shipping to dealer",
            "Warranty Team"
          );
        }

        if (["parts_shipped", "scheduled", "in_service", "resolved"].includes(status)) {
          const partsShippedAt = new Date(filedAt.getTime() + rInt(1, 4) * 24 * 60 * 60 * 1000);
          addEvent(partsShippedAt, "Parts Shipped", `${parts.length} part${parts.length !== 1 ? "s" : ""} dispatched to dealer`, "Warehouse");
        }

        if (["scheduled", "in_service", "resolved"].includes(status) && techAssigned && scheduledServiceDate) {
          const scheduledAt = new Date(filedAt.getTime() + rInt(1, 5) * 24 * 60 * 60 * 1000);
          addEvent(
            scheduledAt,
            "Scheduled",
            `Service call scheduled for ${scheduledServiceDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — ${techAssigned}`,
            "Service Dispatch"
          );
        }

        if (status === "in_service") {
          const inServiceAt = new Date(now - rInt(60, 240) * 60 * 1000);
          addEvent(inServiceAt, "In Service", "Tech on-site, diagnosing", techAssigned ?? "Tech");
        }

        if (resolvedAt) {
          addEvent(
            resolvedAt,
            status === "denied" ? "Denied" : "Resolved",
            status === "denied"
              ? "Claim denied — outside warranty terms"
              : customerSatisfaction
              ? `Closed out, customer rating ${customerSatisfaction}/5`
              : "Closed out",
            status === "denied" ? "Warranty Team" : techAssigned ?? "Warranty Team"
          );
        }

        const claimNumber =
          "WC-" +
          filedAt.getFullYear().toString().slice(-2) +
          String(filedAt.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(10000 + claimCounter).padStart(5, "0");

        claims.push({
          id: `wc-${claimCounter}`,
          claimNumber,
          serialNumber,
          contractId: order.id,
          dealerId: order.dealerId,
          dealerName: order.dealerName,
          dealerCity: order.dealerCity,
          dealerState: order.dealerState,
          customerName: `${rPick(["James", "Mary", "Robert", "Patricia", "Michael", "Linda", "David", "Jennifer"])} ${rPick(["Smith", "Johnson", "Brown", "Davis", "Miller", "Wilson", "Taylor", "Anderson"])}`,
          modelLine: line.modelLine,
          model: line.model,
          productionDate,
          deliveredDate,
          warrantyAgeMonths: +warrantyAgeMonths.toFixed(1),
          filedAt,
          filedMinutesAgo,
          category,
          severity,
          description,
          status,
          resolutionType,
          parts,
          techAssigned,
          scheduledServiceDate,
          resolvedAt,
          resolutionDays,
          customerSatisfaction,
          totalCost,
          events: events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
        });
        claimCounter++;
      }
    }
  }
  return claims.sort((a, b) => a.filedMinutesAgo - b.filedMinutesAgo);
}

export const WARRANTY_CLAIMS: WarrantyClaim[] = generateWarrantyClaims(DEALER_ORDERS);

export function warrantyClaimById(id: string): WarrantyClaim | undefined {
  return WARRANTY_CLAIMS.find((c) => c.id === id);
}

export function warrantyStats() {
  const now = DEMO_NOW_REF;
  const open = WARRANTY_CLAIMS.filter(
    (c) => !["resolved", "denied"].includes(c.status)
  );
  const thisMonth = WARRANTY_CLAIMS.filter(
    (c) => c.filedAt.getTime() > now - 30 * 24 * 60 * 60 * 1000
  );
  const resolvedThisMonth = WARRANTY_CLAIMS.filter(
    (c) => c.resolvedAt && c.resolvedAt.getTime() > now - 30 * 24 * 60 * 60 * 1000
  );
  const avgResolutionDays =
    resolvedThisMonth.length > 0
      ? resolvedThisMonth.reduce((s, c) => s + (c.resolutionDays ?? 0), 0) / resolvedThisMonth.length
      : 0;

  const ytdCost = WARRANTY_CLAIMS.reduce((s, c) => s + c.totalCost, 0);
  const costThisMonth = thisMonth.reduce((s, c) => s + c.totalCost, 0);

  // Units delivered in last year (approximation for claim rate denominator)
  const deliveredUnits = DEALER_ORDERS.filter(
    (o) => o.status === "delivered"
  ).reduce((s, o) => s + o.unitCount, 0);

  const claimRate = deliveredUnits > 0 ? (WARRANTY_CLAIMS.length / deliveredUnits) * 100 : 0;

  const satisfactionScores = WARRANTY_CLAIMS.filter((c) => c.customerSatisfaction).map(
    (c) => c.customerSatisfaction!
  );
  const avgCsat =
    satisfactionScores.length > 0
      ? satisfactionScores.reduce((s, v) => s + v, 0) / satisfactionScores.length
      : 0;

  const major = WARRANTY_CLAIMS.filter((c) => c.severity === "major" && !["resolved", "denied"].includes(c.status));

  return {
    total: WARRANTY_CLAIMS.length,
    openCount: open.length,
    thisMonthCount: thisMonth.length,
    resolvedThisMonthCount: resolvedThisMonth.length,
    avgResolutionDays: +avgResolutionDays.toFixed(1),
    ytdCost,
    costThisMonth,
    deliveredUnits,
    claimRate: +claimRate.toFixed(2),
    avgCsat: +avgCsat.toFixed(2),
    majorOpenCount: major.length,
    awaitingReview: WARRANTY_CLAIMS.filter((c) =>
      ["submitted", "under_review"].includes(c.status)
    ).length,
  };
}

export function defectRateByModel() {
  const byModel: Record<ModelLine, { claims: number; units: number; rate: number; cost: number }> = {
    "Michael Phelps Legend": { claims: 0, units: 0, rate: 0, cost: 0 },
    Twilight: { claims: 0, units: 0, rate: 0, cost: 0 },
    Clarity: { claims: 0, units: 0, rate: 0, cost: 0 },
    "H2X Fitness": { claims: 0, units: 0, rate: 0, cost: 0 },
    "MP Signature Swim Spa": { claims: 0, units: 0, rate: 0, cost: 0 },
  };
  // Claims per model line
  for (const c of WARRANTY_CLAIMS) {
    byModel[c.modelLine].claims++;
    byModel[c.modelLine].cost += c.totalCost;
  }
  // Delivered units per model line (denominator for rate)
  for (const o of DEALER_ORDERS) {
    if (o.status !== "delivered") continue;
    for (const l of o.lines) {
      byModel[l.modelLine].units += l.qty;
    }
  }
  for (const m of Object.keys(byModel) as ModelLine[]) {
    byModel[m].rate = byModel[m].units > 0 ? +(byModel[m].claims / byModel[m].units * 100).toFixed(2) : 0;
  }
  return byModel;
}

export function defectCategoryBreakdown() {
  const counts: Record<DefectCategory, { count: number; cost: number; avgCost: number }> = {
    pump: { count: 0, cost: 0, avgCost: 0 },
    jets: { count: 0, cost: 0, avgCost: 0 },
    shell: { count: 0, cost: 0, avgCost: 0 },
    electrical: { count: 0, cost: 0, avgCost: 0 },
    heater: { count: 0, cost: 0, avgCost: 0 },
    controls: { count: 0, cost: 0, avgCost: 0 },
    cover: { count: 0, cost: 0, avgCost: 0 },
    filter: { count: 0, cost: 0, avgCost: 0 },
    lighting: { count: 0, cost: 0, avgCost: 0 },
    other: { count: 0, cost: 0, avgCost: 0 },
  };
  for (const c of WARRANTY_CLAIMS) {
    counts[c.category].count++;
    counts[c.category].cost += c.totalCost;
  }
  for (const k of Object.keys(counts) as DefectCategory[]) {
    counts[k].avgCost = counts[k].count > 0 ? Math.round(counts[k].cost / counts[k].count) : 0;
  }
  return counts;
}

export function warrantyMonthlyTrend() {
  const months: { month: string; claims: number; cost: number }[] = [];
  const now = DEMO_NOW_REF;
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now);
    start.setMonth(start.getMonth() - i);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    const monthClaims = WARRANTY_CLAIMS.filter(
      (c) => c.filedAt >= start && c.filedAt < end
    );
    months.push({
      month: start.toLocaleDateString("en-US", { month: "short" }),
      claims: monthClaims.length,
      cost: monthClaims.reduce((s, c) => s + c.totalCost, 0),
    });
  }
  return months;
}

export function activeServiceCalls() {
  return WARRANTY_CLAIMS.filter(
    (c) => (c.status === "scheduled" || c.status === "in_service") && c.techAssigned
  ).sort((a, b) => (a.scheduledServiceDate?.getTime() ?? 0) - (b.scheduledServiceDate?.getTime() ?? 0));
}

// ═══════════════════════════════════════════════════════════════════
// Factory OS (Module 1 of comprehensive build-out)
// Production floor tracking: work orders, stations, QC, throughput.
// ═══════════════════════════════════════════════════════════════════

export type ProductionStation =
  | "framing"
  | "plumbing"
  | "electrical"
  | "shell_prep"
  | "final_assembly"
  | "test"
  | "pack"
  | "staging";

export const STATION_LABELS: Record<ProductionStation, string> = {
  framing: "Framing",
  plumbing: "Plumbing",
  electrical: "Electrical",
  shell_prep: "Shell Prep",
  final_assembly: "Final Assembly",
  test: "Water Test",
  pack: "Pack",
  staging: "Staging",
};

export const STATION_FLOW: ProductionStation[] = [
  "framing",
  "plumbing",
  "electrical",
  "shell_prep",
  "final_assembly",
  "test",
  "pack",
  "staging",
];

export type WorkOrderStatus = "queued" | "in_progress" | "qc_hold" | "complete" | "cancelled";

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  queued: "Queued",
  in_progress: "In Progress",
  qc_hold: "QC Hold",
  complete: "Complete",
  cancelled: "Cancelled",
};

export const WORK_ORDER_STATUS_COLORS: Record<WorkOrderStatus, string> = {
  queued: "#94A3B8",
  in_progress: "#0891B2",
  qc_hold: "#DC2626",
  complete: "#059669",
  cancelled: "#64748B",
};

export interface QCEvent {
  station: ProductionStation;
  timestamp: Date;
  result: "pass" | "fail" | "fix_in_place";
  inspector: string;
  defectCategory?: DefectCategory;
  notes?: string;
}

export interface StationStep {
  station: ProductionStation;
  startedAt?: Date;
  completedAt?: Date;
  minutesSpent?: number;
  operator?: string;
  status: "pending" | "in_progress" | "complete" | "skipped";
  qc?: QCEvent;
}

export interface WorkOrder {
  id: string;
  workOrderNumber: string;
  serialNumber: string;
  orderId: string; // DealerOrder
  orderNumber: string;
  dealerId: string;
  dealerName: string;
  modelLine: ModelLine;
  model: string;
  color: string;
  cabinet: string;
  status: WorkOrderStatus;
  currentStation?: ProductionStation;
  startedAt?: Date;
  completedAt?: Date;
  targetCompletionAt: Date;
  totalMinutes?: number;
  targetMinutes: number;
  firstPassYield: boolean;
  steps: StationStep[];
  qcEvents: QCEvent[];
  priority: "standard" | "rush";
  batchId: string; // e.g. "W16-Line2"
}

// Typical minutes per station
const STATION_TARGET_MIN: Record<ProductionStation, number> = {
  framing: 180,
  plumbing: 240,
  electrical: 180,
  shell_prep: 150,
  final_assembly: 240,
  test: 120,
  pack: 90,
  staging: 60,
};

const OPERATOR_NAMES = [
  "Javier M.", "Sam K.", "Darnell P.", "Tom R.", "Chris L.", "Maria G.",
  "Alex W.", "Ben F.", "Kyle D.", "Marcus T.", "Rita S.", "Dan O.",
  "Luis V.", "Pete H.", "Erica N.", "Jordan B.",
];

const INSPECTOR_NAMES = ["Grace A.", "David B.", "Nadia S.", "Pablo R."];

function modelShortCode(modelLine: ModelLine): string {
  if (modelLine === "Michael Phelps Legend") return "L";
  if (modelLine === "Twilight") return "T";
  if (modelLine === "Clarity") return "C";
  if (modelLine === "H2X Fitness") return "H";
  return "S";
}

function generateWorkOrders(orders: DealerOrder[]): WorkOrder[] {
  const now = DEMO_NOW_REF;
  const out: WorkOrder[] = [];
  let counter = 1;

  // Orders that warrant work orders: approved → delivered (anything past credit check)
  const eligibleOrders = orders.filter((o) =>
    ["approved", "in_production", "ready_to_ship", "shipped", "delivered"].includes(o.status)
  );

  for (const order of eligibleOrders) {
    for (const line of order.lines) {
      for (let unitIdx = 0; unitIdx < line.qty; unitIdx++) {
        // Derive work-order status from order status
        let status: WorkOrderStatus;
        if (order.status === "approved") status = "queued";
        else if (order.status === "in_production") {
          status = rPickWeighted<WorkOrderStatus>([
            { value: "in_progress", weight: 85 },
            { value: "qc_hold", weight: 5 },
            { value: "queued", weight: 10 },
          ]);
        } else {
          // ready_to_ship, shipped, delivered → work order complete
          status = "complete";
        }

        const targetTotal = Object.values(STATION_TARGET_MIN).reduce((s, m) => s + m, 0);

        // Start/complete timestamps
        const orderApprovedAt = order.approvedAt?.getTime() ?? order.placedAt.getTime();
        const startedAt =
          status !== "queued"
            ? new Date(orderApprovedAt + rInt(1, 7) * 24 * 60 * 60 * 1000)
            : undefined;

        // Generate station steps
        const steps: StationStep[] = [];
        const qcEvents: QCEvent[] = [];
        let currentStation: ProductionStation | undefined;
        let completedAt: Date | undefined;
        let totalMinutes: number | undefined;
        let firstPassYield = true;

        if (status === "queued" || !startedAt) {
          for (const st of STATION_FLOW) {
            steps.push({ station: st, status: "pending" });
          }
          currentStation = undefined;
        } else {
          // Figure out how far along we are
          let progressFraction: number;
          if (status === "complete") progressFraction = 1.0;
          else if (status === "qc_hold") progressFraction = 0.45 + rng() * 0.3;
          else progressFraction = 0.15 + rng() * 0.7;

          const stationsDoneTarget = Math.min(
            STATION_FLOW.length,
            Math.max(1, Math.floor(progressFraction * STATION_FLOW.length + 0.5))
          );

          let cursorTime = startedAt.getTime();
          for (let si = 0; si < STATION_FLOW.length; si++) {
            const st = STATION_FLOW[si];
            const target = STATION_TARGET_MIN[st];

            if (si < stationsDoneTarget - 1 || (si === stationsDoneTarget - 1 && status === "complete")) {
              // fully completed station
              const actualMin = Math.round(target * (0.85 + rng() * 0.25));
              const startDate = new Date(cursorTime);
              const endDate = new Date(cursorTime + actualMin * 60 * 1000);
              cursorTime = endDate.getTime() + rInt(5, 30) * 60 * 1000;

              // QC at end of framing, electrical, test, pack
              let qc: QCEvent | undefined;
              if (st === "framing" || st === "electrical" || st === "test" || st === "pack") {
                const pass = rng() > 0.08;
                if (!pass) firstPassYield = false;
                const resolvable = rng() > 0.3;
                const result: QCEvent["result"] = pass
                  ? "pass"
                  : resolvable
                  ? "fix_in_place"
                  : "fail";
                const defectCategory = pass
                  ? undefined
                  : rPickWeighted<DefectCategory>([
                      { value: st === "electrical" ? "electrical" : "pump", weight: 5 },
                      { value: "jets", weight: 3 },
                      { value: "controls", weight: 3 },
                      { value: st === "test" ? "heater" : "other", weight: 2 },
                    ]);
                qc = {
                  station: st,
                  timestamp: endDate,
                  result,
                  inspector: rPick(INSPECTOR_NAMES),
                  defectCategory,
                  notes: pass
                    ? undefined
                    : result === "fix_in_place"
                    ? "Caught at QC — fixed in place, re-tested pass"
                    : "Defect caught at QC — unit to rework queue",
                };
                qcEvents.push(qc);
              }

              steps.push({
                station: st,
                startedAt: startDate,
                completedAt: endDate,
                minutesSpent: actualMin,
                operator: rPick(OPERATOR_NAMES),
                status: "complete",
                qc,
              });
            } else if (si === stationsDoneTarget - 1 && status !== "complete") {
              // currently in-progress station
              currentStation = st;
              const actualSoFar = Math.round(target * (0.2 + rng() * 0.6));
              const startDate = new Date(cursorTime);
              cursorTime = startDate.getTime() + actualSoFar * 60 * 1000;
              steps.push({
                station: st,
                startedAt: startDate,
                minutesSpent: actualSoFar,
                operator: rPick(OPERATOR_NAMES),
                status: status === "qc_hold" ? "in_progress" : "in_progress",
                qc: status === "qc_hold" ? {
                  station: st,
                  timestamp: new Date(cursorTime),
                  result: "fail",
                  inspector: rPick(INSPECTOR_NAMES),
                  defectCategory: "electrical",
                  notes: "Hold for supervisor sign-off before rework",
                } : undefined,
              });
              if (status === "qc_hold") firstPassYield = false;
            } else {
              steps.push({ station: st, status: "pending" });
            }
          }

          if (status === "complete") {
            completedAt = new Date(cursorTime);
            totalMinutes = Math.round((cursorTime - startedAt.getTime()) / 60000);
          }
        }

        const targetCompletionAt = new Date(
          (startedAt ?? new Date(orderApprovedAt + 2 * 24 * 60 * 60 * 1000)).getTime() +
            targetTotal * 60 * 1000 +
            rInt(0, 7 * 24 * 60) * 60 * 1000
        );

        const serialNumber =
          "MS" +
          new Date(startedAt ?? now).getFullYear().toString().slice(-2) +
          modelShortCode(line.modelLine) +
          String(100000 + counter * 19).slice(-6);

        const workOrderNumber = "WO-" + String(50000 + counter).padStart(6, "0");

        out.push({
          id: `wo-${counter}`,
          workOrderNumber,
          serialNumber,
          orderId: order.id,
          orderNumber: order.orderNumber,
          dealerId: order.dealerId,
          dealerName: order.dealerName,
          modelLine: line.modelLine,
          model: line.model,
          color: line.color,
          cabinet: line.cabinet,
          status,
          currentStation,
          startedAt,
          completedAt,
          targetCompletionAt,
          totalMinutes,
          targetMinutes: targetTotal,
          firstPassYield,
          steps,
          qcEvents,
          priority: order.priority,
          batchId: `W${Math.floor(counter / 12) + 1}-L${(counter % 3) + 1}`,
        });
        counter++;
      }
    }
  }
  return out;
}

export const WORK_ORDERS: WorkOrder[] = generateWorkOrders(DEALER_ORDERS);

export function workOrderById(id: string): WorkOrder | undefined {
  return WORK_ORDERS.find((wo) => wo.id === id);
}

export function factoryStats() {
  const now = DEMO_NOW_REF;
  const active = WORK_ORDERS.filter((wo) => wo.status === "in_progress" || wo.status === "qc_hold");
  const queued = WORK_ORDERS.filter((wo) => wo.status === "queued");
  const completed = WORK_ORDERS.filter((wo) => wo.status === "complete");
  const completedThisWeek = completed.filter(
    (wo) => wo.completedAt && wo.completedAt.getTime() > now - 7 * 24 * 60 * 60 * 1000
  );
  const completedToday = completed.filter(
    (wo) => wo.completedAt && wo.completedAt.getTime() > now - 24 * 60 * 60 * 1000
  );
  const qcHold = WORK_ORDERS.filter((wo) => wo.status === "qc_hold");
  const firstPassYield = completed.length > 0
    ? (completed.filter((wo) => wo.firstPassYield).length / completed.length) * 100
    : 0;
  const rushActive = active.filter((wo) => wo.priority === "rush");
  const avgCycleMinutes =
    completed.length > 0
      ? completed.reduce((s, wo) => s + (wo.totalMinutes ?? 0), 0) / completed.length
      : 0;
  const targetMinutes = WORK_ORDERS[0]?.targetMinutes ?? 1260;
  const cycleDelta = avgCycleMinutes > 0 ? ((avgCycleMinutes - targetMinutes) / targetMinutes) * 100 : 0;

  return {
    total: WORK_ORDERS.length,
    activeCount: active.length,
    queuedCount: queued.length,
    completedCount: completed.length,
    completedTodayCount: completedToday.length,
    completedThisWeekCount: completedThisWeek.length,
    qcHoldCount: qcHold.length,
    firstPassYield: +firstPassYield.toFixed(1),
    rushActiveCount: rushActive.length,
    avgCycleHours: +(avgCycleMinutes / 60).toFixed(1),
    targetCycleHours: +(targetMinutes / 60).toFixed(1),
    cycleDeltaPct: +cycleDelta.toFixed(1),
  };
}

export function stationWIP() {
  const counts: Record<ProductionStation, { count: number; rush: number; hold: number }> = {
    framing: { count: 0, rush: 0, hold: 0 },
    plumbing: { count: 0, rush: 0, hold: 0 },
    electrical: { count: 0, rush: 0, hold: 0 },
    shell_prep: { count: 0, rush: 0, hold: 0 },
    final_assembly: { count: 0, rush: 0, hold: 0 },
    test: { count: 0, rush: 0, hold: 0 },
    pack: { count: 0, rush: 0, hold: 0 },
    staging: { count: 0, rush: 0, hold: 0 },
  };
  for (const wo of WORK_ORDERS) {
    if (!wo.currentStation) continue;
    if (wo.status === "in_progress" || wo.status === "qc_hold") {
      counts[wo.currentStation].count++;
      if (wo.priority === "rush") counts[wo.currentStation].rush++;
      if (wo.status === "qc_hold") counts[wo.currentStation].hold++;
    }
  }
  return counts;
}

export function productionThroughputLast7Days() {
  const now = DEMO_NOW_REF;
  const out: { day: string; completed: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const completed = WORK_ORDERS.filter(
      (wo) => wo.completedAt && wo.completedAt >= dayStart && wo.completedAt < dayEnd
    );
    out.push({
      day: dayStart.toLocaleDateString("en-US", { weekday: "short" }),
      completed: completed.length,
    });
  }
  return out;
}

export function qcFailuresByStation() {
  const out: Record<ProductionStation, { passes: number; fails: number; fix_in_place: number }> = {
    framing: { passes: 0, fails: 0, fix_in_place: 0 },
    plumbing: { passes: 0, fails: 0, fix_in_place: 0 },
    electrical: { passes: 0, fails: 0, fix_in_place: 0 },
    shell_prep: { passes: 0, fails: 0, fix_in_place: 0 },
    final_assembly: { passes: 0, fails: 0, fix_in_place: 0 },
    test: { passes: 0, fails: 0, fix_in_place: 0 },
    pack: { passes: 0, fails: 0, fix_in_place: 0 },
    staging: { passes: 0, fails: 0, fix_in_place: 0 },
  };
  for (const wo of WORK_ORDERS) {
    for (const q of wo.qcEvents) {
      if (q.result === "pass") out[q.station].passes++;
      else if (q.result === "fail") out[q.station].fails++;
      else out[q.station].fix_in_place++;
    }
  }
  return out;
}

export function orderModelMix() {
  const mix: Record<ModelLine, { units: number; value: number }> = {
    "Michael Phelps Legend": { units: 0, value: 0 },
    Twilight: { units: 0, value: 0 },
    Clarity: { units: 0, value: 0 },
    "H2X Fitness": { units: 0, value: 0 },
    "MP Signature Swim Spa": { units: 0, value: 0 },
  };
  for (const o of DEALER_ORDERS) {
    if (o.status === "cancelled") continue;
    for (const l of o.lines) {
      mix[l.modelLine].units += l.qty;
      mix[l.modelLine].value += l.lineTotal;
    }
  }
  return mix;
}

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
