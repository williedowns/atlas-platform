"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface DeleteContractButtonProps {
  contractId: string;
  contractNumber: string;
}

export function DeleteContractButton({
  contractId,
  contractNumber,
}: DeleteContractButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canConfirm = confirmText.trim() === contractNumber;

  const handleDelete = async () => {
    if (!canConfirm) return;
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/contracts/${contractId}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setError(data?.error ?? "Failed to delete contract.");
      setLoading(false);
      return;
    }

    router.push("/contracts");
    router.refresh();
  };

  if (!open) {
    return (
      <Button
        variant="outline"
        size="lg"
        className="w-full border-red-300 text-red-700 hover:bg-red-50"
        onClick={() => setOpen(true)}
      >
        Delete Contract (Admin)
      </Button>
    );
  }

  return (
    <div className="rounded-xl border-2 border-red-300 bg-red-50 p-5 space-y-4">
      <div>
        <h3 className="font-bold text-red-900 text-lg">
          Permanently delete {contractNumber}?
        </h3>
        <p className="text-sm text-red-700 mt-1">
          This removes the contract from the database — payments, delivery work
          orders, and child add-ons will also be removed. Inventory units are
          released back to stock. <strong>This cannot be undone.</strong> Use
          cancel for real contracts; delete is for test data and stray quotes.
        </p>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 block mb-1">
          Type <span className="font-mono font-bold">{contractNumber}</span> to confirm
        </label>
        <input
          type="text"
          autoComplete="off"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-400"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={contractNumber}
        />
      </div>

      {error && (
        <p className="text-sm text-red-800 bg-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-3">
        <Button
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={() => {
            setOpen(false);
            setError(null);
            setConfirmText("");
          }}
          disabled={loading}
        >
          Keep Contract
        </Button>
        <Button
          variant="destructive"
          size="lg"
          className="flex-1"
          onClick={handleDelete}
          loading={loading}
          disabled={loading || !canConfirm}
        >
          {loading ? "Deleting…" : "Permanently Delete"}
        </Button>
      </div>
    </div>
  );
}
