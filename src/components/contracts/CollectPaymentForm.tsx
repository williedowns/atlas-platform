"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";

const PAYMENT_METHODS = [
  { value: "credit_card", label: "Credit Card" },
  { value: "debit_card", label: "Debit Card" },
  { value: "ach", label: "ACH / Check" },
  { value: "cash", label: "Cash" },
] as const;

type PaymentState = "idle" | "processing" | "success" | "error";

interface CollectPaymentFormProps {
  contractId: string;
  contractNumber: string;
  customerName: string;
  total: number;
  depositPaid: number;
  balanceDue: number;
  surchargeEnabled: boolean;
  surchargeRate: number;
}

export function CollectPaymentForm({
  contractId,
  contractNumber,
  customerName,
  total,
  depositPaid,
  balanceDue,
  surchargeEnabled,
  surchargeRate,
}: CollectPaymentFormProps) {
  const router = useRouter();
  const [method, setMethod] = useState<string>("credit_card");
  const [amountInput, setAmountInput] = useState(balanceDue.toFixed(2));
  const [checkNumber, setCheckNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [lastFour, setLastFour] = useState("");
  const [cardConfirmed, setCardConfirmed] = useState(false);
  const [state, setState] = useState<PaymentState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [amountCollected, setAmountCollected] = useState(0);
  const [newBalance, setNewBalance] = useState(0);

  const amount = Math.min(Math.max(0, parseFloat(amountInput) || 0), balanceDue);
  const surchargeAmount =
    method === "credit_card" && surchargeEnabled
      ? Math.round(amount * surchargeRate * 100) / 100
      : 0;
  const totalToCharge = amount + surchargeAmount;
  const isCard = method === "credit_card" || method === "debit_card";
  const cardReady = !isCard || (lastFour.length === 4 && cardConfirmed);

  const handleAmountBlur = () => {
    setAmountInput(amount.toFixed(2));
  };

  const handleSubmit = async () => {
    if (amount <= 0) return;
    setState("processing");
    setErrorMessage(null);

    // All payments recorded manually — card tokenization via Intuit SDK handled separately
    const endpoint = "/api/payments/record-manual";
    const body = { contract_id: contractId, amount, method, check_number: checkNumber || undefined, bank_name: bankName || undefined, last_four: lastFour || undefined };

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

    setAmountCollected(totalToCharge);
    setNewBalance(Math.max(0, balanceDue - amount));
    setState("success");
  };

  // ── Success ──────────────────────────────────────────────
  if (state === "success") {
    return (
      <div className="flex flex-col items-center gap-6 py-10 text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
          <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-emerald-700">Payment Collected!</h2>
          <p className="text-slate-500 mt-1">{customerName} · {contractNumber}</p>
        </div>

        <Card className="w-full">
          <CardContent className="py-5 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Amount Collected</span>
              <span className="font-bold text-emerald-700">{formatCurrency(amountCollected)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-3">
              <span className="text-slate-500">Remaining Balance</span>
              <span className={`font-semibold ${newBalance > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                {newBalance > 0 ? formatCurrency(newBalance) : "Paid in Full"}
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 w-full">
          {newBalance > 0 && (
            <Button variant="accent" size="xl" className="w-full" onClick={() => router.refresh()}>
              Collect Another Payment
            </Button>
          )}
          <Button variant="outline" size="lg" className="w-full" onClick={() => router.push(`/contracts/${contractId}`)}>
            Back to Contract
          </Button>
        </div>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Balance Summary */}
      <Card>
        <CardContent className="py-5">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Contract Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
            {depositPaid > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Previously Paid</span>
                <span>−{formatCurrency(depositPaid)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-amber-700 border-t border-slate-200 pt-2">
              <span>Balance Due</span>
              <span>{formatCurrency(balanceDue)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Amount */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Amount to Collect</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            label="Amount ($)"
            type="number"
            min="0.01"
            max={balanceDue}
            step="0.01"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            onBlur={handleAmountBlur}
          />
          {surchargeAmount > 0 && (
            <p className="text-xs text-slate-500">
              CC surcharge ({(surchargeRate * 100).toFixed(1)}%): +{formatCurrency(surchargeAmount)} → Total: {formatCurrency(totalToCharge)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Payment Method */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Payment Method</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => { setMethod(m.value); setLastFour(""); setCardConfirmed(false); }}
                className={`h-14 rounded-full text-base font-semibold transition-all touch-manipulation ${
                  method === m.value
                    ? "bg-[#00929C] text-white shadow-md"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Card fields */}
      {isCard && (
        <Card>
          <CardContent className="py-5 space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-sm font-semibold text-amber-800">Charge the card on your terminal first</p>
              <p className="text-xs text-amber-700 mt-0.5">Enter the last 4 digits and confirm below after the terminal approves.</p>
            </div>
            <Input
              label="Last 4 digits of card *"
              type="tel"
              inputMode="numeric"
              maxLength={4}
              value={lastFour}
              onChange={(e) => setLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="1234"
            />
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={cardConfirmed}
                onChange={(e) => setCardConfirmed(e.target.checked)}
                className="w-5 h-5 rounded accent-[#00929C]"
              />
              <span className="text-sm font-medium text-slate-700">
                Card was successfully charged on terminal
              </span>
            </label>
          </CardContent>
        </Card>
      )}

      {/* ACH fields */}
      {method === "ach" && (
        <Card>
          <CardContent className="py-5 space-y-4">
            <Input
              label="Check #"
              type="text"
              value={checkNumber}
              onChange={(e) => setCheckNumber(e.target.value)}
              placeholder="Enter check number"
            />
            <Input
              label="Bank Name (optional)"
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Bank name"
            />
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {state === "error" && errorMessage && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-700">{errorMessage}</p>
          <Button variant="ghost" size="sm" className="mt-2 text-red-700" onClick={() => setState("idle")}>
            Try Again
          </Button>
        </div>
      )}

      {/* Submit */}
      <Button
        variant="success"
        size="xl"
        className="w-full text-lg"
        disabled={amount <= 0 || state === "processing" || !cardReady}
        onClick={handleSubmit}
      >
        {state === "processing"
          ? "Processing…"
          : isCard
          ? `Charge ${formatCurrency(totalToCharge)}`
          : `Record ${formatCurrency(amount)}`}
      </Button>
    </div>
  );
}
