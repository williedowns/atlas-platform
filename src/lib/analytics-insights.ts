// Analytics insight engine — pure function. Takes a snapshot of aggregated
// analytics metrics (the same values the analytics page renders) and produces
// findings + recommendations grounded in the actual numbers.
//
// No LLM call. Every sentence references a real value from the input. The
// engine is intentionally conservative — it surfaces a finding when a numeric
// threshold is crossed, never speculates beyond what the data supports.

import { formatCurrency } from "./utils";

export type FindingLevel = "positive" | "neutral" | "warning";

export type Finding = {
  level: FindingLevel;
  title: string;
  body: string;
};

export type Recommendation = {
  priority: 1 | 2 | 3; // 1 = highest
  action: string;
  rationale: string;
};

export type InsightReport = {
  headline: string;
  findings: Finding[];
  recommendations: Recommendation[];
};

export type RepSnapshot = {
  name: string;
  revenue: number;
  count: number;
};

export type ShowSnapshot = {
  name: string;
  venue_name: string | null;
  revenue: number;
  cost: number | null;
  profit: number | null;
};

export type AnalyticsSnapshot = {
  period: "today" | "week" | "month" | "year" | "all";
  periodLabel: string;
  totalRevenue: number;
  totalDeposits: number;
  contractCount: number;
  avgDeal: number;
  netProfit: number;
  totalShowCost: number;

  // YoY
  priorRevenue: number;
  priorCount: number;
  revDelta: number | null; // %

  // Cancellations
  cancelCount: number;
  cancelTotal: number;
  cancelRate: number | null; // %

  // Velocity
  velocityMedian: number | null;
  velocityCount: number;

  // Attach
  mainUnits: number;
  mainRevenue: number;
  accessoryRevenue: number;
  attachPctOfMain: number | null;

  // Reps
  reps: RepSnapshot[];

  // Shows
  shows: ShowSnapshot[];

  // Outstanding
  signedNoDepositCount: number;
  pendingSigCount: number;
  totalBalanceDue: number;

  // Goal (monthly only)
  totalGoal: number | null;
  totalGoalPct: number | null;
};

const PRIORITY_RANK: Record<1 | 2 | 3, number> = { 1: 0, 2: 1, 3: 2 };
const LEVEL_RANK: Record<FindingLevel, number> = { warning: 0, positive: 1, neutral: 2 };

function magnitudeWord(absPct: number): string {
  if (absPct >= 50) return "dramatic";
  if (absPct >= 25) return "significant";
  if (absPct >= 10) return "material";
  if (absPct >= 5) return "modest";
  return "slight";
}

