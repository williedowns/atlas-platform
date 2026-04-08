"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Rep = { id: string; full_name: string; role: string };
type CommissionRate = { id: string; rep_id: string; rate_pct: number };

export default function CommissionPage() {
  const supabase = createClient();

  const [reps, setReps] = useState<Rep[]>([]);
  const [rates, setRates] = useState<CommissionRate[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("role", ["sales_rep", "manager", "admin"])
      .order("full_name")
      .then(({ data }) => setReps(data ?? []));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    supabase
      .from("commission_rates")
      .select("*")
      .then(({ data }) => {
        const r = data ?? [];
        setRates(r);
        const init: Record<string, string> = {};
        for (const row of r) {
          init[row.rep_id] = String(row.rate_pct);
        }
        setEditValues(init);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveRate(rep: Rep) {
    const val = editValues[rep.id] ?? "";
    const pct = parseFloat(val) || 0;
    setSaving(rep.id);

    const existing = rates.find((r) => r.rep_id === rep.id);

    if (existing) {
      await supabase
        .from("commission_rates")
        .update({ rate_pct: pct })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("commission_rates")
        .insert({ rep_id: rep.id, rate_pct: pct });
    }

    const { data } = await supabase.from("commission_rates").select("*");
    setRates(data ?? []);
    setSaving(null);
  }

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
            <h1 className="text-lg font-bold">Commission Rates</h1>
            <p className="text-white/60 text-xs">Set commission % per rep — shown on analytics leaderboard</p>
          </div>
        </div>
      </header>

      <main className="px-5 py-6 max-w-2xl mx-auto pb-24 space-y-3">
        {reps.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-slate-400 text-sm">
              No reps found.
            </CardContent>
          </Card>
        ) : (
          reps.map((rep) => {
            const existing = rates.find((r) => r.rep_id === rep.id);
            const val = editValues[rep.id] ?? "";
            const hasRate = !!existing && existing.rate_pct > 0;

            return (
              <Card key={rep.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-slate-900">{rep.full_name}</p>
                      <p className="text-xs text-slate-400 capitalize">{rep.role.replace("_", " ")}</p>
                    </div>
                    {hasRate && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                        {existing?.rate_pct}% set
                      </span>
                    )}
                  </div>

                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-slate-500 block mb-1">Commission Rate (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={val}
                        onChange={(e) =>
                          setEditValues((prev) => ({ ...prev, [rep.id]: e.target.value }))
                        }
                        placeholder="e.g. 5"
                        className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C] focus:border-transparent"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={saving === rep.id}
                      onClick={() => saveRate(rep)}
                      className="h-10 px-4"
                    >
                      {saving === rep.id ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </main>
    </div>
  );
}
