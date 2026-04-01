"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

export default function NewContractPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

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
            <h1 className="text-lg font-bold">New Contract</h1>
            <p className="text-[#00929C] text-xs">
              Step {step} of {STEPS.length} · {STEPS[step - 1].label}
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1 mt-3">
          {STEPS.map((s) => (
            <div
              key={s.id}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s.id <= step ? "bg-[#00929C]" : "bg-white/20"
              }`}
            />
          ))}
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
