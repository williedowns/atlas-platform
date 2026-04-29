"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useContractStore } from "@/store/contractStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import type { FinancingProvider, FinancingPlan, ContractFinancing } from "@/types";
import { LYON_PROJECT_TYPE_LABELS, buildLyonStages, type LyonProjectType } from "@/lib/lyon-stages";
import RequiredDLUploader from "@/components/contracts/RequiredDLUploader";

interface Step4FinancingProps {
  onNext: () => void;
}

const BLANK_FORM = {
  providerId: "",
  planId: "",
  approvalNumber: "",
  amount: "",
  // Foundation-specific
  foundationTier: "" as "" | "1" | "2" | "3" | "4" | "5",
  foundationApprovedPct: "",
  foundationBuydownRate: "",
  foundationAchRouting: "",
  foundationAchAccount: "",
  foundationAchBank: "",
  foundationAchWaived: false,
  // Primary borrower — defaults to spa contract customer (initialized in useEffect)
  primaryFirstName: "",
  primaryLastName: "",
  primaryEmail: "",
  primaryPhone: "",
  // Secondary / co-buyer (optional)
  secondaryFirstName: "",
  secondaryLastName: "",
  secondaryEmail: "",
  secondaryPhone: "",
  // Lyon Financial
  lyonProjectType: "" as "" | LyonProjectType,
  lyonFundingFlavor: "lyon_direct" as "lyon_direct" | "lightstream_via_customer",
  // In-House Financing (emailed to Robert Kennedy on sign)
  inhouseAchRouting: "",
  inhouseAchAccount: "",
  inhouseAchBank: "",
  inhouseAchHolder: "",
};

function isInHouseProvider(name: string): boolean {
  return name.toLowerCase().includes("in-house") || name.toLowerCase().includes("inhouse") || name.toLowerCase().includes("in house");
}

/** Foundation Finance runs AFTER the show — financed amount carries to balance due */
function isFoundationProvider(name: string): boolean {
  return name.toLowerCase().includes("foundation");
}

/** Lyon Financial — 4-stage funding (deposit + 3 progress draws), funds at sale */
function isLyonProvider(name: string): boolean {
  return name.toLowerCase().includes("lyon");
}

/** GreenSky / Wells Fargo — run at the show, deducted from balance at POS */
function isInstantProvider(name: string): boolean {
  return !isFoundationProvider(name);
}

