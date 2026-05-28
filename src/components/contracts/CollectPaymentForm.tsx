"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";

// "Financing" added as a picker option (2026-05-20) so reps can convert a
// remaining balance to a new financing entry from the same place they collect
// any other payment. Routes to POST /api/contracts/[id]/financing instead of
// the charge / manual-record paths.
const PAYMENT_METHODS = [
  { value: "credit_card", label: "Credit Card" },
  { value: "debit_card", label: "Debit Card" },
  { value: "ach", label: "ACH / eCheck" },
  { value: "check", label: "Check" },
  { value: "cash", label: "Cash" },
  { value: "financing", label: "Financing" },
] as const;

const KNOWN_FINANCERS = [
  "Wells Fargo",
  "Synchrony",
  "Foundation",
  "Lyon",
  "GreenSky",
  "In-house",
];

type PaymentState = "idle" | "processing" | "success" | "error";

interface SavedCard {
  brand: string;
  last4: string;
  expMonth: number | null;
  expYear: number | null;
  consentAt: string | null;
}

interface CollectPaymentFormProps {
  contractId: string;
  contractNumber: string;
  customerName: string;
  total: number;
  depositPaid: number;
  balanceDue: number;
  surchargeEnabled: boolean;
  surchargeRate: number;
  savedCard: SavedCard | null;
}

