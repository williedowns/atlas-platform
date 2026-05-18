"use client";

import { useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/ui/AppHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RankingOutput, RankedRep } from "@/lib/show-leaderboard/ranking";
import { ELIGIBILITY_FLOOR, LEADERBOARD_SIZE, RANKING_YEAR, DEFAULT_WEIGHTS } from "@/lib/show-leaderboard/ranking";

const FACTORS = [
  {
    key: "margin_per_show" as const,
    label: "Margin $ per show",
    weight: DEFAULT_WEIGHTS.margin_per_show,
    sign: "+" as const,
    description: "Pure profit dollars produced per expo worked. Combines volume, pricing, and margin discipline into one number — the biggest single driver of your rank.",
  },
  {
    key: "units_per_show" as const,
    label: "Units per show",
    weight: DEFAULT_WEIGHTS.units_per_show,
    sign: "+" as const,
    description: "How many units you close per expo. Pure productivity, separate from price.",
  },
  {
    key: "avg_sale_price" as const,
    label: "Average sale price",
    weight: DEFAULT_WEIGHTS.avg_sale_price,
    sign: "+" as const,
    description: "Your typical ticket size. Rewards upselling into swim spas and premium options.",
  },
  {
    key: "lift_attach" as const,
    label: "Cover lift attach %",
    weight: DEFAULT_WEIGHTS.lift_attach,
    sign: "+" as const,
    description: "Percentage of your closed deals where a cover lift was added. Add-on discipline and customer-service signal.",
  },
  {
    key: "cancel_rate" as const,
    label: "Cancellation rate",
    weight: DEFAULT_WEIGHTS.cancel_rate,
    sign: "-" as const,
    description: "Percentage of your deals that died. SUBTRACTED from your score — quality of close matters.",
  },
];

function factorRawValue(rep: RankedRep, key: typeof FACTORS[number]["key"]): string {
  if (key === "margin_per_show") return fmtCurrency(rep.margin_per_show);
  if (key === "units_per_show") return rep.units_per_show.toFixed(2);
  if (key === "avg_sale_price") return fmtCurrency(rep.avg_sale_price);
  if (key === "lift_attach") return fmtPct(rep.lift_attach);
  return fmtPct(rep.cancel_rate);
}

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const fmtCurrencyCompact = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(n);

const fmtPct = (n: number) => `${Math.round(n * 100)}%`;

const PODIUM_COLORS = ["#EAB308", "#94A3B8", "#CD7F32"];

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    const bg = PODIUM_COLORS[rank - 1];
    return (
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-base shadow-md"
        style={{ background: bg }}
      >
        {rank}
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-base bg-slate-100 text-slate-600">
      {rank}
    </div>
  );
}

function RepRow({ rep, isStage }: { rep: RankedRep; isStage: boolean }) {
  const textColor = isStage ? "text-white" : "text-slate-900";
  const subColor = isStage ? "text-white/60" : "text-slate-500";
  const labelColor = isStage ? "text-white/50" : "text-slate-400";
  const rowBg = isStage ? "bg-white/5 border-white/10" : "bg-white border-slate-200";

  return (
    <div className={`flex items-center gap-4 rounded-xl border p-4 ${rowBg}`}>
      <RankBadge rank={rep.rank} />

      <div className="flex-1 min-w-0">
        <div className={`font-bold text-lg truncate ${textColor}`}>{rep.name}</div>
        <div className={`text-xs ${subColor}`}>
          {rep.shows} shows in {RANKING_YEAR}
          {rep.shows_total > rep.shows && (
            <> · {rep.shows_total} all-time</>
          )}
          {" · "}
          {rep.units.toFixed(1)} units · {fmtCurrency(rep.revenue)} revenue
        </div>
      </div>

      <div className="hidden md:grid grid-cols-4 gap-4 text-right">
        <div>
          <div className={`text-[10px] uppercase tracking-wide ${labelColor}`}>$/show</div>
          <div className={`font-semibold ${textColor}`}>{fmtCurrencyCompact(rep.margin_per_show)}</div>
        </div>
        <div>
          <div className={`text-[10px] uppercase tracking-wide ${labelColor}`}>Avg sale</div>
          <div className={`font-semibold ${textColor}`}>{fmtCurrencyCompact(rep.avg_sale_price)}</div>
        </div>
        <div>
          <div className={`text-[10px] uppercase tracking-wide ${labelColor}`}>Lift attach</div>
          <div className={`font-semibold ${textColor}`}>{fmtPct(rep.lift_attach)}</div>
        </div>
        <div>
          <div className={`text-[10px] uppercase tracking-wide ${labelColor}`}>Cancel</div>
          <div className={`font-semibold ${textColor}`}>{fmtPct(rep.cancel_rate)}</div>
        </div>
      </div>

      <div className="flex flex-col items-end min-w-[64px]">
        <div className={`text-[10px] uppercase tracking-wide ${labelColor}`}>Score</div>
        <div
          className={`font-black text-xl ${rep.score >= 0 ? "text-[#00929C]" : "text-slate-400"}`}
          style={isStage && rep.score >= 0 ? { color: "#5EEAD4" } : undefined}
        >
          {rep.score >= 0 ? "+" : ""}
          {rep.score.toFixed(2)}
        </div>
      </div>
    </div>
  );
}

