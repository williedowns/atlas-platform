"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

interface CancelContractButtonProps {
  contractId: string;
  contractNumber: string;
  depositPaid: number;
}

export function CancelContractButton({ contractId, contractNumber, depositPaid }: CancelContractButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [refundAmount, setRefundAmount] = useState(depositPaid > 0 ? depositPaid.toFixed(2) : "0.00");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCancel = async () => {
    if (!reason.trim()) { setError("Please enter a reason for cancellation."); return; }
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/contracts/${contractId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, refund_amount: parseFloat(refundAmount) || 0 }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setError(data?.error ?? "Failed to cancel contract.");
      setLoading(false);
      return;
    }

    setOpen(false);
    router.refresh();
  };

  if (!open) {
    return (
      <Button
        variant="destructive"
        size="lg"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        Cancel Contract
      </Button>
    );
  }

  return (
    <div className="rounded-xl border-2 border-red-200 bg-red-50 p-5 space-y-4">
      <div>
        <h3 className="font-bold text-red-800 text-lg">Cancel {contractNumber}?</h3>
        <p className="text-sm text-red-600 mt-1">
          This will mark the contract as cancelled and return any inventory units back to stock.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1">Reason for cancellation *</label>
          <textarea
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
            rows={3}
            placeholder="Customer changed mind, duplicate order, etc."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        {depositPaid > 0 && (
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              Refund amount (deposit paid: {formatCurrency(depositPaid)})
            </label>
            <input
              type="number"
              min="0"
              max={depositPaid}
              step="0.01"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-1">
              Refund must be processed manually in QuickBooks or through your payment processor.
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-3">
        <Button
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={() => { setOpen(false); setError(null); }}
          disabled={loading}
        >
          Keep Contract
        </Button>
        <Button
          variant="destructive"
          size="lg"
          className="flex-1"
          onClick={handleCancel}
          loading={loading}
          disabled={loading}
        >
          {loading ? "Cancelling…" : "Confirm Cancel"}
        </Button>
      </div>
    </div>
  );
}
