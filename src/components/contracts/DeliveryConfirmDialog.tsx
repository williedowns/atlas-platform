"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface DeliveryConfirmDialogProps {
  contractId: string;
  contractNumber: string;
  total: number;
  depositPaid: number;
  balanceDue: number;
  taxAmount: number;
  lineItems: { product_name: string; quantity: number; sell_price: number }[];
  onDelivered?: () => void;
}

export function DeliveryConfirmDialog({
  contractId,
  contractNumber,
  total,
  depositPaid,
  balanceDue,
  taxAmount,
  lineItems,
  onDelivered,
}: DeliveryConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const subtotal = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.sell_price,
    0
  );

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/contracts/${contractId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "delivered" }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? "Failed to confirm delivery.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
      onDelivered?.();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <p className="font-semibold text-emerald-800">
            {contractNumber} marked as delivered
          </p>
        </div>
        <p className="text-sm text-emerald-600 mt-1">
          QBO invoice created and deposits applied. Equipment registered.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <Button
        variant="primary"
        size="lg"
        className="w-full bg-[#00929C] hover:bg-[#007A83]"
        onClick={() => setOpen(true)}
      >
        <svg className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Mark as Delivered
      </Button>
    );
  }

  return (
    <div className="rounded-xl border-2 border-[#00929C]/30 bg-slate-50 p-5 space-y-4">
      {/* Header */}
      <div>
        <h3 className="font-bold text-slate-900 text-lg">Confirm Delivery</h3>
        <p className="text-sm text-slate-500 mt-1">
          Review the financial summary for {contractNumber} before confirming.
        </p>
      </div>

      {/* Financial Summary Card */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          {/* Line Items */}
          <div className="space-y-1.5">
            {lineItems.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-slate-600">
                  {item.product_name}
                  {item.quantity > 1 && (
                    <span className="text-slate-400 ml-1">x{item.quantity}</span>
                  )}
                </span>
                <span className="text-slate-700 font-medium">
                  {formatCurrency(item.quantity * item.sell_price)}
                </span>
              </div>
            ))}
          </div>

          <hr className="border-slate-200" />

          {/* Subtotal */}
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span className="text-slate-700">{formatCurrency(subtotal)}</span>
          </div>

          {/* Sales Tax */}
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Sales Tax</span>
            <span className="text-slate-700">{formatCurrency(taxAmount)}</span>
          </div>

          <hr className="border-slate-200" />

          {/* Total */}
          <div className="flex justify-between">
            <span className="font-bold text-slate-900">Total</span>
            <span className="font-bold text-slate-900 text-lg">
              {formatCurrency(total)}
            </span>
          </div>

          {/* Deposits Collected */}
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Deposits Collected</span>
            <span className="font-semibold text-emerald-600">
              -{formatCurrency(depositPaid)}
            </span>
          </div>

          <hr className="border-slate-200" />

          {/* Balance Due */}
          <div className="flex justify-between items-center">
            <span className="font-bold text-slate-900">Balance Due</span>
            {balanceDue > 0 ? (
              <span className="font-bold text-red-600 text-xl">
                {formatCurrency(balanceDue)}
              </span>
            ) : (
              <span className="font-bold text-emerald-600 text-lg">
                PAID IN FULL
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Balance Warning / Confirmation */}
      {balanceDue > 0 ? (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <svg className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-amber-800">
            Collect remaining balance of{" "}
            <span className="font-semibold">{formatCurrency(balanceDue)}</span>{" "}
            at delivery
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
          <svg className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-emerald-700">No remaining balance</p>
        </div>
      )}

      {/* What happens on confirm */}
      <div className="rounded-lg bg-slate-100 px-4 py-3 space-y-1.5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          What happens on confirm
        </p>
        <ul className="text-sm text-slate-600 space-y-1">
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00929C] shrink-0" />
            QBO final invoice will be created
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00929C] shrink-0" />
            Deposits will be applied to the invoice
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00929C] shrink-0" />
            Sales tax will be filed via Avalara
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00929C] shrink-0" />
            Equipment will be registered
          </li>
        </ul>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-700 bg-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          size="lg"
          className="flex-1 bg-[#00929C] hover:bg-[#007A83]"
          onClick={handleConfirm}
          loading={loading}
          disabled={loading}
        >
          {loading ? "Processing..." : "Confirm Delivery"}
        </Button>
      </div>
    </div>
  );
}
