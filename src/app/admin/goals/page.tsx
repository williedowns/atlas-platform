"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Rep = { id: string; full_name: string; role: string };
type Goal = {
  id: string;
  rep_id: string;
  period_start: string;
  target_revenue: number;
  target_contracts: number;
};

function getMonthStart(offset = 0): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return d.toISOString().slice(0, 10);
}

function formatMonthLabel(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function GoalsPage() {
  const supabase = createClient();

  const [reps, setReps] = useState<Rep[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, { revenue: string; contracts: string }>>({});
  const [selectedMonth, setSelectedMonth] = useState(getMonthStart(0));

  useEffect(() => {
    // Load all sales reps
    supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("role", ["sales_rep", "manager", "admin"])
      .order("full_name")
      .then(({ data }) => setReps(data ?? []));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    supabase
      .from("sales_goals")
      .select("*")
      .eq("period_start", selectedMonth)
      .then(({ data }) => {
        const g = data ?? [];
        setGoals(g);
        // Seed edit values from existing goals
        const init: Record<string, { revenue: string; contracts: string }> = {};
        for (const goal of g) {
          init[goal.rep_id] = {
            revenue: String(goal.target_revenue),
            contracts: String(goal.target_contracts),
          };
        }
        setEditValues(init);
      });
  }, [selectedMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  function getEditVal(repId: string) {
    return editValues[repId] ?? { revenue: "", contracts: "" };
  }

  function setEditVal(repId: string, field: "revenue" | "contracts", val: string) {
    setEditValues((prev) => ({
      ...prev,
      [repId]: { ...getEditVal(repId), [field]: val },
    }));
  }

  async function saveGoal(rep: Rep) {
    const vals = getEditVal(rep.id);
    const revenue = parseFloat(vals.revenue) || 0;
    const contracts = parseInt(vals.contracts) || 0;
    setSaving(rep.id);

    const existing = goals.find((g) => g.rep_id === rep.id);

    if (existing) {
      await supabase
        .from("sales_goals")
        .update({ target_revenue: revenue, target_contracts: contracts, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("sales_goals")
        .insert({ rep_id: rep.id, period_start: selectedMonth, target_revenue: revenue, target_contracts: contracts });
    }

    // Refresh
    const { data } = await supabase.from("sales_goals").select("*").eq("period_start", selectedMonth);
    setGoals(data ?? []);
    setSaving(null);
  }

  const months = [getMonthStart(-1), getMonthStart(0), getMonthStart(1)];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="p-2 rounded-lg hover:bg-white/10">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold">Sales Goals</h1>
            <p className="text-white/60 text-xs">Set monthly revenue & contract targets per rep</p>
          </div>
        </div>
      </header>

      <main className="px-5 py-6 max-w-2xl mx-auto pb-24 space-y-4">
        {/* Month selector */}
        <div className="flex gap-2">
          {months.map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMonth(m)}
              className={`flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-all border ${
                selectedMonth === m
                  ? "bg-[#010F21] text-white border-[#010F21]"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              }`}
            >
              {formatMonthLabel(m)}
            </button>
          ))}
        </div>

        {/* Rep goal cards */}
        {reps.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-slate-400 text-sm">
              No reps found.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {reps.map((rep) => {
              const existing = goals.find((g) => g.rep_id === rep.id);
              const vals = getEditVal(rep.id);
              const hasGoal = !!existing || (vals.revenue !== "" && vals.revenue !== "0");

              return (
                <Card key={rep.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold text-slate-900">{rep.full_name}</p>
                        <p className="text-xs text-slate-400 capitalize">{rep.role.replace("_", " ")}</p>
                      </div>
                      {hasGoal && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                          Goal Set
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="text-xs font-medium text-slate-500 block mb-1">Revenue Target ($)</label>
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={vals.revenue}
                          onChange={(e) => setEditVal(rep.id, "revenue", e.target.value)}
                          placeholder="e.g. 50000"
                          className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00929C] focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-500 block mb-1">Contract Target</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={vals.contracts}
                          onChange={(e) => setEditVal(rep.id, "contracts", e.target.value)}
                          placeholder="e.g. 10"
                          className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00929C] focus:border-transparent"
                        />
                      </div>
                    </div>

                    <Button
                      size="sm"
                      className="w-full"
                      loading={saving === rep.id}
                      onClick={() => saveGoal(rep)}
                    >
                      {existing ? "Update Goal" : "Set Goal"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