// True when the saved-card expiry is in the past. Cards expire at the END of
// the named month, so "09/2026" is valid through 2026-09-30 23:59.
function isCardExpired(expMonth: number | null, expYear: number | null): boolean {
  if (!expMonth || !expYear) return false;
  const lastValid = new Date(expYear, expMonth, 0); // 0th day of next month = last day of expiry month
  return lastValid.getTime() < Date.now();
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
  savedCard,
}: CollectPaymentFormProps) {
  const router = useRouter();

  // Saved-card path takes priority — when present and not expired, this is
  // the recommended one-tap flow for the rep. They can still switch off it
  // via the method buttons if the customer wants to use a different card.
  const savedCardExpired = savedCard ? isCardExpired(savedCard.expMonth, savedCard.expYear) : false;
  const offerSavedCard = !!savedCard && !savedCardExpired;
  const [useSavedCard, setUseSavedCard] = useState(offerSavedCard);

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

  // ── Financing fields ──────────────────────────────────────
  const [financer, setFinancer] = useState<string>(KNOWN_FINANCERS[0]);
  const [otherFinancer, setOtherFinancer] = useState("");
  const [termMonths, setTermMonths] = useState("");
  const [apr, setApr] = useState("");
  const [approvalNumber, setApprovalNumber] = useState("");
  const [externalAppId, setExternalAppId] = useState("");
  const [financingNotes, setFinancingNotes] = useState("");

  // ── State ─────────────────────────────────────────────────
  const [state, setState] = useState<PaymentState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [amountCollected, setAmountCollected] = useState(0);
  const [newBalance, setNewBalance] = useState(0);
  const [successNote, setSuccessNote] = useState<string | null>(null);

  const amount = Math.min(Math.max(0, parseFloat(amountInput) || 0), balanceDue);
  const isFinancing = method === "financing";
  // Surcharge applies for credit card swipes — including the saved-card path
  // since the saved card is always a credit card under Intuit's COF flow.
  const surchargeAmount =
    (useSavedCard || (method === "credit_card" && !isFinancing)) && surchargeEnabled
      ? Math.round(amount * surchargeRate * 100) / 100
      : 0;
  const totalToCharge = amount + surchargeAmount;

  const isCard = method === "credit_card" || method === "debit_card";
  const isAch = method === "ach";
  const isCheck = method === "check";

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

  const financingReady =
    isFinancing &&
    amount > 0 &&
    (financer !== "Other" || otherFinancer.trim().length > 0);

  const canSubmit =
    amount > 0 &&
    state !== "processing" &&
    (useSavedCard ? true : isCard ? cardReady : isAch ? achReady : isFinancing ? financingReady : true);

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setState("processing");
    setErrorMessage(null);

    let endpoint = "/api/payments/record-manual";
    let body: Record<string, unknown> = { contract_id: contractId, amount, method };

    if (isFinancing) {
      // Convert the remaining balance to a new financing entry. Doesn't move
      // money — records lender terms, recalculates balance_due, and archives
      // the prior contract PDF for legal defensibility.
      endpoint = `/api/contracts/${contractId}/financing`;
      const financerName = financer === "Other" ? otherFinancer.trim() : financer;
      const fbody: Record<string, unknown> = {
        financer_name: financerName,
        financed_amount: amount,
        type: financer === "In-house" ? "in_house" : "third_party",
        deduct_from_balance: true,
      };
      if (termMonths.trim()) fbody.term_months = Number(termMonths);
      if (apr.trim()) fbody.apr = Number(apr);
      if (approvalNumber.trim()) fbody.approval_number = approvalNumber.trim();
      if (externalAppId.trim()) fbody.external_application_id = externalAppId.trim();
      if (financingNotes.trim()) fbody.notes = financingNotes.trim();
      body = fbody;
    } else if (useSavedCard) {
      // Charge the card the customer authorized at deposit. No card form
      // values needed — the server resolves the card via contract.saved_card_token.
      endpoint = "/api/payments/charge";
      body = {
        contract_id: contractId,
        amount,
        surcharge_amount: surchargeAmount,
        method: "credit_card",
        use_saved_card: true,
      };
    } else if (isCard) {
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
      // Cash or Check — record manually, no charge processing.
      // Only attach check_number/bank_name when method=check (cash doesn't need them).
      body = {
        contract_id: contractId,
        amount,
        method,
        ...(isCheck ? { check_number: checkNumber || undefined, bank_name: bankName || undefined } : {}),
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

    setAmountCollected(useSavedCard || isCard ? totalToCharge : amount);
    // For financing the API returns the authoritative new balance_due.
    if (isFinancing && data?.balance_due !== undefined) {
      setNewBalance(Math.max(0, Number(data.balance_due)));
    } else {
      setNewBalance(Math.max(0, balanceDue - amount));
    }
    if (isAch) setSuccessNote("ACH payments typically settle within 1-2 business days.");
    if (isFinancing) setSuccessNote("Financing entry added. Original signed PDF archived; new PDF regenerates on next view.");
    setState("success");
  };

  // ── ACH Office-Processing Fallback ────────────────────────────────────────
  // Mirrors Step8Payment: rep can skip the Intuit eCheck call entirely and
  // save the routing+account on the payment for Lindy to run from the office
  // ACH queue. Triggered by either the secondary "Save to Run Later" button
  // (proactive) or the in-error fallback button (after Intuit rejection).
  const handleSaveAchForOffice = async () => {
    if (!isAch || !achReady || amount <= 0) return;
    setState("processing");
    setErrorMessage(null);

    const res = await fetch("/api/payments/record-manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contract_id: contractId,
        amount,
        method: "ach",
        ach_routing_number: routingNumber,
        ach_account_number: accountNumber,
        ach_account_type: accountType,
        ach_account_holder_name: accountName,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setState("error");
      setErrorMessage(data?.error ?? "Save failed. Please try again.");
      return;
    }
    setAmountCollected(amount);
    setNewBalance(Math.max(0, balanceDue - amount));
    setSuccessNote("ACH saved. The home office will see it in the ACH queue and mark it ran once processed.");
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
            {isFinancing ? "Financing Added!" : isAch ? "ACH Submitted!" : "Payment Collected!"}
          </h2>
          <p className="text-slate-500 mt-1">{customerName} · {contractNumber}</p>
        </div>

        <Card className="w-full">
          <CardContent className="py-5 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">
                {isFinancing ? "Amount Financed" : isAch ? "Amount Submitted" : "Amount Collected"}
              </span>
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

      {/* Saved card (card-on-file) — shown when the customer authorized
          reuse at deposit time. Tap to charge instantly; tap "Use a
          different payment method" to fall back to the regular flow. */}
      {savedCard && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Saved Card</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <button
              type="button"
              disabled={savedCardExpired}
              onClick={() => setUseSavedCard(true)}
              className={`w-full text-left rounded-xl border-2 transition-all p-4 ${
                savedCardExpired
                  ? "border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed"
                  : useSavedCard
                  ? "border-[#00929C] bg-[#00929C]/8"
                  : "border-slate-200 bg-white hover:border-[#00929C]/40"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    useSavedCard && !savedCardExpired
                      ? "bg-[#00929C] border-[#00929C]"
                      : "bg-white border-slate-400"
                  }`}
                >
                  {useSavedCard && !savedCardExpired && (
                    <div className="w-2.5 h-2.5 rounded-full bg-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 text-base">
                    Charge {savedCard.brand} ····{savedCard.last4}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {savedCardExpired
                      ? "Card expired — collect a new card below."
                      : `Saved at deposit${
                          savedCard.consentAt
                            ? ` on ${new Date(savedCard.consentAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}`
                            : ""
                        }${
                          savedCard.expMonth && savedCard.expYear
                            ? ` · Expires ${String(savedCard.expMonth).padStart(2, "0")}/${savedCard.expYear}`
                            : ""
                        }`}
                  </p>
                </div>
              </div>
            </button>
            {useSavedCard && !savedCardExpired && (
              <button
                type="button"
                onClick={() => setUseSavedCard(false)}
                className="text-xs text-slate-500 hover:text-[#00929C] underline"
              >
                Use a different payment method
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment Method (hidden when paying with saved card) */}
      {!useSavedCard && (
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
      )}

      {/* ── Credit / Debit Card Fields ── */}
      {!useSavedCard && isCard && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Card Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
      {!useSavedCard && isAch && (
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

      {/* ── Check Fields (only when method = check) ── */}
      {!useSavedCard && isCheck && (
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

      {/* ── Financing Fields (only when method = financing) ── */}
      {!useSavedCard && isFinancing && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Financing Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
              <p className="text-xs text-amber-800">
                Records the balance as a new financing entry on this contract. No money moves now — balance updates immediately and the contract PDF regenerates with the new terms.
              </p>
            </div>

            <label className="block text-sm">
              <span className="text-slate-700 font-medium block mb-1">Financer *</span>
              <select
                value={financer}
                onChange={(e) => setFinancer(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-base focus:outline-none focus:ring-2 focus:ring-[#00929C]/30"
              >
                {KNOWN_FINANCERS.map((f) => <option key={f} value={f}>{f}</option>)}
                <option value="Other">Other…</option>
              </select>
              {financer === "Other" && (
                <Input
                  className="mt-2"
                  placeholder="Financer name"
                  value={otherFinancer}
                  onChange={(e) => setOtherFinancer(e.target.value)}
                />
              )}
            </label>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Term (months)"
                type="tel"
                inputMode="numeric"
                placeholder="e.g. 60"
                value={termMonths}
                onChange={(e) => setTermMonths(e.target.value.replace(/\D/g, ""))}
              />
              <Input
                label="APR (%)"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 9.99"
                value={apr}
                onChange={(e) => setApr(e.target.value.replace(/[^\d.]/g, ""))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Approval #"
                type="text"
                placeholder="Optional"
                value={approvalNumber}
                onChange={(e) => setApprovalNumber(e.target.value)}
              />
              <Input
                label="External app ID"
                type="text"
                placeholder="Optional"
                value={externalAppId}
                onChange={(e) => setExternalAppId(e.target.value)}
              />
            </div>

            <label className="block text-sm">
              <span className="text-slate-700 font-medium block mb-1">Notes</span>
              <textarea
                value={financingNotes}
                onChange={(e) => setFinancingNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Customer called to cancel; converted balance to WF to save the deal."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 resize-none"
              />
            </label>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {state === "error" && errorMessage && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 space-y-3">
          <div>
            <p className="text-sm text-red-700">{errorMessage}</p>
            <Button variant="ghost" size="sm" className="mt-2 text-red-700" onClick={() => setState("idle")}>
              Try Again
            </Button>
          </div>
          {isAch && achReady && (
            <div className="rounded-md bg-white border border-red-200 p-3 space-y-2">
              <p className="text-xs text-slate-700">
                Save didn&apos;t go through. Try again — the bank info will be saved to the
                ACH queue to be ran at the home office.
              </p>
              <Button
                variant="outline"
                size="lg"
                className="w-full border-[#00929C] text-[#00929C]"
                onClick={handleSaveAchForOffice}
              >
                Try Save Again
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Electronic ACH submit is disabled while the Intuit merchant account
          is linked to the wrong bank. ACH method goes straight to the office
          queue via the Save button below. Other methods unchanged. */}
      {!isAch && (
        <Button
          variant="success"
          size="xl"
          className="w-full text-lg"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {state === "processing"
            ? "Processing…"
            : useSavedCard
            ? `Charge ${formatCurrency(totalToCharge)} to ${savedCard?.brand ?? "Card"} ····${savedCard?.last4 ?? ""}`
            : isCard
            ? `Charge ${formatCurrency(totalToCharge)}`
            : isFinancing
            ? `Add ${formatCurrency(amount)} Financing`
            : `Record ${formatCurrency(amount)}`}
        </Button>
      )}

      {/* ACH office-processing path. While Intuit eCheck is disabled, this
          is the ONLY ACH route — the rep saves the bank info for Lindy to
          run manually from the office ACH queue. */}
      {isAch && (
        <div className="space-y-2">
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="text-xs text-amber-800">
              <span className="font-bold">Electronic ACH processing is temporarily off.</span>{" "}
              Save the bank info here and the office will run this ACH from the queue.
            </p>
          </div>
          <Button
            variant="success"
            size="xl"
            className="w-full text-lg"
            disabled={!achReady || amount <= 0 || state === "processing"}
            onClick={handleSaveAchForOffice}
          >
            {state === "processing"
              ? "Saving…"
              : `Save ACH ${formatCurrency(amount)} for Office`}
          </Button>
          <p className="text-xs text-slate-500 text-center">
            Adds to the ACH queue to be ran at the home office
          </p>
        </div>
      )}
    </div>
  );
}
