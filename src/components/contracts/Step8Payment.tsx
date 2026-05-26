"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useContractStore } from "@/store/contractStore";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, generateContractNumber } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type OverallState = "pending" | "processing" | "success" | "error" | "session_expired";

const METHOD_LABEL: Record<string, string> = {
  credit_card: "Credit Card",
  debit_card: "Debit Card",
  ach: "ACH",
  check: "Check",
  cash: "Cash",
  financing: "Financing (GreenSky / WF)",
};

// Quick BIN-based brand detection for the consent disclosure text. Final
// brand on the saved card comes from Intuit's response — this is just so
// the customer sees an accurate "MasterCard ····8553" while reading consent
// instead of a generic "card".
function detectBrand(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (/^4/.test(d)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "MasterCard";
  if (/^3[47]/.test(d)) return "American Express";
  if (/^6/.test(d)) return "Discover";
  return "Card";
}

export default function Step8Payment() {
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

  // ── Card fields ───────────────────────────────────────────
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardZip, setCardZip] = useState("");

  // ── Card-on-file consent (per-split) ──────────────────────
  // Unchecked by default per Visa/MC network rules — pre-checked boxes do not
  // constitute valid affirmative consent for storing a payment credential.
  const [saveCardForBalance, setSaveCardForBalance] = useState(false);

  // ── ACH fields ────────────────────────────────────────────
  const [routingNumber, setRoutingNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState<"PERSONAL_CHECKING" | "PERSONAL_SAVINGS" | "BUSINESS_CHECKING">("PERSONAL_CHECKING");
  const [accountName, setAccountName] = useState("");

  const currentSplit = splits[currentSplitIdx];
  const isCard = currentSplit?.method === "credit_card" || currentSplit?.method === "debit_card" || currentSplit?.method === "financing";
  const isFinancing = currentSplit?.method === "financing";
  const isAch = currentSplit?.method === "ach";
  const surchargeAmount =
    currentSplit?.method === "credit_card" && draft.surcharge_enabled && !isFinancing
      ? Math.round(currentSplit.amount * draft.surcharge_rate * 100) / 100
      : 0;
  const totalToCharge = (currentSplit?.amount ?? 0) + surchargeAmount;

  // Pre-fill ACH form from the split if collected at Step5Review.
  useEffect(() => {
    if (!isAch || !currentSplit) return;
    if (currentSplit.ach_routing_number && !routingNumber) setRoutingNumber(currentSplit.ach_routing_number);
    if (currentSplit.ach_account_number && !accountNumber) setAccountNumber(currentSplit.ach_account_number);
    if (currentSplit.ach_account_holder_name && !accountName) setAccountName(currentSplit.ach_account_holder_name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSplitIdx, isAch]);

  const handleExpiryChange = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 4);
    setCardExpiry(digits.length >= 3 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits);
  };

  const cardReady = isCard &&
    cardNumber.replace(/\s/g, "").length >= 13 &&
    cardExpiry.length === 5 &&
    cardCvc.length >= 3;

  const achReady = isAch &&
    routingNumber.length === 9 &&
    accountNumber.length >= 4 &&
    accountName.trim().length >= 2;

  const canCharge = isCard ? cardReady : isAch ? achReady : true;

  async function processCurrentSplit(cId: string) {
    if (!currentSplit) return;
    setState("processing");
    setErrorMessage(null);

    let endpoint: string;
    let body: Record<string, unknown>;

    if (isCard) {
      const [expMonth, expYear] = cardExpiry.split("/");
      endpoint = "/api/payments/charge";
      // COF consent only applies to non-financing card swipes — a financing
      // card is the LENDER'S card, not the customer's, so it can't be reused
      // for the balance.
      const offerCof = currentSplit.method === "credit_card" || currentSplit.method === "debit_card";
      body = {
        contract_id: cId,
        amount: currentSplit.amount,
        surcharge_amount: surchargeAmount,
        method: currentSplit.method,
        card_number: cardNumber.replace(/\s/g, ""),
        card_exp_month: Number(expMonth),
        card_exp_year: 2000 + Number(expYear),
        card_cvc: cardCvc,
        card_postal_code: cardZip || undefined,
        ...(offerCof && saveCardForBalance
          ? {
              save_card_for_balance: true,
              consent_amount: remainingBalance,
            }
          : {}),
      };
    } else if (isAch) {
      endpoint = "/api/payments/echeck";
      body = {
        contract_id: cId,
        amount: currentSplit.amount,
        routing_number: routingNumber,
        account_number: accountNumber,
        account_type: accountType,
        account_holder_name: accountName,
      };
    } else {
      // cash, check, financing, etc. — record only, no charge processing
      endpoint = "/api/payments/record-manual";
      body = {
        contract_id: cId,
        amount: currentSplit.amount,
        method: currentSplit.method,
        check_number: currentSplit.check_number,
        bank_name: currentSplit.bank_name,
      };
    }

    let res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // Session expired mid-charge: try to refresh once and retry. Card data is
    // already in component state, so we don't lose what the rep typed.
    if (res.status === 401) {
      const supabase = createClient();
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (refreshed?.session) {
        res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      if (res.status === 401) {
        setState("session_expired");
        setErrorMessage(
          "Your session expired. Please sign in again — your card details below are preserved and the charge will retry when you click Start."
        );
        return;
      }
    }

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setState("error");
      const detail = data?.details ? ` — ${data.details}` : "";
      setErrorMessage((data?.error ?? "Payment failed. Please try again.") + detail);
      return;
    }

    const newCompleted = [...completedSplits, currentSplitIdx];
    setCompletedSplits(newCompleted);

    if (newCompleted.length === splits.length) {
      setState("success");
    } else {
      // Reset card/ACH fields for next split
      setCardNumber(""); setCardExpiry(""); setCardCvc(""); setCardZip("");
      setRoutingNumber(""); setAccountNumber(""); setAccountName("");
      setSaveCardForBalance(false);
      setCurrentSplitIdx(currentSplitIdx + 1);
      setState("pending");
    }
  }

  // Fire-and-forget client error logging. Mirrors Step7Sign so we have an
  // audit trail of every Step-8 entry that started without a contract ID.
  const reportClientError = (context: Record<string, unknown>) => {
    try {
      fetch("/api/client-errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "contract.submission_failed",
          context,
        }),
        keepalive: true,
      }).catch(() => {/* non-fatal */});
    } catch {
      /* non-fatal */
    }
  };

  // Auto-recovery: when Step 8 is reached without a contract ID, query the
  // server for a recent contract this rep created for this customer at this
  // total. If we find one, the contract was saved server-side and we can
  // safely proceed to deposit collection — no duplicate, no lost sale.
  async function findRecentContract(): Promise<string | null> {
    const email = draft.customer?.email?.trim();
    if (!email) return null;
    try {
      const params = new URLSearchParams({
        customer_email: email,
        total: String(draft.total),
        within_minutes: "120",
      });
      const res = await fetch(`/api/contracts/find-recent?${params.toString()}`);
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      return data?.contract_id ?? null;
    } catch {
      return null;
    }
  }

  async function handleStart() {
    let cId = contractId ?? draft.created_contract_id ?? "";

    if (!cId) {
      // Log the entry-without-id for diagnostics, then attempt auto-recovery.
      reportClientError({
        where: "step8.no_contract_id_on_start",
        idempotency_key: draft.idempotency_key ?? null,
        customer_email: draft.customer?.email ?? null,
        total: draft.total,
        online: typeof navigator !== "undefined" ? navigator.onLine : null,
      });
      setState("processing");
      setErrorMessage(null);
      const recovered = await findRecentContract();
      if (recovered) {
        cId = recovered;
      } else {
        setErrorMessage(
          "No contract ID found. Your contract may have already saved — open the Contracts list before retrying so you don't double-submit."
        );
        setState("error");
        return;
      }
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
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 rounded-full bg-emerald-200 animate-ping opacity-40" />
          <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-xl">
            <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
        </div>
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-emerald-700 tracking-tight">Deal Done.</h2>
          <p className="text-slate-500 mt-2 text-lg">Deposits collected and saved. Contract emailed to customer.</p>
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
      <div className="text-center py-6 rounded-2xl bg-gradient-to-b from-emerald-50 to-white border border-emerald-100">
        <p className="text-[10px] uppercase tracking-widest text-amber-600 font-bold">Step 8 of 8 · Final</p>
        <div className="relative w-16 h-16 mx-auto my-3">
          <div className="absolute inset-0 rounded-full bg-emerald-200 animate-ping opacity-40" />
          <div className="relative w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
        </div>
        <h2 className="text-2xl md:text-3xl font-black text-emerald-700 tracking-tight">Contract Signed!</h2>
        <p className="text-sm text-emerald-600/80 mt-1">Collect the deposit to lock this deal in.</p>
        <Badge variant="success" className="mt-3 text-sm px-3 py-1">{contractNumber}</Badge>
      </div>

      {customerEmail && (
        <div className="text-center text-sm text-slate-500">
          Contract emailed to <span className="font-medium text-slate-700">{customerEmail}</span>
        </div>
      )}

      {/* Done — Back to Dashboard. The contract is already saved; the rep
          should always have a clear exit even if no deposit was queued. */}
      {splits.length === 0 && (
        <Button
          variant="primary"
          size="xl"
          className="w-full"
          onClick={() => {
            resetDraft();
            router.push("/dashboard");
          }}
        >
          Done — Back to Dashboard
        </Button>
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

            {/* ── Card Fields ── */}
            {isCard && (
              <div className="space-y-3 pt-1 border-t border-slate-100">
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
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 16);
                    setCardNumber(digits.match(/.{1,4}/g)?.join(" ") ?? digits);
                  }}
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
                  placeholder="90210"
                  maxLength={5}
                  value={cardZip}
                  onChange={(e) => setCardZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                />

                {/* ── Card-on-file consent ───────────────────────────────
                    Shown only on customer cards (credit/debit), and only
                    once enough digits have been entered to render the
                    last 4 + brand in the disclosure. Unchecked by default
                    — Visa/MC require affirmative opt-in. */}
                {(currentSplit?.method === "credit_card" || currentSplit?.method === "debit_card") &&
                  cardNumber.replace(/\s/g, "").length >= 13 &&
                  remainingBalance > 0 && (
                    <button
                      type="button"
                      onClick={() => setSaveCardForBalance((v) => !v)}
                      className={`w-full text-left rounded-xl border-2 transition-all p-4 ${
                        saveCardForBalance
                          ? "border-[#00929C] bg-[#00929C]/8"
                          : "border-slate-200 bg-white hover:border-[#00929C]/40"
                      }`}
                    >
                      <div className="flex gap-3">
                        <div
                          className={`flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                            saveCardForBalance
                              ? "bg-[#00929C] border-[#00929C]"
                              : "bg-white border-slate-400"
                          }`}
                        >
                          {saveCardForBalance && (
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 text-base leading-tight">
                            Save card to charge the balance at delivery
                          </p>
                          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                            I authorize Atlas Spas &amp; Swim Spas to charge the remaining balance of{" "}
                            <span className="font-semibold text-slate-900">{formatCurrency(remainingBalance)}</span>{" "}
                            to my{" "}
                            <span className="font-semibold text-slate-900">
                              {detectBrand(cardNumber)} ····{cardNumber.replace(/\s/g, "").slice(-4)}
                            </span>{" "}
                            at the time of delivery. I understand the final amount may vary slightly based on
                            delivery-day adjustments and that I will receive a receipt by email when the balance is
                            charged. This authorization remains in effect until the balance is paid or the order is
                            cancelled.
                          </p>
                        </div>
                      </div>
                    </button>
                  )}
              </div>
            )}

            {/* ── ACH Fields ── */}
            {isAch && (
              <div className="space-y-3 pt-1 border-t border-slate-100">
                <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
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
                      <button key={t} type="button" onClick={() => setAccountType(t)}
                        className={`rounded-lg py-2 px-1 text-xs font-semibold transition-all ${accountType === t ? "bg-[#00929C] text-white" : "bg-slate-100 text-slate-700"}`}>
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
              </div>
            )}

            {state === "error" && errorMessage && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-700">{errorMessage}</p>
              </div>
            )}

            {state === "session_expired" && (
              <div className="rounded-lg bg-amber-50 border-2 border-amber-300 p-4 space-y-3">
                <div>
                  <p className="text-sm font-bold text-amber-900">Session expired</p>
                  <p className="text-sm text-amber-800 mt-1">{errorMessage}</p>
                </div>
                <Button
                  variant="default"
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    // Open login in a new tab so this Step8 stays mounted
                    // (preserves entered card data). Rep signs in, comes
                    // back, clicks Start to retry.
                    window.open("/login", "_blank", "noopener,noreferrer");
                    setState("pending");
                  }}
                >
                  Sign in to retry
                </Button>
              </div>
            )}

            <Button
              variant="success"
              size="xl"
              className="w-full text-lg"
              disabled={state === "processing" || state === "session_expired" || !canCharge}
              onClick={handleStart}
            >
              {state === "processing"
                ? "Processing…"
                : isFinancing
                ? `Process Financing ${formatCurrency(totalToCharge)}`
                : isCard
                ? `Charge ${formatCurrency(totalToCharge)}`
                : isAch
                ? `Submit ACH ${formatCurrency(currentSplit.amount)}`
                : `Record ${formatCurrency(currentSplit.amount)}`}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
