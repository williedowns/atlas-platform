"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";

// "Financing" intentionally NOT a picker option — lender draws are managed via
// Step 4 financing entries + the Log-A-Draw flow on the contract detail page.
const PAYMENT_METHODS = [
  { value: "credit_card", label: "Credit Card" },
  { value: "debit_card", label: "Debit Card" },
  { value: "ach", label: "ACH / eCheck" },
  { value: "cash", label: "Cash / Check" },
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

  // ── Payment method ────────────────────────────────────────
  const [method, setMethod] = useState<string>("credit_card");
  const [amountInput, setAmountInput] = useState(balanceDue.toFixed(2));

  // ── Card fields ───────────────────────────────────────────
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState(""); // MM/YY
  const [cardCvc, setCardCvc] = useState("");
  const [cardZip, setCardZip] = useState("");

  // ── ACH fields ────────────────────────────────────────────
  const [routingNumber, setRoutingNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState<"PERSONAL_CHECKING" | "PERSONAL_SAVINGS" | "BUSINESS_CHECKING">("PERSONAL_CHECKING");
  const [accountName, setAccountName] = useState("");

  // ── Cash/Check fields ─────────────────────────────────────
  const [checkNumber, setCheckNumber] = useState("");
  const [bankName, setBankName] = useState("");

  // ── State ─────────────────────────────────────────────────
  const [state, setState] = useState<PaymentState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [amountCollected, setAmountCollected] = useState(0);
  const [newBalance, setNewBalance] = useState(0);
  const [successNote, setSuccessNote] = useState<string | null>(null);

  const amount = Math.min(Math.max(0, parseFloat(amountInput) || 0), balanceDue);
  const isFinancing = method === "financing";
  const surchargeAmount =
    method === "credit_card" && surchargeEnabled && !isFinancing
      ? Math.round(amount * surchargeRate * 100) / 100
      : 0;
  const totalToCharge = amount + surchargeAmount;

  const isCard = method === "credit_card" || method === "debit_card" || isFinancing;
  const isAch = method === "ach";
  const isCash = method === "cash";

  // ── Card expiry formatter ─────────────────────────────────
  const handleExpiryChange = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 3) {
      setCardExpiry(`${digits.slice(0, 2)}/${digits.slice(2)}`);
    } else {
      setCardExpiry(digits);
    }
  };

  // ── Card number formatter (groups of 4) ──────────────────
  const handleCardNumberChange = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 16);
    const groups = digits.match(/.{1,4}/g) ?? [];
    setCardNumber(groups.join(" "));
  };

  const handleAmountBlur = () => setAmountInput(amount.toFixed(2));

  // ── Validation ────────────────────────────────────────────
  const cardReady =
    isCard &&
    cardNumber.replace(/\s/g, "").length >= 13 &&
    cardExpiry.length === 5 &&
    cardCvc.length >= 3;

  const achReady =
    isAch &&
    routingNumber.length === 9 &&
    accountNumber.length >= 4 &&
    accountName.trim().length >= 2;

  const canSubmit =
    amount > 0 &&
    state !== "processing" &&
    (isCard ? cardReady : isAch ? achReady : true);

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setState("processing");
    setErrorMessage(null);

    let endpoint = "/api/payments/record-manual";
    let body: Record<string, unknown> = { contract_id: contractId, amount, method };

    if (isCard) {
      endpoint = "/api/payments/charge";
      const [expMonth, expYear] = cardExpiry.split("/");
      body = {
        contract_id: contractId,
        amount,
        surcharge_amount: surchargeAmount,
        method,
        card_number: cardNumber.replace(/\s/g, ""),
        card_exp_month: Number(expMonth),
        card_exp_year: 2000 + Number(expYear),
        card_cvc: cardCvc,
        card_postal_code: cardZip || undefined,
      };
    } else if (isAch) {
      endpoint = "/api/payments/echeck";
      body = {
        contract_id: contractId,
        amount,
        routing_number: routingNumber,
        account_number: accountNumber,
        account_type: accountType,
        account_holder_name: accountName,
      };
    } else {
      // Cash / Check
      body = {
        contract_id: contractId,
        amount,
        method,
        check_number: checkNumber || undefined,
        bank_name: bankName || undefined,
      };
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setState("error");
      const detail = data?.details ? ` — ${data.details}` : "";
      setErrorMessage((data?.error ?? "Payment failed. Please try again.") + detail);
      return;
    }

    setAmountCollected(isCard ? totalToCharge : amount);
    setNewBalance(Math.max(0, balanceDue - amount));
    if (isAch) setSuccessNote("ACH payments typically settle within 1-2 business days.");
    setState("success");
  };

  // ── Success screen ────────────────────────────────────────
  if (state === "success") {
    return (
      <div className="flex flex-col items-center gap-6 py-10 text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
          <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-emerald-700">
            {isAch ? "ACH Submitted!" : "Payment Collected!"}
          </h2>
          <p className="text-slate-500 mt-1">{customerName} · {contractNumber}</p>
        </div>

        <Card className="w-full">
          <CardContent className="py-5 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Amount {isAch ? "Submitted" : "Collected"}</span>
              <span className="font-bold text-emerald-700">{formatCurrency(amountCollected)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-3">
              <span className="text-slate-500">Remaining Balance</span>
              <span className={`font-semibold ${newBalance > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                {newBalance > 0 ? formatCurrency(newBalance) : "Paid in Full"}
              </span>
            </div>
            {successNote && (
              <p className="text-xs text-blue-600 border-t border-slate-100 pt-3">{successNote}</p>
            )}
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
                onClick={() => {
                  setMethod(m.value);
                  setCardNumber(""); setCardExpiry(""); setCardCvc(""); setCardZip("");
                  setRoutingNumber(""); setAccountNumber(""); setAccountName("");
                  setCheckNumber(""); setBankName("");
                }}
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

      {/* ── Credit / Debit Card Fields ── */}
      {isCard && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{isFinancing ? "Financing Card Details" : "Card Details"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isFinancing && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
                <p className="text-xs text-emerald-700 font-medium">Run the GreenSky / WF financing card through the reader or enter the card details below.</p>
              </div>
            )}
            <Input
              label="Card Number *"
              type="tel"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="1234 5678 9012 3456"
              value={cardNumber}
              onChange={(e) => handleCardNumberChange(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Expiry (MM/YY) *"
                type="tel"
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="09/27"
                value={cardExpiry}
                onChange={(e) => handleExpiryChange(e.target.value)}
              />
              <Input
                label="CVV *"
                type="tel"
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="123"
                maxLength={4}
                value={cardCvc}
                onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
            </div>
            <Input
              label="Billing ZIP (optional)"
              type="tel"
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="90210"
              maxLength={5}
              value={cardZip}
              onChange={(e) => setCardZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
            />
          </CardContent>
        </Card>
      )}

      {/* ── ACH / eCheck Fields ── */}
      {isAch && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Bank Account Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
              <p className="text-xs text-blue-700">ACH payments typically settle within 1-2 business days.</p>
            </div>
            <Input
              label="Routing Number *"
              type="tel"
              inputMode="numeric"
              placeholder="021000021"
              maxLength={9}
              value={routingNumber}
              onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, "").slice(0, 9))}
            />
            <Input
              label="Account Number *"
              type="tel"
              inputMode="numeric"
              placeholder="Account number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
            />
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Account Type *</label>
              <div className="grid grid-cols-3 gap-2">
                {(["PERSONAL_CHECKING", "PERSONAL_SAVINGS", "BUSINESS_CHECKING"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setAccountType(t)}
                    className={`rounded-lg py-2 px-1 text-xs font-semibold transition-all touch-manipulation ${
                      accountType === t
                        ? "bg-[#00929C] text-white shadow"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {t === "PERSONAL_CHECKING" ? "Personal Checking" : t === "PERSONAL_SAVINGS" ? "Personal Savings" : "Business Checking"}
                  </button>
                ))}
              </div>
            </div>
            <Input
              label="Account Holder Name *"
              type="text"
              placeholder="Full name on account"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
            />
          </CardContent>
        </Card>
      )}

      {/* ── Cash / Check Fields ── */}
      {isCash && (
        <Card>
          <CardContent className="py-5 space-y-4">
            <Input
              label="Check # (optional)"
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
        disabled={!canSubmit}
        onClick={handleSubmit}
      >
        {state === "processing"
          ? "Processing…"
          : isCard
          ? `Charge ${formatCurrency(totalToCharge)}`
          : isAch
          ? `Submit ACH ${formatCurrency(amount)}`
          : `Record ${formatCurrency(amount)}`}
      </Button>
    </div>
  );
}
