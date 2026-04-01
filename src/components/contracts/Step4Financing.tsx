"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useContractStore } from "@/store/contractStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import type { FinancingProvider, FinancingPlan, ContractFinancing } from "@/types";

interface Step4FinancingProps {
  onNext: () => void;
}

const BLANK_FORM = {
  providerId: "",
  planId: "",
  approvalNumber: "",
  amount: "",
};

export default function Step4Financing({ onNext }: Step4FinancingProps) {
  const { draft, addFinancing, removeFinancing } = useContractStore();

  const [providers, setProviders] = useState<FinancingProvider[]>([]);
  const [plans, setPlans] = useState<FinancingPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState(BLANK_FORM);
  const [showForm, setShowForm] = useState(draft.financing.length === 0);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [provRes, planRes] = await Promise.all([
        supabase.from("financing_providers").select("*").eq("active", true).order("name"),
        supabase
          .from("financing_plans")
          .select("*, financing_providers(name)")
          .eq("active", true)
          .order("plan_number"),
      ]);
      if (provRes.data) setProviders(provRes.data as FinancingProvider[]);
      if (planRes.data) {
        setPlans(
          planRes.data.map((p: any) => ({ ...p, provider_name: p.financing_providers?.name })) as FinancingPlan[]
        );
      }
      setLoading(false);
    }
    load();
  }, []);

  const providerPlans = plans.filter((p) => p.provider_id === form.providerId);
  const selectedProvider = providers.find((p) => p.id === form.providerId);
  const selectedPlan = plans.find((p) => p.id === form.planId);

  const totalFinanced = draft.financing.reduce((sum, f) => sum + f.financed_amount, 0);
  const remaining = Math.max(0, draft.total - totalFinanced);

  function handleAddEntry() {
    if (!selectedProvider || !selectedPlan) return;
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) return;

    const entry: ContractFinancing = {
      type: selectedProvider.name === "In-House Financing" ? "in_house" : "third_party",
      financer_name: selectedProvider.name,
      plan_number: selectedPlan.plan_number,
      plan_description: selectedPlan.description,
      approval_number: form.approvalNumber || undefined,
      financed_amount: amount,
    };
    addFinancing(entry);
    setForm(BLANK_FORM);
    setShowForm(false);
  }

  const canAdd =
    !!form.providerId && !!form.planId && parseFloat(form.amount) > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="animate-spin h-10 w-10 text-[#00929C]" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#00929C]">Financing</h2>
        <p className="text-base text-slate-500 mt-1">
          Contract total: <span className="font-semibold text-slate-700">{formatCurrency(draft.total)}</span>
        </p>
      </div>

      {/* Added financing entries */}
      {draft.financing.length > 0 && (
        <div className="space-y-3">
          {draft.financing.map((entry, i) => (
            <Card key={i} className="border-[#00929C]/30 bg-[#00929C]/5">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">{entry.financer_name}</p>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Plan {entry.plan_number} — {entry.plan_description}
                    </p>
                    {entry.approval_number && (
                      <p className="text-xs text-slate-400 mt-0.5">Approval: {entry.approval_number}</p>
                    )}
                    <p className="text-base font-bold text-[#00929C] mt-1">
                      {formatCurrency(entry.financed_amount)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFinancing(i)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 flex-shrink-0"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Running totals */}
          <div className="flex justify-between text-sm px-1">
            <span className="text-slate-500">Total financed</span>
            <span className="font-semibold text-slate-700">{formatCurrency(totalFinanced)}</span>
          </div>
          <div className="flex justify-between text-sm px-1">
            <span className="text-slate-500">Remaining to collect</span>
            <span className="font-semibold text-[#00929C]">{formatCurrency(remaining)}</span>
          </div>
        </div>
      )}

      {/* Add financing form */}
      {showForm ? (
        <Card className="border-slate-200">
          <CardContent className="p-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
              {draft.financing.length === 0 ? "Add Financing" : "Add Another Provider"}
            </h3>

            {/* Provider */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Provider</p>
              <div className="grid grid-cols-2 gap-2">
                {providers.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setForm({ ...form, providerId: p.id, planId: "" })}
                    className={`px-3 py-3 rounded-xl border-2 text-sm font-semibold transition-all touch-manipulation ${
                      form.providerId === p.id
                        ? "border-[#00929C] bg-[#00929C]/8 text-[#00929C]"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Plan */}
            {form.providerId && providerPlans.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Plan — {selectedProvider?.name}
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {providerPlans.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          planId: plan.id,
                          amount: form.amount || remaining.toFixed(2),
                        })
                      }
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all touch-manipulation ${
                        form.planId === plan.id
                          ? "border-[#00929C] bg-[#00929C]/8"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <p className={`text-xs font-bold uppercase tracking-wide mb-0.5 ${form.planId === plan.id ? "text-[#00929C]" : "text-slate-400"}`}>
                        Plan {plan.plan_number}
                      </p>
                      <p className={`text-sm font-medium leading-snug ${form.planId === plan.id ? "text-[#00929C]" : "text-slate-800"}`}>
                        {plan.description}
                      </p>
                      {plan.term_months && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {plan.term_months} months
                          {plan.dealer_fee_rate ? ` · ${(plan.dealer_fee_rate * 100).toFixed(0)}% dealer fee` : ""}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Amount + approval */}
            {form.planId && (
              <>
                <Input
                  label="Amount Financed ($)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
                <Input
                  label="Approval Number (optional)"
                  type="text"
                  placeholder="Enter approval #"
                  value={form.approvalNumber}
                  onChange={(e) => setForm({ ...form, approvalNumber: e.target.value })}
                />
              </>
            )}

            <div className="flex gap-3 pt-1">
              <Button
                variant="accent"
                size="lg"
                className="flex-1"
                disabled={!canAdd}
                onClick={handleAddEntry}
              >
                Add
              </Button>
              {draft.financing.length > 0 && (
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => { setForm(BLANK_FORM); setShowForm(false); }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <button
          type="button"
          onClick={() => { setForm(BLANK_FORM); setShowForm(true); }}
          className="w-full flex items-center justify-center gap-2 px-5 py-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-[#00929C] hover:text-[#00929C] transition-colors touch-manipulation font-semibold"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add {draft.financing.length > 0 ? "Another Provider" : "Financing"}
        </button>
      )}

      <Button
        variant="accent"
        size="xl"
        className="w-full text-lg"
        onClick={onNext}
      >
        Continue to Review
        <svg className="w-5 h-5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </Button>
    </div>
  );
}
