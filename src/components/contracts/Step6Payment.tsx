"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useContractStore } from "@/store/contractStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, generateContractNumber } from "@/lib/utils";

type OverallState = "pending" | "processing" | "success" | "error";

const METHOD_LABEL: Record<string, string> = {
  credit_card: "Credit Card",
  debit_card: "Debit Card",
  ach: "ACH / Check",
  cash: "Cash",
};

export default function Step6Payment() {
  const router = useRouter();
  const { draft, resetDraft } = useContractStore();

  const contractNumber = useMemo(() => generateContractNumber(), []);
  const customerName = draft.customer
    ? `${draft.customer.first_name} ${draft.customer.last_name}`
    : "Customer";
  const customerEmail = draft.customer?.email ?? "";

  const splits = Array.isArray(draft.deposit_splits) ? draft.deposit_splits : [];
  const totalDeposit = splits.reduce((sum, s) => sum + s.amount, 0);
  const remainingBalance = Math.max(0, draft.total - totalDeposit);

  const [state, setState] = useState<OverallState>("pending");
  const [currentSplitIdx, setCurrentSplitIdx] = useState(0);
  const [completedSplits, setCompletedSplits] = useState<number[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [contractId, setContractId] = useState<string | null>(null);

  const currentSplit = splits[currentSplitIdx];
  const isCard = currentSplit?.method === "credit_card" || currentSplit?.method === "debit_card";
  const surchargeAmount =
    currentSplit?.method === "credit_card" && draft.surcharge_enabled
      ? Math.round(currentSplit.amount * draft.surcharge_rate * 100) / 100
      : 0;
  const totalToCharge = (currentSplit?.amount ?? 0) + surchargeAmount;

  async function processCurrentSplit(cId: string) {
    if (!currentSplit) return;
    setState("processing");
    setErrorMessage(null);

    const endpoint = isCard ? "/api/payments/charge" : "/api/payments/record-manual";
    const body = isCard
      ? { contract_id: cId, amount: currentSplit.amount, surcharge_amount: surchargeAmount, method: currentSplit.method }
      : { contract_id: cId, amount: currentSplit.amount, method: currentSplit.method, check_number: currentSplit.check_number, bank_name: currentSplit.bank_name };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setState("error");
      setErrorMessage(data?.error ?? "Payment failed. Please try again.");
      return;
    }

    const newCompleted = [...completedSplits, currentSplitIdx];
    setCompletedSplits(newCompleted);

    if (newCompleted.length === splits.length) {
      setState("success");
    } else {
      setCurrentSplitIdx(currentSplitIdx + 1);
      setState("pending");
    }
  }

  async function handleStart() {
    const cId = contractId ?? draft.created_contract_id ?? "";
    if (!cId) {
      setErrorMessage("No contract ID found. Please restart the flow.");
      setState("error");
      return;
    }
    setContractId(cId);
    await processCurrentSplit(cId);
  }

  const handleNewContract = () => {
    resetDraft();
    router.push("/contracts/new");
  };

  // ── All Done ────────────────────────────────────────────
  if (state === "success") {
    return (
      <div className="flex flex-col items-center gap-6 py-12 px-4 text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
          <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-emerald-700">All Deposits Collected!</h2>
          <p className="text-slate-500 mt-2 text-lg">Everything is confirmed and saved</p>
        </div>

        <Card className="w-full">
          <CardContent className="py-5 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Contract #</span>
              <span className="font-semibold">{contractNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Customer</span>
              <span className="font-semibold">{customerName}</span>
            </div>
            {splits.map((split, i) => (
              <div key={i} className="flex justify-between text-emerald-700">
                <span>{METHOD_LABEL[split.method] ?? split.method}</span>
                <span className="font-semibold">{formatCurrency(split.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold text-base border-t border-slate-200 pt-3">
              <span>Total Collected</span>
              <span className="text-emerald-700">{formatCurrency(totalDeposit)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Balance Due at Delivery</span>
              <span className="font-semibold text-amber-700">{formatCurrency(remainingBalance)}</span>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4 w-full">
          <Button variant="outline" size="lg" onClick={() => router.push("/contracts")}>
            View Contract
          </Button>
          <Button variant="primary" size="lg" onClick={handleNewContract}>
            New Contract
          </Button>
        </div>
      </div>
    );
  }

  // ── Payment Flow ────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Signed confirmation */}
      <div className="text-center py-4">
        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
          <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-emerald-700">Contract Signed!</h2>
        <Badge variant="success" className="mt-2 text-sm px-3 py-1">{contractNumber}</Badge>
      </div>

      {customerEmail && (
        <div className="text-center text-sm text-slate-500">
          Contract emailed to <span className="font-medium text-slate-700">{customerEmail}</span>
        </div>
      )}

      {/* Split progress */}
      {splits.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Deposits ({completedSplits.length}/{splits.length} collected)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {splits.map((split, i) => (
              <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                completedSplits.includes(i)
                  ? "bg-emerald-50 text-emerald-700"
                  : i === currentSplitIdx
                  ? "bg-[#00929C]/8 border border-[#00929C]/30 font-semibold"
                  : "bg-slate-50 text-slate-400"
              }`}>
                <div className="flex items-center gap-2">
                  {completedSplits.includes(i) ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    <span className="w-4 h-4 rounded-full border-2 border-current inline-block" />
                  )}
                  <span>{METHOD_LABEL[split.method] ?? split.method}</span>
                  {split.check_number && <span className="text-xs opacity-70">#{split.check_number}</span>}
                </div>
                <span className="font-semibold">{formatCurrency(split.amount)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Current split action */}
      {currentSplit && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {splits.length > 1
                ? `Payment ${currentSplitIdx + 1} of ${splits.length}`
                : "Collect Deposit"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Method</span>
              <span className="font-medium">{METHOD_LABEL[currentSplit.method] ?? currentSplit.method}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Amount</span>
              <span className="font-semibold">{formatCurrency(currentSplit.amount)}</span>
            </div>
            {surchargeAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">CC Surcharge ({(draft.surcharge_rate * 100).toFixed(1)}%)</span>
                <span className="font-medium">+{formatCurrency(surchargeAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-[#00929C] border-t border-slate-200 pt-3">
              <span>Total to Charge</span>
              <span>{formatCurrency(totalToCharge)}</span>
            </div>

            {isCard && (
              <div className="flex justify-center py-2">
                <svg className="w-14 h-14 text-[#00929C] animate-pulse" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                </svg>
              </div>
            )}

            {state === "error" && errorMessage && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-700">{errorMessage}</p>
              </div>
            )}

            <Button
              variant="success"
              size="xl"
              className="w-full text-lg"
              disabled={state === "processing"}
              onClick={handleStart}
            >
              {state === "processing"
                ? "Processing…"
                : isCard
                ? `Charge ${formatCurrency(totalToCharge)}`
                : `Record ${formatCurrency(currentSplit.amount)}`}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
