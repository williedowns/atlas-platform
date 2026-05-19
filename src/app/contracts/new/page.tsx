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
import Step5Review from "@/components/contracts/Step5Review";
import Step6Delivery from "@/components/contracts/Step6Delivery";
import Step7Sign from "@/components/contracts/Step7Sign";
import Step8Payment from "@/components/contracts/Step8Payment";

const STEPS = [
  { id: 1, label: "Pick Show" },
  { id: 2, label: "Customer" },
  { id: 3, label: "Products" },
  { id: 4, label: "Financing" },
  { id: 5, label: "Review & Quote" },
  { id: 6, label: "Delivery" },
  { id: 7, label: "Signature" },
  { id: 8, label: "Deposit" },
];

// Quote phase = steps 1–6, Contract phase = steps 7–8
const QUOTE_STEPS = new Set([1, 2, 3, 4, 5, 6]);

function NewContractContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromQuoteId = searchParams.get("from");
  // Show-prefill: when the rep enters the wizard from /shows/[id]/page.tsx
  // ("+ Start New Contract"), the show is known. Skip the Pick Show step.
  const prefillShowId = searchParams.get("show");
  // Concrete addon-prefill: rep tapped "Create Concrete Contract" on a
  // parent contract's detail page. We load the parent and pre-fill customer
  // + a Concrete Pad line item, then jump straight to Step 3 (Products) so
  // the rep can enter qty + on-site price.
  const fromContractId = searchParams.get("from_contract");
  const addonType = searchParams.get("type");
  const isConcreteAddon = addonType === "concrete-addon" && !!fromContractId;

  const { resetDraft, setWizardStep, setShow, prefillForConcreteAddon } = useContractStore();
  const persistedStep = useContractStore((s) => s.draft.wizard_step);
  const customerOnDraft = useContractStore((s) => s.draft.customer);
  const lineItemsOnDraft = useContractStore((s) => s.draft.line_items);
  const parentContractIdOnDraft = useContractStore((s) => s.draft.parent_contract_id);
  const hasDraftProgress = useContractStore((s) => s.hasDraftProgress);
  const [step, setStep] = useState(1);
  const [loadingQuote, setLoadingQuote] = useState(!!fromQuoteId);
  const [loadingShowPrefill, setLoadingShowPrefill] = useState(
    !fromQuoteId && !!prefillShowId
  );
  const [loadingConcreteAddon, setLoadingConcreteAddon] = useState(
    !fromQuoteId && !prefillShowId && isConcreteAddon
  );
  // Resume prompt: shown on mount when there's persisted in-progress work AND
  // we're not loading from a saved quote. Replaces the previous behavior of
  // unconditionally wiping the draft, which destroyed any work that survived
  // a page reload (iPad sleep mid-show, accidental tab close, app
  // backgrounded long enough for iOS to evict the PWA WebView).
  const [showResumePrompt, setShowResumePrompt] = useState(false);

  useEffect(() => {
    if (fromQuoteId) {
      loadFromQuote(fromQuoteId);
      return;
    }
    // Concrete addon re-entry: if the persisted draft already points at this
    // parent, skip the fetch + prefill (and skip the resume prompt) — the rep
    // is just navigating back into the wizard mid-flow.
    if (isConcreteAddon && parentContractIdOnDraft === fromContractId) {
      return;
    }
    if (hasDraftProgress()) {
      // Don't touch persisted state — let the rep choose Resume or Start Over.
      // If a ?show= or ?from_contract= prefill was requested, defer the
      // prefill until the rep chooses Start Over below.
      setShowResumePrompt(true);
      return;
    }
    if (isConcreteAddon) {
      loadConcreteAddon(fromContractId);
      return;
    }
    if (prefillShowId) {
      loadShowPrefill(prefillShowId);
      return;
    }
    // No progress, no quote, no prefill → default empty state is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadShowPrefill(showId: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("shows")
      .select("*, location:locations(*)")
      .eq("id", showId)
      .single();
    if (data) {
      type ShowWithLocation = Parameters<typeof setShow>[0] & {
        location?: Parameters<typeof setShow>[1];
      };
      const show = data as unknown as ShowWithLocation;
      const location = (show.location as Parameters<typeof setShow>[1]) ?? null;
      setShow(show, location);
      setStep(2); // Customer step — show is pre-filled
    }
    setLoadingShowPrefill(false);
  }

  async function loadConcreteAddon(parentId: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("contracts")
      .select("*, customer:customers(*), show:shows(*), location:locations(*)")
      .eq("id", parentId)
      .single();
    if (data) {
      // Parent row has the same shape the Contract type expects (customer +
      // show + location joined). Cast to Contract for the store action.
      prefillForConcreteAddon(data as Parameters<typeof prefillForConcreteAddon>[0]);
      // Jump to Step 3 (Products) — customer + show are pre-filled and the
      // Concrete Pad line is already added; rep just edits qty + price.
      setStep(3);
    }
    setLoadingConcreteAddon(false);
  }

  // Persist the wizard step so a reload returns to the same step.
  useEffect(() => {
    setWizardStep(step);
  }, [step, setWizardStep]);

  function handleResume() {
    // Snap to the last step the rep was on. Customer with no line items is
    // still mid-step-2 — clamp to a sane value if persistedStep is missing.
    const target = persistedStep && persistedStep >= 1 && persistedStep <= 8
      ? persistedStep
      : (lineItemsOnDraft && lineItemsOnDraft.length > 0 ? 3 : (customerOnDraft ? 3 : 2));
    setStep(target);
    setShowResumePrompt(false);
  }

  function handleStartOver() {
    resetDraft();
    setShowResumePrompt(false);
    // If the rep arrived via ?from_contract=<id>&type=concrete-addon, honor
    // the addon prefill — they explicitly chose to start the concrete flow,
    // not a generic blank contract.
    if (isConcreteAddon) {
      setLoadingConcreteAddon(true);
      loadConcreteAddon(fromContractId);
      return;
    }
    // If the rep arrived via ?show=<id>, honor that prefill even when they
    // chose Start Over from the resume prompt.
    if (prefillShowId) {
      setLoadingShowPrefill(true);
      loadShowPrefill(prefillShowId);
      return;
    }
    setStep(1);
  }

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
          // Quote → contract conversion: preserve the saved doc-fee state.
          // Quotes saved before this migration have doc_fee_amount=0 and
          // doc_fee_waived=true (column-level defaults), so converting them
          // doesn't accidentally surface a phantom $99 line.
          doc_fee_amount: data.doc_fee_amount ?? 99,
          doc_fee_waived: data.doc_fee_waived ?? false,
          doc_fee_tax_amount: data.doc_fee_tax_amount ?? 0,
          surcharge_enabled: (data.surcharge_rate ?? 0) > 0,
          surcharge_rate: data.surcharge_rate ?? 0.035,
          surcharge_amount: data.surcharge_amount ?? 0,
          subtotal: data.subtotal ?? 0,
          discount_total: data.discount_total ?? 0,
          total: data.total ?? 0,
          deposit_amount: 0,
          notes: data.notes ?? undefined,
          external_notes: data.external_notes ?? undefined,
          needs_permit: data.needs_permit ?? false,
          needs_hoa: data.needs_hoa ?? false,
          permit_jurisdiction: data.permit_jurisdiction ?? undefined,
        },
      });
      setStep(5); // start at Review so they can add deposit and sign
    }
    setLoadingQuote(false);
  }

  function next() {
    setStep((s) => Math.min(s + 1, 8));
  }

  function back() {
    if (step === 1) {
      router.push("/dashboard");
    } else {
      setStep((s) => s - 1);
    }
  }

  function exit() {
    const msg = step >= 5
      ? "Exit the wizard? Your progress so far will be lost unless you've already saved it as a quote."
      : "Exit the wizard? Your progress will be lost.";
    if (typeof window !== "undefined" && window.confirm(msg)) {
      router.push("/dashboard");
    }
  }

  const isQuotePhase = QUOTE_STEPS.has(step);

  if (loadingQuote || loadingShowPrefill || loadingConcreteAddon) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-10 w-10 text-[#00929C]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-slate-500">
            {loadingQuote
              ? "Loading quote…"
              : loadingConcreteAddon
              ? "Loading parent contract…"
              : "Loading show…"}
          </p>
        </div>
      </div>
    );
  }

  if (showResumePrompt) {
    const customerName = customerOnDraft
      ? `${customerOnDraft.first_name ?? ""} ${customerOnDraft.last_name ?? ""}`.trim()
      : null;
    const itemCount = lineItemsOnDraft?.length ?? 0;
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-6 space-y-5">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#00929C] font-bold">In progress</p>
            <h1 className="text-2xl font-black text-slate-900 mt-1">Resume contract?</h1>
            <p className="text-sm text-slate-500 mt-2">
              You have an in-progress contract saved on this iPad
              {customerName ? ` for ${customerName}` : ""}
              {itemCount > 0 ? ` (${itemCount} item${itemCount === 1 ? "" : "s"})` : ""}.
              Pick up where you left off, or start a fresh contract.
            </p>
          </div>
          <div className="space-y-2">
            <Button onClick={handleResume} variant="default" size="xl" className="w-full">
              Resume in-progress
            </Button>
            <Button onClick={handleStartOver} variant="outline" size="xl" className="w-full">
              Start a new contract
            </Button>
          </div>
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
            aria-label="Back"
            className="p-2 -ml-2 rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors flex-shrink-0"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">
              {isQuotePhase ? "New Quote" : "Complete Contract"}
            </h1>
            <p className="text-[#00929C] text-xs truncate">
              Step {step} of {STEPS.length} · {STEPS[step - 1].label}
              {isQuotePhase
                ? " · Quote"
                : " · Contract"}
            </p>
          </div>
          <button
            onClick={exit}
            aria-label="Exit wizard"
            className="p-2 -mr-2 rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors flex-shrink-0 text-white/60 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
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
        {step === 6 && <Step6Delivery onNext={next} />}
        {step === 7 && <Step7Sign onNext={next} />}
        {step === 8 && <Step8Payment />}
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
