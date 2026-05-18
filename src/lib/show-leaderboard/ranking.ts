import data from "./data.json";

export type Deal = {
  show_id: string;
  year: number;
  status: string;
  salesmen: string[];
  sale_price: number;
  total_cost: number;
  has_lift: boolean;
  model: string | null;
};

export type Show = { id: string; date: string; city: string; year: number };

/** The "current year" used for ranking metrics. 2025 data feeds eligibility only. */
export const RANKING_YEAR = 2026;

export type Dataset = {
  generated_at: string;
  source_folder: string;
  shows: Show[];
  deals: Deal[];
};

/**
 * Composite-score weights. Edit these to retune the leaderboard.
 *   margin_per_show — gross-margin dollars produced per expo worked
 *   units_per_show  — productivity, separate from price
 *   avg_sale_price  — upsell skill (swim spas, premium options)
 *   lift_attach     — add-on discipline / customer-service signal
 *   cancel_rate     — quality-of-close penalty (subtracted)
 */
export const DEFAULT_WEIGHTS = {
  margin_per_show: 0.40,
  units_per_show: 0.25,
  avg_sale_price: 0.20,
  lift_attach: 0.15,
  cancel_rate: 0.05,
} as const;

export const ELIGIBILITY_FLOOR = 8;
export const LEADERBOARD_SIZE = 15;

export type RepMetrics = {
  name: string;
  /** Shows worked across ALL years tracked. Drives eligibility. */
  shows_total: number;
  /** Shows worked in the current ranking year. Drives all metrics below. */
  shows: number;
  units: number;
  revenue: number;
  total_margin: number;
  margin_per_show: number;
  units_per_show: number;
  avg_sale_price: number;
  lift_attach: number;
  cancel_rate: number;
};

export type RankedRep = RepMetrics & {
  rank: number;
  score: number;
  z: {
    margin_per_show: number;
    units_per_show: number;
    avg_sale_price: number;
    lift_attach: number;
    cancel_rate: number;
  };
};

type RepAccumulator = {
  /** Distinct shows across all years. Drives eligibility. */
  shows_all_years: Set<string>;
  /** Distinct shows in the ranking year only. Drives per-show metrics. */
  shows_ranking_year: Set<string>;
  /** All numeric metrics below are for the ranking year only. */
  units: number;
  revenue: number;
  margin: number;
  deals_total: number;
  deals_ok: number;
  lifts: number;
  cancelled: number;
};

function emptyAccumulator(): RepAccumulator {
  return {
    shows_all_years: new Set(),
    shows_ranking_year: new Set(),
    units: 0,
    revenue: 0,
    margin: 0,
    deals_total: 0,
    deals_ok: 0,
    lifts: 0,
    cancelled: 0,
  };
}

function accumulate(deals: Deal[], rankingYear: number): Map<string, RepAccumulator> {
  const reps = new Map<string, RepAccumulator>();
  for (const deal of deals) {
    const names = deal.salesmen;
    if (names.length === 0) continue;
    const share = 1 / names.length;
    const isRankingYear = deal.year === rankingYear;
    for (const name of names) {
      let acc = reps.get(name);
      if (!acc) {
        acc = emptyAccumulator();
        reps.set(name, acc);
      }
      acc.shows_all_years.add(deal.show_id);
      if (!isRankingYear) continue;
      acc.shows_ranking_year.add(deal.show_id);
      // Only OK and Cancelled deals enter ANY rep metric. Low Deposit, Contingent,
      // and Financing Pending are treated as pending and ignored entirely.
      if (deal.status === "Cancelled") {
        acc.deals_total += share;
        acc.cancelled += share;
      } else if (deal.status === "OK") {
        acc.deals_total += share;
        acc.units += share;
        acc.deals_ok += share;
        acc.revenue += deal.sale_price * share;
        acc.margin += (deal.sale_price - deal.total_cost) * share;
        if (deal.has_lift) acc.lifts += share;
      }
    }
  }
  return reps;
}

