"use client";

import { useState, useMemo } from "react";
import { useContractStore } from "@/store/contractStore";
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

interface Step4ReviewProps {
  onNext: () => void;
}

export default function Step4Review({ onNext }: Step4ReviewProps) {
  const { draft, updateLineItemSerial, setDepositAmount, setPaymentMethod, setNotes } =
    useContractStore();

  const contractNumber = useMemo(() => generateContractNumber(), []);
  const today = useMemo(() => formatDate(new Date()), []);
  const minDeposit = useMemo(() => calculateMinDeposit(draft.total), [draft.total]);

  const [depositInput, setDepositInput] = useState<string>(
    (draft.deposit_amount > 0 ? draft.deposit_amount : minDeposit).toFixed(2)
  );

  const handleDepositChange = (value: string) => {
    setDepositInput(value);
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) {
      const clamped = Math.max(parsed, minDeposit);
      setDepositAmount(clamped);
    }
  };

  const handleDepositBlur = () => {
    const parsed = parseFloat(depositInput);
    if (isNaN(parsed) || parsed < minDeposit) {
      setDepositInput(minDeposit.toFixed(2));
      setDepositAmount(minDeposit);
    } else {
      setDepositInput(parsed.toFixed(2));
      setDepositAmount(parsed);
    }
  };

  const canProceed = !!draft.payment_method;

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* ── Header ─────────────────────────────────────────── */}
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

            <div className="flex justify-between">
              <span className="text-slate-600">
                Tax ({(draft.tax_rate * 100).toFixed(2)}%)
              </span>
              <span className="font-medium">{formatCurrency(draft.tax_amount)}</span>
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

            <div className="flex justify-between text-base font-semibold pt-1">
              <span>Deposit Required (30%)</span>
              <span>{formatCurrency(minDeposit)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Deposit Amount ─────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Deposit Amount</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <Input
              label="Deposit to Collect"
              type="number"
              min={minDeposit}
              step="0.01"
              value={depositInput}
              onChange={(e) => handleDepositChange(e.target.value)}
              onBlur={handleDepositBlur}
            />
            <p className="text-xs text-slate-500">
              Minimum deposit: {formatCurrency(minDeposit)} (30% of total)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Payment Method ─────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Payment Method</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method.value}
                type="button"
                onClick={() => setPaymentMethod(method.value)}
                className={`h-14 rounded-full text-base font-semibold transition-all touch-manipulation ${
                  draft.payment_method === method.value
                    ? "bg-[#00929C] text-white shadow-md"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {method.label}
              </button>
            ))}
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

      {/* ── Continue Button ────────────────────────────────── */}
      <Button
        variant="accent"
        size="xl"
        className="w-full text-lg"
        disabled={!canProceed}
        onClick={onNext}
      >
        Proceed to Signature &rarr;
      </Button>

      {!canProceed && (
        <p className="text-center text-sm text-slate-400">
          Please select a payment method to continue
        </p>
      )}
    </div>
  );
}
