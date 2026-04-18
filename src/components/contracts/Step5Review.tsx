"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useContractStore } from "@/store/contractStore";
import type { DepositSplit } from "@/store/contractStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  formatCurrency,
  formatDate,
  generateContractNumber,
  calculateMinDeposit,
} from "@/lib/utils";

const PAYMENT_METHODS = [
  { value: "credit_card", label: "Credit Card" },
  { value: "debit_card", label: "Debit Card" },
  { value: "ach", label: "ACH / Check" },
  { value: "cash", label: "Cash" },
] as const;

interface Step5ReviewProps {
  onNext: () => void;
}

export default function Step5Review({ onNext }: Step5ReviewProps) {
  const router = useRouter();
  const { draft, addDepositSplit, removeDepositSplit, updateLineItemSerial, setNotes } = useContractStore();

  const contractNumber = useMemo(() => generateContractNumber(), []);
  const today = useMemo(() => formatDate(new Date()), []);
  const suggestedDeposit = useMemo(() => calculateMinDeposit(draft.total), [draft.total]);

  const [savingQuote, setSavingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  async function handleSaveQuote() {
    setSavingQuote(true);
    setQuoteError(null);
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to save quote");
      }
      const { quote_id } = await res.json();
      router.push(`/quotes/${quote_id}`);
    } catch (err: any) {
      setQuoteError(err.message ?? "Something went wrong");
      setSavingQuote(false);
    }
  }

  // Split builder state
  const [splitAmount, setSplitAmount] = useState("");
  const [splitMethod, setSplitMethod] = useState<string>("credit_card");
  const [checkNumber, setCheckNumber] = useState("");
  const [bankName, setBankName] = useState("");

  const splits = Array.isArray(draft.deposit_splits) ? draft.deposit_splits : [];
  const totalSplits = splits.reduce((sum, s) => sum + s.amount, 0);

  // Only GreenSky/WF (deduct_from_balance !== false) reduce balance at POS
  // Foundation carries to balance and is NOT deducted here
  const financingArr = Array.isArray(draft.financing) ? draft.financing : [];
  const financedAtSale = financingArr
    .filter((f) => f.deduct_from_balance !== false)
    .reduce((sum, f) => sum + f.financed_amount, 0);
  const foundationTotal = financingArr
    .filter((f) => f.deduct_from_balance === false)
    .reduce((sum, f) => sum + f.financed_amount, 0);

  const remaining = Math.max(0, draft.total - financedAtSale - totalSplits);

  const splitAmountNum = parseFloat(splitAmount) || 0;
  const canAddSplit = splitAmountNum > 0;
  const canProceed = splits.length > 0;

  function handleAddSplit() {
    if (!canAddSplit) return;
    const split: DepositSplit = {
      amount: splitAmountNum,
      method: splitMethod,
      ...(splitMethod === "ach" && checkNumber ? { check_number: checkNumber } : {}),
      ...(splitMethod === "ach" && bankName ? { bank_name: bankName } : {}),
    };
    addDepositSplit(split);
    setSplitAmount("");
    setCheckNumber("");
    setBankName("");
  }

  const methodLabel = (method: string) =>
    PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method.replace(/_/g, " ");

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* ── Step label ─────────────────────────────────────── */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-[#00929C] font-bold">Step 5 of 8</p>
        <h2 className="text-2xl font-black text-slate-900 mt-1">Review &amp; Quote</h2>
        <p className="text-sm text-slate-500 mt-1">
          Double-check every line. You can save as a quote or continue to signature.
        </p>
      </div>

      {/* ── Contract header card ──────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Contract Review</CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Review all details before collecting signature
              </p>
            </div>
            <Badge variant="accent" className="text-sm px-3 py-1">
              {contractNumber}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Date</span>
              <p className="font-medium">{today}</p>
            </div>
            <div>
              <span className="text-slate-500">Show</span>
              <p className="font-medium">{draft.show?.name ?? "N/A"}</p>
            </div>
            <div>
              <span className="text-slate-500">Location</span>
              <p className="font-medium">{draft.location?.name ?? "N/A"}</p>
            </div>
            <div>
              <span className="text-slate-500">Sales Rep</span>
              <p className="font-medium">Current User</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Customer ───────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Customer</CardTitle>
        </CardHeader>
        <CardContent>
          {draft.customer ? (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Name</span>
                <p className="font-medium">
                  {draft.customer.first_name} {draft.customer.last_name}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Email</span>
                <p className="font-medium">{draft.customer.email}</p>
              </div>
              <div>
                <span className="text-slate-500">Phone</span>
                <p className="font-medium">{draft.customer.phone}</p>
              </div>
              <div>
                <span className="text-slate-500">Address</span>
                <p className="font-medium">
                  {draft.customer.address}, {draft.customer.city},{" "}
                  {draft.customer.state} {draft.customer.zip}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">No customer selected</p>
          )}
        </CardContent>
      </Card>

      {/* ── Line Items ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Line Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Product</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Serial #</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">MSRP</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">Sell Price</th>
                </tr>
              </thead>
              <tbody>
                {draft.line_items.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="py-3 px-4 font-medium">{item.product_name}</td>
                    <td className="py-2 px-4">
                      <input
                        type="text"
                        value={item.serial_number ?? ""}
                        onChange={(e) => updateLineItemSerial(idx, e.target.value)}
                        placeholder="Enter serial #"
                        className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00929C] touch-manipulation"
                      />
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500">
                      {formatCurrency(item.msrp)}
                    </td>
                    <td className="py-3 px-4 text-right font-medium">
                      {formatCurrency(item.sell_price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Discounts ──────────────────────────────────────── */}
      {draft.discounts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Discounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-100">
              {draft.discounts.map((discount, idx) => (
                <div key={idx} className="flex justify-between py-2 text-sm">
                  <span>{discount.label}</span>
                  <span className="text-red-600 font-medium">
                    -{formatCurrency(discount.amount)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Financing ──────────────────────────────────────── */}
      {draft.financing.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Financing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {draft.financing.map((entry, i) => (
              <div key={i} className={`text-sm ${i > 0 ? "border-t border-slate-100 pt-3" : ""}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-slate-900">{entry.financer_name}</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      Plan {entry.plan_number}
                      {entry.approval_number ? ` · Approval: ${entry.approval_number}` : ""}
                    </p>
                  </div>
                  <span className="font-semibold text-slate-900">{formatCurrency(entry.financed_amount)}</span>
                </div>
              </div>
            ))}
            <div className="border-t border-slate-200 pt-3 flex justify-between text-sm font-semibold">
              <span className="text-slate-600">Total Financed</span>
              <span>{formatCurrency(draft.financing.reduce((s, f) => s + f.financed_amount, 0))}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Totals ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Order Totals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal</span>
              <span className="font-medium">{formatCurrency(draft.subtotal)}</span>
            </div>

            {draft.discount_total > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600">Discounts</span>
                <span className="text-red-600 font-medium">
                  -{formatCurrency(draft.discount_total)}
                </span>
              </div>
            )}

            {(() => {
              const waivedValue = draft.line_items
                .filter((i) => i.waived)
                .reduce((sum, i) => sum + i.msrp * i.quantity, 0);
              return waivedValue > 0 ? (
                <div className="flex justify-between">
                  <span className="text-emerald-700 font-medium">Included Free</span>
                  <span className="text-emerald-700 font-medium">{formatCurrency(waivedValue)} value</span>
                </div>
              ) : null;
            })()}

            <div className="flex justify-between items-center">
              <span className="text-slate-600">
                Tax ({(draft.tax_rate * 100).toFixed(2)}%)
              </span>
              <div className="flex items-center gap-2">
                {draft.tax_exempt && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    EXEMPT
                  </span>
                )}
                <span className={`font-medium ${draft.tax_exempt ? "line-through text-slate-400" : ""}`}>
                  {formatCurrency(draft.tax_amount)}
                </span>
                {draft.tax_exempt && (
                  <span className="font-medium text-emerald-700">{formatCurrency(0)}</span>
                )}
              </div>
            </div>

            {draft.surcharge_enabled && draft.surcharge_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600">
                  CC Surcharge ({(draft.surcharge_rate * 100).toFixed(1)}%)
                </span>
                <span className="font-medium">
                  {formatCurrency(draft.surcharge_amount)}
                </span>
              </div>
            )}

            <div className="border-t border-slate-200 pt-3 mt-3">
              <div className="flex justify-between text-lg font-bold text-[#00929C]">
                <span>Total</span>
                <span>{formatCurrency(draft.total)}</span>
              </div>
            </div>

            <div className="flex justify-between text-sm text-slate-500 pt-1">
              <span>Suggested deposit (30%)</span>
              <span>{formatCurrency(suggestedDeposit)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Deposits ───────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Deposits to Collect</CardTitle>
            {splits.length > 0 && (
              <span className="text-sm font-semibold text-[#00929C]">
                {formatCurrency(totalSplits)} collected
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Financing deductions — GreenSky/WF only (paper contract style) */}
          {financedAtSale > 0 && (
            <div className="space-y-2">
              {financingArr
                .filter((f) => f.deduct_from_balance !== false)
                .map((f, i) => (
                  <div key={i} className="flex items-center justify-between bg-[#00929C]/5 border border-[#00929C]/20 rounded-xl px-4 py-3">
                    <div>
                      <p className="font-semibold text-slate-900">{f.financer_name}</p>
                      <p className="text-xs text-slate-500">Financed at POS — deducted from balance</p>
                    </div>
                    <span className="font-semibold text-[#00929C]">{formatCurrency(f.financed_amount)}</span>
                  </div>
                ))}
            </div>
          )}

          {/* Foundation — carries to balance notice */}
          {foundationTotal > 0 && (
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <div>
                <p className="font-semibold text-slate-900">
                  {financingArr.filter((f) => f.deduct_from_balance === false).map((f) => f.financer_name).join(", ")}
                </p>
                <p className="text-xs text-amber-700">Run after sale — carries to balance due</p>
              </div>
              <span className="font-semibold text-amber-700">{formatCurrency(foundationTotal)}</span>
            </div>
          )}

          {/* Added deposit splits */}
          {splits.length > 0 && (
            <div className="space-y-2">
              {splits.map((split, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{formatCurrency(split.amount)}</p>
                    <p className="text-xs text-slate-500">
                      {methodLabel(split.method)}
                      {split.check_number ? ` · Check #${split.check_number}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDepositSplit(i)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Balance due at delivery */}
          {(splits.length > 0 || financedAtSale > 0) && (
            <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
              <span className="font-semibold text-slate-700">Balance due at delivery</span>
              <span className={`text-lg font-bold ${remaining === 0 ? "text-emerald-600" : "text-amber-700"}`}>
                {formatCurrency(remaining)}
              </span>
            </div>
          )}

          {/* Add split form */}
          <div className="space-y-3 pt-1">
            <Input
              label={splits.length === 0 ? "Deposit Amount ($)" : "Add Another ($)"}
              type="number"
              min="0.01"
              step="0.01"
              value={splitAmount}
              onChange={(e) => setSplitAmount(e.target.value)}
              placeholder={remaining > 0 ? remaining.toFixed(2) : "0.00"}
            />

            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setSplitMethod(m.value)}
                  className={`h-12 rounded-full text-sm font-semibold transition-all touch-manipulation ${
                    splitMethod === m.value
                      ? "bg-[#00929C] text-white shadow-md"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {splitMethod === "ach" && (
              <div className="space-y-2">
                <Input
                  label="Check # (optional)"
                  type="text"
                  value={checkNumber}
                  onChange={(e) => setCheckNumber(e.target.value)}
                  placeholder="Check number"
                />
                <Input
                  label="Bank Name (optional)"
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Bank name"
                />
              </div>
            )}

            <Button
              variant="outline"
              size="lg"
              className="w-full"
              disabled={!canAddSplit}
              onClick={handleAddSplit}
            >
              + Add {splitAmount ? formatCurrency(parseFloat(splitAmount) || 0) : "Payment"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Notes ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            value={draft.notes ?? ""}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes about this contract..."
            rows={3}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00929C] focus:border-transparent touch-manipulation resize-none"
          />
        </CardContent>
      </Card>

      {/* ── Actions ────────────────────────────────────────── */}
      {quoteError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-700">{quoteError}</p>
        </div>
      )}

      {/* Save Quote — always available once there are line items */}
      <Button
        variant="outline"
        size="xl"
        className="w-full text-lg border-[#00929C] text-[#00929C] hover:bg-[#00929C]/5"
        disabled={savingQuote || draft.line_items.length === 0}
        onClick={handleSaveQuote}
      >
        {savingQuote ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Saving Quote…
          </span>
        ) : (
          <>
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save Quote
          </>
        )}
      </Button>

      {/* Continue to Contract — requires at least one deposit */}
      <Button
        variant="accent"
        size="xl"
        className="w-full text-lg"
        disabled={!canProceed || savingQuote}
        onClick={onNext}
      >
        Sign &amp; Pay Now &rarr;
      </Button>

      {!canProceed && (
        <p className="text-center text-sm text-slate-400">
          Add at least one deposit to sign &amp; pay, or save as a quote to print
        </p>
      )}
    </div>
  );
}