function toMetrics(name: string, acc: RepAccumulator): RepMetrics {
  const shows_total = acc.shows_all_years.size;
  const shows = acc.shows_ranking_year.size;
  const denomDeals = Math.max(acc.deals_ok, 1);
  const denomAll = Math.max(acc.deals_total, 1);
  return {
    name,
    shows_total,
    shows,
    units: acc.units,
    revenue: acc.revenue,
    total_margin: acc.margin,
    margin_per_show: shows > 0 ? acc.margin / shows : 0,
    units_per_show: shows > 0 ? acc.units / shows : 0,
    avg_sale_price: acc.revenue / denomDeals,
    lift_attach: acc.lifts / denomDeals,
    cancel_rate: acc.cancelled / denomAll,
  };
}

function zscore(values: number[]): number[] {
  if (values.length === 0) return [];
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance) || 1;
  return values.map((v) => (v - mean) / std);
}

export type RankingOutput = {
  eligible: RankedRep[];
  approaching: { name: string; shows: number; needed: number }[];
  pool_size: number;
  total_reps: number;
  /** Show count limited to the ranking year. */
  total_shows: number;
  /** OK deals limited to the ranking year. */
  total_deals_ok: number;
  ranking_year: number;
  generated_at: string;
};

export function buildRanking(
  dataset: Dataset = data as Dataset,
  weights = DEFAULT_WEIGHTS,
  floor = ELIGIBILITY_FLOOR,
  rankingYear = RANKING_YEAR
): RankingOutput {
  const reps = accumulate(dataset.deals, rankingYear);

  const eligible: RepMetrics[] = [];
  const approaching: { name: string; shows: number; needed: number }[] = [];
  for (const [name, acc] of reps) {
    const m = toMetrics(name, acc);
    // Eligibility: ranking-year shows >= floor AND at least one OK ranking-year deal
    if (m.shows >= floor && m.units > 0) {
      eligible.push(m);
    } else if (m.shows >= floor - 3 && m.shows < floor) {
      approaching.push({ name, shows: m.shows, needed: floor - m.shows });
    }
  }
  approaching.sort((a, b) => b.shows - a.shows || a.name.localeCompare(b.name));

  const z_margin = zscore(eligible.map((r) => r.margin_per_show));
  const z_units = zscore(eligible.map((r) => r.units_per_show));
  const z_avg = zscore(eligible.map((r) => r.avg_sale_price));
  const z_lift = zscore(eligible.map((r) => r.lift_attach));
  const z_cancel = zscore(eligible.map((r) => r.cancel_rate));

  const ranked: RankedRep[] = eligible.map((rep, i) => {
    const z = {
      margin_per_show: z_margin[i],
      units_per_show: z_units[i],
      avg_sale_price: z_avg[i],
      lift_attach: z_lift[i],
      cancel_rate: z_cancel[i],
    };
    const score =
      weights.margin_per_show * z.margin_per_show +
      weights.units_per_show * z.units_per_show +
      weights.avg_sale_price * z.avg_sale_price +
      weights.lift_attach * z.lift_attach -
      weights.cancel_rate * z.cancel_rate;
    return { ...rep, z, score, rank: 0 };
  });

  ranked.sort((a, b) => b.score - a.score);
  ranked.forEach((r, i) => (r.rank = i + 1));

  const rankingYearDeals = dataset.deals.filter((d) => d.year === rankingYear);
  const totalShows = new Set(rankingYearDeals.map((d) => d.show_id)).size;
  const totalDealsOk = rankingYearDeals.filter((d) => d.status === "OK").length;

  return {
    eligible: ranked.slice(0, LEADERBOARD_SIZE),
    approaching,
    pool_size: ranked.length,
    total_reps: reps.size,
    total_shows: totalShows,
    total_deals_ok: totalDealsOk,
    ranking_year: rankingYear,
    generated_at: dataset.generated_at,
  };
}