export default function Step4Financing({ onNext }: Step4FinancingProps) {
  const { draft, addFinancing, removeFinancing, setTaxExempt } = useContractStore();

  const [providers, setProviders] = useState<FinancingProvider[]>([]);
  const [plans, setPlans] = useState<FinancingPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Initialize primary borrower from the spa contract customer so the salesperson
  // sees who's expected to be primary by default (and can edit if different).
  const [form, setForm] = useState(() => ({
    ...BLANK_FORM,
    primaryFirstName: draft.customer?.first_name ?? "",
    primaryLastName: draft.customer?.last_name ?? "",
    primaryEmail: draft.customer?.email ?? "",
    primaryPhone: draft.customer?.phone ?? "",
  }));
  const [showForm, setShowForm] = useState(draft.financing.length === 0);

  // Helper to reset form back to blank but keep primary defaulted to contract customer
  const blankForm = () => ({
    ...BLANK_FORM,
    primaryFirstName: draft.customer?.first_name ?? "",
    primaryLastName: draft.customer?.last_name ?? "",
    primaryEmail: draft.customer?.email ?? "",
    primaryPhone: draft.customer?.phone ?? "",
  });

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

  // Which providers have been added — used to determine if TX exemption toggle is relevant
  const hasInstantFinancing = draft.financing.some(
    (f) => f.deduct_from_balance !== false
  );
  // Show toggle if ANY of: store location, show, or customer state is Texas
  // (Most sales are at shows where draft.location is undefined — bug Willie hit 04-29)
  const isTexasLocation =
    ((draft.location?.state ?? "").toUpperCase() === "TX") ||
    ((draft.show?.state ?? "").toUpperCase() === "TX") ||
    ((draft.customer?.state ?? "").toUpperCase() === "TX");

  function handleAddEntry() {
    if (!selectedProvider || !selectedPlan) return;
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) return;

    const isFoundation = isFoundationProvider(selectedProvider.name);
    const isLyon = isLyonProvider(selectedProvider.name);
    const isInHouse = isInHouseProvider(selectedProvider.name);

    const entry: ContractFinancing = {
      // Robust detection of in-house regardless of provider display name
      // (e.g., "In-House Financing" vs "Salta In-House Financing")
      type: isInHouseProvider(selectedProvider.name) ? "in_house" : "third_party",
      financer_name: selectedProvider.name,
      plan_number: selectedPlan.plan_number,
      plan_description: selectedPlan.description,
      approval_number: form.approvalNumber || undefined,
      financed_amount: amount,
      deduct_from_balance: !isFoundation,
      ...(isFoundation && form.foundationTier ? { foundation_tier: parseInt(form.foundationTier, 10) as 1 | 2 | 3 | 4 | 5 } : {}),
      ...(isFoundation && form.foundationApprovedPct ? { foundation_approved_pct: parseFloat(form.foundationApprovedPct) } : {}),
      ...(isFoundation && form.foundationBuydownRate ? { foundation_buydown_rate: parseFloat(form.foundationBuydownRate) } : {}),
      ...(isFoundation && form.foundationAchWaived
        ? { foundation_ach_waived: true }
        : isFoundation && (form.foundationAchRouting || form.foundationAchAccount || form.foundationAchBank)
          ? {
              foundation_ach_routing: form.foundationAchRouting || undefined,
              foundation_ach_account: form.foundationAchAccount || undefined,
              foundation_ach_bank: form.foundationAchBank || undefined,
            }
          : {}),
      // Primary borrower — only persist if it differs from the spa contract
      // customer (avoids storing duplicate data; consumers fall back to customer).
      ...((() => {
        const cFirst = (draft.customer?.first_name ?? "").trim().toLowerCase();
        const cLast = (draft.customer?.last_name ?? "").trim().toLowerCase();
        const cEmail = (draft.customer?.email ?? "").trim().toLowerCase();
        const cPhone = (draft.customer?.phone ?? "").trim();
        const pFirst = form.primaryFirstName.trim();
        const pLast = form.primaryLastName.trim();
        const pEmail = form.primaryEmail.trim();
        const pPhone = form.primaryPhone.trim();
        const matchesCustomer =
          pFirst.toLowerCase() === cFirst &&
          pLast.toLowerCase() === cLast &&
          pEmail.toLowerCase() === cEmail &&
          pPhone === cPhone;
        if (matchesCustomer) return {};
        return {
          ...(pFirst ? { primary_buyer_first_name: pFirst } : {}),
          ...(pLast ? { primary_buyer_last_name: pLast } : {}),
          ...(pEmail ? { primary_buyer_email: pEmail } : {}),
          ...(pPhone ? { primary_buyer_phone: pPhone } : {}),
        };
      })()),
      // Secondary / co-buyer
      ...(form.secondaryEmail || form.secondaryFirstName || form.secondaryLastName
        ? {
            ...(form.secondaryEmail ? { secondary_buyer_email: form.secondaryEmail.trim() } : {}),
            ...(form.secondaryFirstName ? { secondary_buyer_first_name: form.secondaryFirstName.trim() } : {}),
            ...(form.secondaryLastName ? { secondary_buyer_last_name: form.secondaryLastName.trim() } : {}),
            ...(form.secondaryPhone ? { secondary_buyer_phone: form.secondaryPhone.trim() } : {}),
          }
        : {}),
      ...(isLyon && form.lyonProjectType
        ? {
            lyon_project_type: form.lyonProjectType,
            lyon_funding_flavor: form.lyonFundingFlavor,
            lyon_stages: buildLyonStages(form.lyonProjectType, amount),
          }
        : {}),
      ...(isInHouse && (form.inhouseAchRouting || form.inhouseAchAccount || form.inhouseAchBank || form.inhouseAchHolder)
        ? {
            inhouse_ach_routing: form.inhouseAchRouting || undefined,
            inhouse_ach_account: form.inhouseAchAccount || undefined,
            inhouse_ach_bank: form.inhouseAchBank || undefined,
            inhouse_ach_holder_name: form.inhouseAchHolder || undefined,
          }
        : {}),
    };
    addFinancing(entry);
    setForm(blankForm());
    setShowForm(false);
  }

  const isFoundationSelected = selectedProvider ? isFoundationProvider(selectedProvider.name) : false;
  const isLyonSelected = selectedProvider ? isLyonProvider(selectedProvider.name) : false;
  const isInHouseSelected = selectedProvider ? isInHouseProvider(selectedProvider.name) : false;
  // Foundation requires 2-signer email when secondary first/last are entered (catch the half-filled case)
  const foundationSecondaryIncomplete =
    isFoundationSelected &&
    !!(form.secondaryFirstName || form.secondaryLastName) &&
    !form.secondaryEmail;
  // Lyon requires a project type so we can build the stage template
  const lyonProjectMissing = isLyonSelected && !form.lyonProjectType;
  const canAdd =
    !!form.providerId &&
    !!form.planId &&
    parseFloat(form.amount) > 0 &&
    !foundationSecondaryIncomplete &&
    !lyonProjectMissing;

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
        <p className="text-[10px] uppercase tracking-widest text-[#00929C] font-bold">Step 4 of 8</p>
        <h2 className="text-2xl font-black text-slate-900 mt-1">Financing</h2>
        <p className="text-sm text-slate-500 mt-1">
          Contract total <span className="font-semibold text-slate-900">{formatCurrency(draft.total)}</span>. Add a lender plan or skip if paid in full.
        </p>
      </div>

      {/* Added financing entries */}
      {draft.financing.length > 0 && (
        <div className="space-y-3">
          {draft.financing.map((entry, i) => {
            const isFoundation = entry.deduct_from_balance === false;
            return (
              <Card key={i} className={`${isFoundation ? "border-amber-200 bg-amber-50/60" : "border-[#00929C]/30 bg-[#00929C]/5"}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900">{entry.financer_name}</p>
                        {isFoundation ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            Carries to balance
                          </span>
                        ) : (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#00929C]/10 text-[#00929C]">
                            Deducted at POS
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Plan {entry.plan_number} — {entry.plan_description}
                      </p>
                      {entry.approval_number && (
                        <p className="text-xs text-slate-400 mt-0.5">Approval: {entry.approval_number}</p>
                      )}
                      {entry.foundation_tier && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          Tier {entry.foundation_tier}
                          {entry.foundation_approved_pct ? ` · approved ${entry.foundation_approved_pct}%` : ""}
                          {entry.foundation_buydown_rate ? ` · buy-down ${entry.foundation_buydown_rate}%` : ""}
                        </p>
                      )}
                      {entry.foundation_ach_waived && (
                        <p className="text-xs font-semibold text-red-700 mt-0.5">ACH waived</p>
                      )}
                      {entry.foundation_ach_routing && entry.foundation_ach_account && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          ACH on file · acct ····{entry.foundation_ach_account.slice(-4)}
                        </p>
                      )}
                      {entry.wf_charge_mode === "authorize_future" && (
                        <p className="text-xs font-semibold text-amber-700 mt-0.5">
                          Authorize-future · charge {entry.wf_future_charge_date ?? "TBD"}
                        </p>
                      )}
                      {(entry.primary_buyer_first_name || entry.primary_buyer_last_name || entry.primary_buyer_email) && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          Primary: {[entry.primary_buyer_first_name, entry.primary_buyer_last_name].filter(Boolean).join(" ") || "—"}
                          {entry.primary_buyer_email ? ` (${entry.primary_buyer_email})` : ""}
                        </p>
                      )}
                      {(entry.secondary_buyer_first_name || entry.secondary_buyer_last_name || entry.secondary_buyer_email) && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          Co-borrower: {[entry.secondary_buyer_first_name, entry.secondary_buyer_last_name].filter(Boolean).join(" ") || "—"}
                          {entry.secondary_buyer_email ? ` (${entry.secondary_buyer_email})` : ""}
                        </p>
                      )}
                      {entry.lyon_project_type && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {LYON_PROJECT_TYPE_LABELS[entry.lyon_project_type]}
                          {entry.lyon_funding_flavor === "lightstream_via_customer" ? " · LightStream/customer" : " · Lyon-direct"}
                        </p>
                      )}
                      {entry.lyon_stages && entry.lyon_stages.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-xs">
                          {entry.lyon_stages.map((s) => (
                            <li key={s.stage_num} className="flex justify-between">
                              <span className="text-slate-600">
                                {s.stage_num}. {s.label}
                              </span>
                              <span className="text-slate-700 font-medium">
                                {formatCurrency(s.expected_amount)}
                              </span>
                            </li>
                          ))}
                        </ul>
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
            );
          })}

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

      {/* Texas Tax Exemption toggle — shown for any Texas location */}
      {isTexasLocation && (
        <Card className={`border-2 transition-all ${draft.tax_exempt ? "border-emerald-400 bg-emerald-50" : "border-slate-200"}`}>
          <CardContent className="p-4">
            <button
              type="button"
              onClick={() => setTaxExempt(!draft.tax_exempt)}
              className="flex items-center gap-4 w-full text-left touch-manipulation"
            >
              <div className={`w-12 h-7 rounded-full flex items-center px-1 transition-all flex-shrink-0 ${
                draft.tax_exempt ? "bg-emerald-500 justify-end" : "bg-slate-200 justify-start"
              }`}>
                <div className="w-5 h-5 rounded-full bg-white shadow-sm" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">Texas Tax Exemption Certificate</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {draft.tax_exempt
                    ? "Tax exempt — certificate on file. Tax zeroed out."
                    : "Customer has a Texas tax exemption certificate on file"}
                </p>
              </div>
            </button>
          </CardContent>
        </Card>
      )}

      {/* Foundation + Texas info banner */}
      {draft.financing.some((f) => f.deduct_from_balance === false) && isTexasLocation && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex gap-3">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm">
              <p className="font-semibold text-amber-800">Foundation Finance — Tax Carries to Balance</p>
              <p className="text-amber-700 mt-0.5">
                For Texas Foundation Finance customers, sales tax is not collected at point of sale. Tax carries to the balance due.
              </p>
            </div>
          </CardContent>
        </Card>
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
                {providers.map((p) => {
                  const isFoundation = isFoundationProvider(p.name);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setForm({ ...form, providerId: p.id, planId: "" })}
                      className={`px-3 py-3 rounded-xl border-2 text-sm font-semibold transition-all touch-manipulation ${
                        form.providerId === p.id
                          ? isFoundation
                            ? "border-amber-400 bg-amber-50 text-amber-700"
                            : "border-[#00929C] bg-[#00929C]/8 text-[#00929C]"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {p.name}
                      {isFoundation && (
                        <span className="block text-xs font-normal text-amber-600 mt-0.5">Run after sale</span>
                      )}
                    </button>
                  );
                })}
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

            {/* ── Borrowers (Primary + Secondary) — universal for all financing ─ */}
            {form.planId && (
              <div className="space-y-3 rounded-xl border-2 border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-700">
                    Borrowers on the Loan
                  </p>
                  <button
                    type="button"
                    className="text-[10px] font-semibold text-[#00929C] hover:underline"
                    onClick={() => {
                      // Swap primary ↔ secondary — useful when the spa contract customer
                      // is actually the secondary borrower (e.g., spouse signs the contract,
                      // financing is in the other spouse's name).
                      setForm({
                        ...form,
                        primaryFirstName: form.secondaryFirstName,
                        primaryLastName: form.secondaryLastName,
                        primaryEmail: form.secondaryEmail,
                        primaryPhone: form.secondaryPhone,
                        secondaryFirstName: form.primaryFirstName,
                        secondaryLastName: form.primaryLastName,
                        secondaryEmail: form.primaryEmail,
                        secondaryPhone: form.primaryPhone,
                      });
                    }}
                  >
                    Swap Primary ↔ Secondary
                  </button>
                </div>
                {isInHouseSelected && (
                  <p className="text-[11px] text-slate-500 italic">
                    Robert collects formal signatures via DocuSign for in-house — these are
                    pre-fills for that packet.
                  </p>
                )}

                {/* Primary borrower */}
                <div className="rounded-lg border border-[#00929C]/30 bg-white p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#00929C]">
                      Primary Borrower
                    </p>
                    <button
                      type="button"
                      className="text-[10px] font-semibold text-slate-500 hover:text-[#00929C]"
                      onClick={() => setForm({
                        ...form,
                        primaryFirstName: draft.customer?.first_name ?? "",
                        primaryLastName: draft.customer?.last_name ?? "",
                        primaryEmail: draft.customer?.email ?? "",
                        primaryPhone: draft.customer?.phone ?? "",
                      })}
                    >
                      Use spa customer
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="First Name"
                      type="text"
                      value={form.primaryFirstName}
                      onChange={(e) => setForm({ ...form, primaryFirstName: e.target.value })}
                    />
                    <Input
                      label="Last Name"
                      type="text"
                      value={form.primaryLastName}
                      onChange={(e) => setForm({ ...form, primaryLastName: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="Email"
                      type="email"
                      value={form.primaryEmail}
                      onChange={(e) => setForm({ ...form, primaryEmail: e.target.value })}
                    />
                    <Input
                      label="Phone"
                      type="tel"
                      value={form.primaryPhone}
                      onChange={(e) => setForm({ ...form, primaryPhone: e.target.value })}
                    />
                  </div>
                </div>

                {/* Secondary / co-buyer */}
                <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
                      Secondary Borrower (optional)
                    </p>
                    <button
                      type="button"
                      className="text-[10px] font-semibold text-slate-500 hover:text-[#00929C]"
                      onClick={() => setForm({
                        ...form,
                        secondaryFirstName: draft.customer?.first_name ?? "",
                        secondaryLastName: draft.customer?.last_name ?? "",
                        secondaryEmail: draft.customer?.email ?? "",
                        secondaryPhone: draft.customer?.phone ?? "",
                      })}
                    >
                      Use spa customer
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="First Name"
                      type="text"
                      value={form.secondaryFirstName}
                      onChange={(e) => setForm({ ...form, secondaryFirstName: e.target.value })}
                      placeholder="Co-borrower first name"
                    />
                    <Input
                      label="Last Name"
                      type="text"
                      value={form.secondaryLastName}
                      onChange={(e) => setForm({ ...form, secondaryLastName: e.target.value })}
                      placeholder="Co-borrower last name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label={isFoundationSelected ? "Email (required for Foundation)" : "Email"}
                      type="email"
                      value={form.secondaryEmail}
                      onChange={(e) => setForm({ ...form, secondaryEmail: e.target.value })}
                      placeholder={isFoundationSelected ? "Foundation needs unique email per signer" : "Co-borrower email"}
                    />
                    <Input
                      label="Phone"
                      type="tel"
                      value={form.secondaryPhone}
                      onChange={(e) => setForm({ ...form, secondaryPhone: e.target.value })}
                    />
                  </div>
                  {foundationSecondaryIncomplete && (
                    <p className="text-xs font-semibold text-red-700">
                      Co-borrower email required for Foundation when co-borrower name is entered.
                    </p>
                  )}
                </div>

                {/* DLs — required for both borrowers when applicable */}
                {draft.customer?.id ? (
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-700">
                      Driver's Licenses (required to sign)
                    </p>
                    <RequiredDLUploader
                      customerId={draft.customer.id}
                      category="drivers_license"
                      label="Primary Borrower DL"
                      borrowerName={[form.primaryFirstName, form.primaryLastName].filter(Boolean).join(" ") || undefined}
                    />
                    {(form.secondaryFirstName || form.secondaryLastName || form.secondaryEmail) && (
                      <RequiredDLUploader
                        customerId={draft.customer.id}
                        category="drivers_license_secondary"
                        label="Co-Borrower DL"
                        borrowerName={[form.secondaryFirstName, form.secondaryLastName].filter(Boolean).join(" ") || undefined}
                      />
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                    Save the customer at Step 2 first — then upload borrower DLs here.
                  </p>
                )}
              </div>
            )}

            {/* ── Foundation Finance specifics ─────────────────────────────── */}
            {isFoundationSelected && form.planId && (
              <div className="space-y-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
                  Foundation Finance — Manual Entry
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Tier</label>
                    <select
                      value={form.foundationTier}
                      onChange={(e) => setForm({ ...form, foundationTier: e.target.value as typeof form.foundationTier })}
                      className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base focus:outline-none focus:ring-2 focus:ring-amber-400 touch-manipulation"
                    >
                      <option value="">Select…</option>
                      <option value="1">Tier 1 (11.9%)</option>
                      <option value="2">Tier 2 (13.5%)</option>
                      <option value="3">Tier 3 (15.99%)</option>
                      <option value="4">Tier 4 (17.99%)</option>
                      <option value="5">Tier 5 (8-yr max, $30K cap)</option>
                    </select>
                  </div>
                  <Input
                    label="Approved %"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="92, 95, 100"
                    value={form.foundationApprovedPct}
                    onChange={(e) => setForm({ ...form, foundationApprovedPct: e.target.value })}
                  />
                </div>
                <Input
                  label="Buy-down Rate % (optional)"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 15.99 if bought down from 17.99"
                  value={form.foundationBuydownRate}
                  onChange={(e) => setForm({ ...form, foundationBuydownRate: e.target.value })}
                />

                {/* ACH waive toggle */}
                <button
                  type="button"
                  onClick={() => setForm({ ...form, foundationAchWaived: !form.foundationAchWaived })}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border-2 text-left transition-all touch-manipulation ${
                    form.foundationAchWaived ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className={`w-10 h-6 rounded-full flex items-center px-1 transition-all flex-shrink-0 ${
                    form.foundationAchWaived ? "bg-red-500 justify-end" : "bg-slate-200 justify-start"
                  }`}>
                    <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">Waive ACH</p>
                    <p className="text-xs text-slate-500">
                      {form.foundationAchWaived
                        ? "Salesperson absorbs up to $250 from commission"
                        : "Collect ACH routing & account below"}
                    </p>
                  </div>
                </button>

                {!form.foundationAchWaived && (
                  <div className="space-y-2">
                    <Input
                      label="ACH Routing Number"
                      type="text"
                      inputMode="numeric"
                      value={form.foundationAchRouting}
                      onChange={(e) => setForm({ ...form, foundationAchRouting: e.target.value.replace(/\D/g, "").slice(0, 9) })}
                      placeholder="9 digits"
                    />
                    <Input
                      label="ACH Account Number"
                      type="text"
                      inputMode="numeric"
                      value={form.foundationAchAccount}
                      onChange={(e) => setForm({ ...form, foundationAchAccount: e.target.value.replace(/\D/g, "") })}
                      placeholder="Account number"
                    />
                    <Input
                      label="Bank Name"
                      type="text"
                      value={form.foundationAchBank}
                      onChange={(e) => setForm({ ...form, foundationAchBank: e.target.value })}
                      placeholder="Bank name"
                    />
                  </div>
                )}

                {/* Foundation co-buyer is now part of the universal Borrowers block below */}
              </div>
            )}

            {/* Wells Fargo uses the same portal-ACH model as GreenSky — no charge mode picker. */}

            {/* ── Lyon Financial 4-stage setup ─────────────────────────────── */}
            {isLyonSelected && form.planId && (
              <div className="space-y-3 rounded-xl border-2 border-[#00929C]/30 bg-[#00929C]/5 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[#00929C]">
                  Lyon Financial — Project Setup
                </p>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Project Type</label>
                  <select
                    value={form.lyonProjectType}
                    onChange={(e) => setForm({ ...form, lyonProjectType: e.target.value as typeof form.lyonProjectType })}
                    className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base focus:outline-none focus:ring-2 focus:ring-[#00929C] touch-manipulation"
                  >
                    <option value="">Select project type…</option>
                    {Object.entries(LYON_PROJECT_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Funding Flavor</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, lyonFundingFlavor: "lyon_direct" })}
                      className={`px-3 py-2 rounded-lg border-2 text-xs font-semibold transition-all touch-manipulation ${
                        form.lyonFundingFlavor === "lyon_direct"
                          ? "border-[#00929C] bg-[#00929C]/10 text-[#00929C]"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      Lyon-direct (~95%)
                      <span className="block text-[10px] font-normal mt-0.5">ACH/wire to Atlas per stage</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, lyonFundingFlavor: "lightstream_via_customer" })}
                      className={`px-3 py-2 rounded-lg border-2 text-xs font-semibold transition-all touch-manipulation ${
                        form.lyonFundingFlavor === "lightstream_via_customer"
                          ? "border-amber-400 bg-amber-50 text-amber-700"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      LightStream / customer
                      <span className="block text-[10px] font-normal mt-0.5">Customer pays Atlas</span>
                    </button>
                  </div>
                </div>

                {/* Stage preview */}
                {form.lyonProjectType && parseFloat(form.amount) > 0 && (
                  <div className="rounded-lg bg-white border border-[#00929C]/20 p-2">
                    <p className="text-xs font-semibold text-slate-600 mb-1">
                      Draw schedule (preview):
                    </p>
                    <ul className="space-y-1">
                      {buildLyonStages(form.lyonProjectType, parseFloat(form.amount)).map((s) => (
                        <li key={s.stage_num} className="flex justify-between text-xs">
                          <span className="text-slate-700">
                            {s.stage_num}. {s.label} ({s.percent}%)
                          </span>
                          <span className="font-semibold text-[#00929C]">
                            {formatCurrency(s.expected_amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {lyonProjectMissing && (
                  <p className="text-xs font-semibold text-red-700">
                    Project type required so we can generate the Lyon draw schedule.
                  </p>
                )}
              </div>
            )}

            {/* ── In-House Financing ──────────────────────────────────────── */}
            {isInHouseSelected && form.planId && (
              <div className="space-y-3 rounded-xl border-2 border-[#00929C]/30 bg-[#00929C]/5 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[#00929C]">
                  In-House Financing — ACH for Atlas Withdrawals
                </p>
                <p className="text-xs text-slate-600">
                  Atlas will withdraw installments from this account. On sign, an
                  application packet emails to Robert Kennedy with all customer info,
                  product details, financed amount, ACH info, and the customer's
                  driver's license.
                </p>
                <Input
                  label="Account Holder Name"
                  type="text"
                  value={form.inhouseAchHolder}
                  onChange={(e) => setForm({ ...form, inhouseAchHolder: e.target.value })}
                  placeholder="As printed on the check"
                />
                <Input
                  label="Routing Number"
                  type="text"
                  inputMode="numeric"
                  value={form.inhouseAchRouting}
                  onChange={(e) => setForm({ ...form, inhouseAchRouting: e.target.value.replace(/\D/g, "").slice(0, 9) })}
                  placeholder="9 digits"
                />
                <Input
                  label="Account Number"
                  type="text"
                  inputMode="numeric"
                  value={form.inhouseAchAccount}
                  onChange={(e) => setForm({ ...form, inhouseAchAccount: e.target.value.replace(/\D/g, "") })}
                  placeholder="Account number"
                />
                <Input
                  label="Bank Name"
                  type="text"
                  value={form.inhouseAchBank}
                  onChange={(e) => setForm({ ...form, inhouseAchBank: e.target.value })}
                  placeholder="Bank name"
                />
                <p className="text-[11px] text-slate-500 italic">
                  Driver's licenses for both borrowers are uploaded in the Borrowers section above.
                </p>
              </div>
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
                  onClick={() => { setForm(blankForm()); setShowForm(false); }}
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
          onClick={() => { setForm(blankForm()); setShowForm(true); }}
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
