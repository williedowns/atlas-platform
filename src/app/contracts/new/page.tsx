"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useContractStore } from "@/store/contractStore";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import Step1Show from "@/components/contracts/Step1Show";
import Step2Customer from "@/components/contracts/Step2Customer";
import Step3Products from "@/components/contracts/Step3Products";
import Step4Financing from "@/components/contracts/Step4Financing";
import Step5Review from "@/components/contracts/Step4Review";
import Step6Sign from "@/components/contracts/Step5Sign";
import Step7Payment from "@/components/contracts/Step6Payment";

const STEPS = [
  { id: 1, label: "Show" },
  { id: 2, label: "Customer" },
  { id: 3, label: "Products" },
  { id: 4, label: "Financing" },
  { id: 5, label: "Review" },
  { id: 6, label: "Sign" },
  { id: 7, label: "Payment" },
];

// Quote phase = steps 1–5, Contract phase = steps 6–7
const QUOTE_STEPS = new Set([1, 2, 3, 4, 5]);

function NewContractContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromQuoteId = searchParams.get("from");

  const { resetDraft } = useContractStore();
  const [step, setStep] = useState(1);
  const [loadingQuote, setLoadingQuote] = useState(!!fromQuoteId);

  useEffect(() => {
    if (fromQuoteId) {
      loadFromQuote(fromQuoteId);
    } else {
      resetDraft();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadFromQuote(quoteId: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("contracts")
      .select("*, customer:customers(*), show:shows(*), location:locations(*)")
      .eq("id", quoteId)
      .single();

    if (data) {
      useContractStore.setState({
        draft: {
          show_id: data.show_id,
          show: data.show ?? undefined,
          location_id: data.location_id,
          location: data.location ?? undefined,
          customer: data.customer ?? undefined,
          line_items: Array.isArray(data.line_items) ? data.line_items : [],
          discounts: Array.isArray(data.discounts) ? data.discounts : [],
          financing: Array.isArray(data.financing) ? data.financing : [],
          deposit_splits: [],
          tax_amount: data.tax_amount ?? 0,
          tax_rate: data.tax_rate ?? 0,
          tax_exempt: data.tax_exempt ?? false,
          surcharge_enabled: (data.surcharge_rate ?? 0) > 0,
          surcharge_rate: data.surcharge_rate ?? 0.035,
          surcharge_amount: data.surcharge_amount ?? 0,
          subtotal: data.subtotal ?? 0,
          discount_total: data.discount_total ?? 0,
          total: data.total ?? 0,
          deposit_amount: 0,
          notes: data.notes ?? undefined,
        },
      });
      setStep(5); // start at Review so they can add deposit and sign
    }
    setLoadingQuote(false);
  }

  function next() {
    setStep((s) => Math.min(s + 1, STEPS.length));
  }

  function back() {
    if (step === 1) {
      router.push("/dashboard");
    } else {
      setStep((s) => s - 1);
    }
  }

  const isQuotePhase = QUOTE_STEPS.has(step);

  if (loadingQuote) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-10 w-10 text-[#00929C]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-slate-500">Loading quote…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={back}
            className="p-2 rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-bold">
              {isQuotePhase ? "New Quote" : "Complete Contract"}
            </h1>
            <p className="text-[#00929C] text-xs">
              Step {step} of {STEPS.length} · {STEPS[step - 1].label}
              {isQuotePhase
                ? " · Quote"
                : " · Contract"}
            </p>
          </div>
        </div>

        {/* Step indicator — teal for quote steps, amber for contract steps */}
        <div className="flex gap-1 mt-3">
          {STEPS.map((s) => (
            <div
              key={s.id}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s.id < step
                  ? QUOTE_STEPS.has(s.id) ? "bg-[#00929C]" : "bg-amber-400"
                  : s.id === step
                  ? QUOTE_STEPS.has(s.id) ? "bg-[#00929C]" : "bg-amber-400"
                  : "bg-white/20"
              }`}
            />
          ))}
        </div>

        {/* Phase label */}
        <div className="flex gap-1 mt-2">
          <span className="text-xs text-[#00929C]/80">Quote ←</span>
          <span className="flex-1" />
          <span className="text-xs text-amber-400/80">→ Contract</span>
        </div>
      </header>

      {/* Step content */}
      <main className="flex-1 overflow-auto px-5 pt-6 pb-24">
        {step === 1 && <Step1Show onNext={next} />}
        {step === 2 && <Step2Customer onNext={next} />}
        {step === 3 && <Step3Products onNext={next} />}
        {step === 4 && <Step4Financing onNext={next} />}
        {step === 5 && <Step5Review onNext={next} />}
        {step === 6 && <Step6Sign onNext={next} />}
        {step === 7 && <Step7Payment />}
      </main>
    </div>
  );
}

export default function NewContractPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <svg className="animate-spin h-10 w-10 text-[#00929C]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      }
    >
      <NewContractContent />
    </Suspense>
  );
}