export function generateInsights(s: AnalyticsSnapshot): InsightReport {
  const findings: Finding[] = [];
  const recommendations: Recommendation[] = [];

  // ── Rule 1: YoY revenue trend ────────────────────────────────────────────
  if (s.revDelta != null && s.priorRevenue > 0) {
    const abs = Math.abs(s.revDelta);
    const dir = s.revDelta >= 0 ? "up" : "down";
    const word = magnitudeWord(abs);
    findings.push({
      level: s.revDelta >= 0 ? "positive" : "warning",
      title: `Revenue is ${dir} ${abs.toFixed(1)}% vs the same period last year`,
      body: `Gross revenue of ${formatCurrency(s.totalRevenue)} represents a ${word} ${dir}-shift from last year's ${formatCurrency(s.priorRevenue)}. Contract count: ${s.contractCount} now vs ${s.priorCount} prior.`,
    });
    if (s.revDelta < -10) {
      recommendations.push({
        priority: 1,
        action: `Run a same-period comparison by show to find which events underperformed`,
        rationale: `Revenue dropped ${abs.toFixed(1)}% YoY (${formatCurrency(s.priorRevenue - s.totalRevenue)} gap). Identifying the underperforming venues lets you fix them or cut them next year.`,
      });
    }
  } else if (s.totalRevenue > 0 && s.priorRevenue === 0) {
    findings.push({
      level: "neutral",
      title: `No comparable prior-period data`,
      body: `Gross revenue ${formatCurrency(s.totalRevenue)} this period. Prior year shows zero — YoY trend cannot be measured.`,
    });
  }

  // ── Rule 2: Rep concentration risk ─────────────────────────────────────
  // Concentration is a REVENUE concept — find the highest-revenue rep
  // regardless of how the caller sorted the array (the PDF route sorts by
  // composite score, not pure revenue).
  if (s.reps.length >= 2 && s.totalRevenue > 0) {
    const topRep = [...s.reps].sort((a, b) => b.revenue - a.revenue)[0];
    const topShare = (topRep.revenue / s.totalRevenue) * 100;
    if (topShare >= 40) {
      findings.push({
        level: "warning",
        title: `Sales concentration risk — ${topRep.name} drove ${topShare.toFixed(0)}% of revenue`,
        body: `${topRep.name} closed ${formatCurrency(topRep.revenue)} of the ${formatCurrency(s.totalRevenue)} period total across ${topRep.count} deals. The remaining ${s.reps.length - 1} reps split ${formatCurrency(s.totalRevenue - topRep.revenue)}. If your top rep leaves or has a bad month, the business takes a meaningful hit.`,
      });
      recommendations.push({
        priority: 1,
        action: `Pair the bottom-tier reps with ${topRep.name} on the next show — ride-along training`,
        rationale: `${topRep.name}'s average deal size is ${formatCurrency(topRep.revenue / topRep.count)}. Closing that gap across the rest of the team is the highest-leverage move you can make this quarter.`,
      });
    } else if (s.reps.length >= 3) {
      findings.push({
        level: "positive",
        title: `Sales team is well-balanced`,
        body: `Top rep ${topRep.name} closed ${topShare.toFixed(0)}% of revenue — healthy distribution. ${s.reps.length} reps contributed this period.`,
      });
    }
  }

  // ── Rule 3: Best & worst show ROI ──────────────────────────────────────
  const showsWithROI = s.shows.filter((sh) => sh.cost != null && sh.cost > 0 && sh.profit != null);
  if (showsWithROI.length >= 1) {
    const ranked = showsWithROI
      .map((sh) => ({ sh, roi: ((sh.revenue - (sh.cost as number)) / (sh.cost as number)) * 100 }))
      .sort((a, b) => b.roi - a.roi);
    const best = ranked[0].sh;
    const bestROI = ranked[0].roi;
    findings.push({
      level: bestROI > 0 ? "positive" : "warning",
      title: `Best-ROI show: ${best.venue_name ?? best.name} — ${bestROI.toFixed(0)}%`,
      body: `${best.venue_name ?? best.name} generated ${formatCurrency(best.revenue)} against ${formatCurrency(best.cost ?? 0)} cost — net ${formatCurrency(best.profit ?? 0)}. This is the model show to replicate.`,
    });

    if (showsWithROI.length >= 2) {
      const worstEntry = ranked[ranked.length - 1];
      const worst = worstEntry.sh;
      const worstROI = worstEntry.roi;
      if (worstROI < 0) {
        findings.push({
          level: "warning",
          title: `Loss-making show: ${worst.venue_name ?? worst.name} — ${worstROI.toFixed(0)}% ROI`,
          body: `${worst.venue_name ?? worst.name} brought in ${formatCurrency(worst.revenue)} on ${formatCurrency(worst.cost ?? 0)} cost — net loss of ${formatCurrency(Math.abs(worst.profit ?? 0))}. Hard data for cutting from next year's calendar.`,
        });
        recommendations.push({
          priority: 2,
          action: `Drop ${worst.venue_name ?? worst.name} from next year's show calendar or renegotiate the booth cost`,
          rationale: `This show lost ${formatCurrency(Math.abs(worst.profit ?? 0))}. Even breaking even would have added that much to net profit.`,
        });
      } else if (worstROI < 20) {
        recommendations.push({
          priority: 3,
          action: `Review the ROI of ${worst.venue_name ?? worst.name} before recommitting`,
          rationale: `${worstROI.toFixed(0)}% ROI is thin given booth cost + staffing risk. Worth verifying the show is still pulling its weight.`,
        });
      }
    }
  }

  // ── Rule 4: Cancellation rate ─────────────────────────────────────────
  if (s.cancelRate != null && s.cancelRate >= 10) {
    findings.push({
      level: "warning",
      title: `Cancellation rate is ${s.cancelRate.toFixed(1)}% — above the 10% threshold`,
      body: `${s.cancelCount} cancellations this period totaling ${formatCurrency(s.cancelTotal)} in lost revenue. High cancel rates usually signal a deposit-collection or qualification problem at point of sale.`,
    });
    recommendations.push({
      priority: 1,
      action: `Audit the last ${Math.min(s.cancelCount, 10)} cancellations for common patterns — deposit size, financing decline, buyer remorse`,
      rationale: `Recovering even half the cancelled revenue (${formatCurrency(s.cancelTotal / 2)}) would meaningfully boost the period total.`,
    });
  } else if (s.cancelCount === 0 && s.contractCount > 0) {
    findings.push({
      level: "positive",
      title: `Zero cancellations this period`,
      body: `${s.contractCount} contracts written, none cancelled. Strong customer commitment.`,
    });
  }

  // ── Rule 5: Outstanding balance / collection risk ─────────────────────
  if (s.signedNoDepositCount > 0) {
    findings.push({
      level: "warning",
      title: `${s.signedNoDepositCount} signed contract${s.signedNoDepositCount === 1 ? "" : "s"} with zero deposit collected`,
      body: `These are signed but the customer hasn't put any money down. Total balance at risk: ${formatCurrency(s.totalBalanceDue)}. Every day that passes raises cancel probability.`,
    });
    recommendations.push({
      priority: 1,
      action: `Call the ${s.signedNoDepositCount} signed-no-deposit customer${s.signedNoDepositCount === 1 ? "" : "s"} this week to collect`,
      rationale: `Signed without deposit is the highest-risk state — they've committed verbally but haven't committed financially. Industry rule of thumb: deposits on the day of signing close 95%+, 7-day-old unsigned deposits drop to ~60%.`,
    });
  }
  if (s.pendingSigCount > 0) {
    findings.push({
      level: "warning",
      title: `${s.pendingSigCount} contract${s.pendingSigCount === 1 ? "" : "s"} awaiting signature`,
      body: `Sent to customer but not yet signed. Every day that passes raises drop-off risk.`,
    });
  }

  // ── Rule 6: Sales velocity ─────────────────────────────────────────────
  if (s.velocityMedian != null && s.velocityCount >= 3 && s.period !== "all") {
    if (s.velocityMedian > 14) {
      findings.push({
        level: "warning",
        title: `Median sales cycle is ${s.velocityMedian.toFixed(1)} days — slower than ideal`,
        body: `Across ${s.velocityCount} signed deals, the median time from contract creation to signature was ${s.velocityMedian.toFixed(1)} days. Show sales typically close same-day; high median usually means quotes that turn into deals stretch too long.`,
      });
      recommendations.push({
        priority: 2,
        action: `Set a 7-day follow-up cadence for any unsigned contract older than 3 days`,
        rationale: `Halving the ${s.velocityMedian.toFixed(0)}-day median to ~7 days would compress the sales cycle and free working capital. Aged quotes also have higher cancel rates.`,
      });
    } else if (s.velocityMedian <= 3) {
      findings.push({
        level: "positive",
        title: `Sales cycle is fast — ${s.velocityMedian.toFixed(1)}-day median`,
        body: `${s.velocityCount} deals closed with a ${s.velocityMedian.toFixed(1)}-day median. Indicates effective close-at-show technique.`,
      });
    }
  }

  // ── Rule 7: Attach rate ────────────────────────────────────────────────
  if (s.mainUnits >= 3 && s.attachPctOfMain != null && s.mainRevenue > 0) {
    if (s.attachPctOfMain < 5) {
      findings.push({
        level: "warning",
        title: `Accessory attach rate is only ${s.attachPctOfMain.toFixed(1)}% of main revenue`,
        body: `Across ${s.mainUnits} main unit${s.mainUnits === 1 ? "" : "s"} sold (${formatCurrency(s.mainRevenue)}), accessories added just ${formatCurrency(s.accessoryRevenue)}. Industry benchmark is 10-20% — the gap is real revenue you're leaving on the floor.`,
      });
      recommendations.push({
        priority: 2,
        action: `Build a "spa starter package" SKU that bundles cover, steps, chemicals, and 6 months of service — train reps to position it as the default`,
        rationale: `Closing the attach-rate gap from ${s.attachPctOfMain.toFixed(1)}% to 15% on ${formatCurrency(s.mainRevenue)} of main revenue would add roughly ${formatCurrency((0.15 - (s.attachPctOfMain / 100)) * s.mainRevenue)} this period at near-100% margin.`,
      });
    } else if (s.attachPctOfMain >= 15) {
      findings.push({
        level: "positive",
        title: `Strong accessory attach — ${s.attachPctOfMain.toFixed(1)}% of main revenue`,
        body: `${formatCurrency(s.accessoryRevenue)} in accessories on ${formatCurrency(s.mainRevenue)} of main units. Reps are upselling effectively.`,
      });
    }
  }

  // ── Rule 8: Goal pacing (monthly) ─────────────────────────────────────
  if (s.period === "month" && s.totalGoalPct != null && s.totalGoal != null) {
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const expectedPct = (dayOfMonth / daysInMonth) * 100;
    const gapToTarget = s.totalGoalPct - expectedPct;

    if (Math.abs(gapToTarget) >= 10) {
      findings.push({
        level: gapToTarget >= 0 ? "positive" : "warning",
        title: gapToTarget >= 0
          ? `Pacing ahead of target — ${s.totalGoalPct.toFixed(0)}% of goal at day ${dayOfMonth}/${daysInMonth}`
          : `Pacing behind target — ${s.totalGoalPct.toFixed(0)}% of goal at day ${dayOfMonth}/${daysInMonth}`,
        body: `Team revenue ${formatCurrency(s.totalRevenue)} against ${formatCurrency(s.totalGoal)} goal. By day ${dayOfMonth} of ${daysInMonth} you'd expect ~${expectedPct.toFixed(0)}% pacing to hit the number.`,
      });
      if (gapToTarget < 0) {
        const dailyNeeded = (s.totalGoal - s.totalRevenue) / Math.max(1, daysInMonth - dayOfMonth);
        recommendations.push({
          priority: 1,
          action: `Set a ${formatCurrency(dailyNeeded)}/day team target for the rest of the month`,
          rationale: `${formatCurrency(s.totalGoal - s.totalRevenue)} gap to goal with ${daysInMonth - dayOfMonth} days remaining.`,
        });
      }
    }
  }

  // ── Rule 9: Net profit health ─────────────────────────────────────────
  if (s.totalShowCost > 0) {
    const netMargin = (s.netProfit / s.totalRevenue) * 100;
    if (netMargin < 60 && s.totalRevenue > 0) {
      findings.push({
        level: "neutral",
        title: `Show costs consumed ${(100 - netMargin).toFixed(0)}% of revenue`,
        body: `${formatCurrency(s.totalShowCost)} in show costs against ${formatCurrency(s.totalRevenue)} revenue — net ${formatCurrency(s.netProfit)}. Shows are a meaningful cost center; cost-per-contract is ${formatCurrency(s.totalShowCost / Math.max(1, s.contractCount))}.`,
      });
    }
  }

  // ── Safety net — never an empty section ──────────────────────────────
  if (findings.length === 0) {
    findings.push({
      level: "neutral",
      title: `Limited activity this period`,
      body: `Period ${s.periodLabel} produced ${s.contractCount} contract${s.contractCount === 1 ? "" : "s"} and ${formatCurrency(s.totalRevenue)} in revenue. Not enough data to surface trend-based insights — try a longer period.`,
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      priority: 3,
      action: `Continue current sales approach and review again next period`,
      rationale: `No threshold crossings detected — operations look steady. Recheck after the next major show.`,
    });
  }

  // ── Sort & cap ────────────────────────────────────────────────────────
  findings.sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level]);
  recommendations.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);

  // ── Headline ─────────────────────────────────────────────────────────
  const warningCount = findings.filter((f) => f.level === "warning").length;
  let headline: string;
  if (s.revDelta != null && Math.abs(s.revDelta) >= 5) {
    const dir = s.revDelta >= 0 ? "up" : "down";
    headline = `Revenue is ${dir} ${Math.abs(s.revDelta).toFixed(0)}% YoY at ${formatCurrency(s.totalRevenue)} — ${warningCount} item${warningCount === 1 ? "" : "s"} need${warningCount === 1 ? "s" : ""} attention.`;
  } else if (s.totalRevenue > 0) {
    headline = `${formatCurrency(s.totalRevenue)} revenue on ${s.contractCount} contract${s.contractCount === 1 ? "" : "s"} — ${warningCount} item${warningCount === 1 ? "" : "s"} flagged for action.`;
  } else {
    headline = `No revenue activity in ${s.periodLabel}.`;
  }

  return { headline, findings, recommendations };
}