export default function LeaderboardClient({ ranking }: { ranking: RankingOutput }) {
  const [stageMode, setStageMode] = useState(false);

  const eligible = ranking.eligible;

  if (stageMode) {
    return (
      <div
        className="fixed inset-0 z-50 overflow-auto p-8 md:p-12"
        style={{ background: "radial-gradient(ellipse at center top, #0F2038 0%, #010F21 80%)" }}
      >
        <button
          onClick={() => setStageMode(false)}
          className="absolute top-6 right-6 text-white/40 hover:text-white/80 text-sm"
        >
          Exit stage mode ×
        </button>

        <div className="text-center mb-10">
          <div className="inline-block px-4 py-1.5 rounded-full bg-white/10 text-white/80 text-xs uppercase tracking-[0.3em] mb-4">
            Atlas Spas · {RANKING_YEAR} YTD Sales Leaderboard
          </div>
          <h1 className="text-white text-5xl md:text-6xl font-black tracking-tight mb-2">
            TOP {LEADERBOARD_SIZE} SALES REPS
          </h1>
          <p className="text-white/60 text-lg">
            Composite ranking · {ranking.total_shows} expos · {ranking.total_deals_ok} closed deals
          </p>
        </div>

        <div className="max-w-5xl mx-auto space-y-3">
          {eligible.map((rep) => (
            <RepRow key={rep.name} rep={rep} isStage />
          ))}
        </div>

        <p className="text-center text-white/40 text-xs mt-8">
          Eligibility: {ELIGIBILITY_FLOOR}+ shows worked. {ranking.pool_size} of {ranking.total_reps} reps qualified.
        </p>
      </div>
    );
  }

  return (
    <>
      <AppHeader
        title="Sales Rep Leaderboard"
        subtitle={`Top ${Math.min(LEADERBOARD_SIZE, eligible.length)} · ${ranking.total_shows} ${RANKING_YEAR} expos · refreshed ${ranking.generated_at}`}
        backHref="/shows"
        actions={
          <div className="flex gap-2">
            <Link href="/shows">
              <Button variant="ghost" size="sm">
                Back to shows
              </Button>
            </Link>
            <Button variant="accent" size="sm" onClick={() => setStageMode(true)}>
              Stage mode
            </Button>
          </div>
        }
      />

      <main className="px-5 py-6 max-w-5xl mx-auto pb-24">
        <div
          className="rounded-xl border border-white/10 p-5 mb-6 text-white shadow-sm"
          style={{ background: "linear-gradient(135deg, #010F21 0%, #024452 100%)" }}
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-baseline">
            <div>
              <div className="text-white/70 text-xs uppercase tracking-wide mb-1">Eligible reps</div>
              <div className="text-2xl font-bold text-white">
                {ranking.pool_size}
                <span className="text-white/60 text-sm font-normal"> / {ranking.total_reps} total</span>
              </div>
            </div>
            <div>
              <div className="text-white/70 text-xs uppercase tracking-wide mb-1">Eligibility floor</div>
              <div className="text-2xl font-bold text-white">{ELIGIBILITY_FLOOR}+ shows</div>
            </div>
            <div>
              <div className="text-white/70 text-xs uppercase tracking-wide mb-1">Closed deals YTD</div>
              <div className="text-2xl font-bold text-white">{ranking.total_deals_ok}</div>
            </div>
            <div className="text-xs text-white/70 leading-relaxed md:border-l md:border-white/10 md:pl-4">
              Score = {Math.round(DEFAULT_WEIGHTS.margin_per_show * 100)}% margin/show +{" "}
              {Math.round(DEFAULT_WEIGHTS.units_per_show * 100)}% units/show +{" "}
              {Math.round(DEFAULT_WEIGHTS.avg_sale_price * 100)}% avg sale +{" "}
              {Math.round(DEFAULT_WEIGHTS.lift_attach * 100)}% lift attach −{" "}
              {Math.round(DEFAULT_WEIGHTS.cancel_rate * 100)}% cancel rate. All factors Z-scored.
              Eligibility: {ELIGIBILITY_FLOOR}+ shows in {RANKING_YEAR}.
            </div>
          </div>
        </div>

        {eligible.length === 0 ? (
          <Card className="p-8 text-center text-slate-500">
            No reps have hit the {ELIGIBILITY_FLOOR}-show eligibility floor yet.
          </Card>
        ) : (
          <div className="space-y-3">
            {eligible.map((rep) => (
              <RepRow key={rep.name} rep={rep} isStage={false} />
            ))}
          </div>
        )}

        {ranking.approaching.length > 0 && (
          <section className="mt-10">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Approaching Eligibility
            </h2>
            <div className="flex flex-wrap gap-2">
              {ranking.approaching.map((rep) => (
                <Badge key={rep.name} variant="outline" className="text-sm py-1">
                  <span className="font-semibold mr-2">{rep.name}</span>
                  <span className="text-slate-500">
                    {rep.shows} shows · {rep.needed} more to qualify
                  </span>
                </Badge>
              ))}
            </div>
          </section>
        )}

        {eligible.length > 0 && (
          <section className="mt-12 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">How this leaderboard works</h2>
              <p className="text-slate-600 mt-2 max-w-3xl">
                You're scored on five factors. For each factor, we compare your number to the
                average of everyone on the leaderboard, weight it, and add the contributions
                together. The highest total wins #1.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                The five factors
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                {FACTORS.map((f) => (
                  <div
                    key={f.key}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-baseline justify-between mb-2">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        Weight
                      </div>
                      <div
                        className={`text-2xl font-black ${f.sign === "-" ? "text-red-600" : "text-[#00929C]"}`}
                      >
                        {f.sign}
                        {Math.round(f.weight * 100)}%
                      </div>
                    </div>
                    <div className="font-bold text-slate-900 mb-1">{f.label}</div>
                    <div className="text-xs text-slate-600 leading-relaxed">{f.description}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="font-bold text-slate-900 mb-2">
                The "vs. peers" piece — what a Z-score actually means
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                For each factor, we don't just look at your raw number — we compare it to the
                average of every eligible rep on the leaderboard. If you're above the pool average,
                that factor pushes your score <span className="font-semibold text-emerald-700">up</span>.
                If you're below, it pulls you <span className="font-semibold text-red-700">down</span>.
                How far above or below determines the magnitude.
              </p>
              <p className="text-sm text-slate-700 leading-relaxed mt-3">
                This is why being #1 means you're outperforming your peers — not just producing
                positive numbers.
              </p>
              <div className="mt-4 rounded-lg bg-white border border-slate-200 p-3 font-mono text-xs text-slate-700 overflow-x-auto">
                Score&nbsp;=&nbsp;(margin Z × {DEFAULT_WEIGHTS.margin_per_show.toFixed(2)}) +
                (units Z × {DEFAULT_WEIGHTS.units_per_show.toFixed(2)}) +
                (avg sale Z × {DEFAULT_WEIGHTS.avg_sale_price.toFixed(2)}) +
                (lift Z × {DEFAULT_WEIGHTS.lift_attach.toFixed(2)}) −
                (cancel Z × {DEFAULT_WEIGHTS.cancel_rate.toFixed(2)})
              </div>
            </div>

            <div
              className="rounded-xl p-6 text-white shadow-sm"
              style={{ background: "linear-gradient(135deg, #010F21 0%, #024452 100%)" }}
            >
              <div className="flex items-baseline justify-between flex-wrap gap-2 mb-4">
                <h3 className="text-xl font-bold">
                  Worked example — {eligible[0].name}, rank #1
                </h3>
                <div className="text-right">
                  <div className="text-white/60 text-xs uppercase tracking-wide">Composite score</div>
                  <div className="text-3xl font-black text-emerald-300">
                    +{eligible[0].score.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/50 text-xs uppercase tracking-wide">
                      <th className="text-left px-2 py-2">Factor</th>
                      <th className="text-right px-2 py-2">Their value</th>
                      <th className="text-right px-2 py-2">Z-score (vs pool)</th>
                      <th className="text-right px-2 py-2">Weight</th>
                      <th className="text-right px-2 py-2">Contribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FACTORS.map((f) => {
                      const z = eligible[0].z[f.key];
                      const weighted = f.sign === "-" ? z * -f.weight : z * f.weight;
                      const aboveAvg = f.sign === "-" ? z < 0 : z > 0;
                      return (
                        <tr key={f.key} className="border-t border-white/10">
                          <td className="px-2 py-2 font-medium">{f.label}</td>
                          <td className="px-2 py-2 text-right">{factorRawValue(eligible[0], f.key)}</td>
                          <td className={`px-2 py-2 text-right font-semibold ${aboveAvg ? "text-emerald-300" : "text-rose-300"}`}>
                            {z >= 0 ? "+" : ""}
                            {z.toFixed(2)}
                          </td>
                          <td className="px-2 py-2 text-right text-white/70">
                            {f.sign}
                            {Math.round(f.weight * 100)}%
                          </td>
                          <td className={`px-2 py-2 text-right font-bold ${weighted >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                            {weighted >= 0 ? "+" : ""}
                            {weighted.toFixed(3)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-white/30">
                      <td colSpan={4} className="px-2 py-3 text-right text-white/70 uppercase tracking-wide text-xs">
                        Total
                      </td>
                      <td className="px-2 py-3 text-right text-2xl font-black text-emerald-300">
                        +{eligible[0].score.toFixed(3)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="text-sm text-white/70 mt-5 leading-relaxed">
                What this tells you: {eligible[0].name} isn't elite at every factor — what wins #1
                is the combination. Stack a strong margin per show with productive volume, hold
                cancellations down, and the composite carries you past peers who are only great at
                one thing.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                The rules
              </h3>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex gap-3">
                  <span className="text-[#00929C] font-bold mt-0.5">→</span>
                  <span>
                    <span className="font-semibold">Eligibility:</span> {ELIGIBILITY_FLOOR}+ shows
                    worked in {RANKING_YEAR}. All-time show counts are displayed for context only
                    and don't affect ranking.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[#00929C] font-bold mt-0.5">→</span>
                  <span>
                    <span className="font-semibold">Split deals:</span> A deal closed by two reps
                    counts as ½ unit and ½ revenue for each rep.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[#00929C] font-bold mt-0.5">→</span>
                  <span>
                    <span className="font-semibold">OK deals only:</span> Revenue and margin only
                    count "OK" status deals. Low Deposit, Contingent, and Cancelled deals are
                    excluded from those metrics.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[#00929C] font-bold mt-0.5">→</span>
                  <span>
                    <span className="font-semibold">Cancellations:</span> Tracked separately as the
                    cancel-rate penalty. A deal that cancels still hurts you, just through that
                    factor rather than the revenue numbers.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[#00929C] font-bold mt-0.5">→</span>
                  <span>
                    <span className="font-semibold">Weights are tunable.</span> Current defaults:{" "}
                    {Math.round(DEFAULT_WEIGHTS.margin_per_show * 100)}/
                    {Math.round(DEFAULT_WEIGHTS.units_per_show * 100)}/
                    {Math.round(DEFAULT_WEIGHTS.avg_sale_price * 100)}/
                    {Math.round(DEFAULT_WEIGHTS.lift_attach * 100)}/−
                    {Math.round(DEFAULT_WEIGHTS.cancel_rate * 100)}. They can be adjusted as the
                    team's priorities evolve.
                  </span>
                </li>
              </ul>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
