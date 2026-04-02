"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ContingentToggle({
  contractId,
  isContingent,
}: {
  contractId: string;
  isContingent: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/contracts/${contractId}/contingent`, {
        method: "PATCH",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to update");
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        variant={isContingent ? "outline" : "outline"}
        size="lg"
        className={`w-full ${
          isContingent
            ? "border-[#00929C] text-[#00929C] hover:bg-[#00929C]/5"
            : "border-amber-500 text-amber-600 hover:bg-amber-50"
        }`}
        onClick={handleToggle}
        disabled={loading}
      >
        {loading
          ? "Updating…"
          : isContingent
          ? "✓ Convert to Confirmed Contract"
          : "Mark as Contingent"}
      </Button>
      {error && <p className="text-xs text-red-500 text-center">{error}</p>}
    </div>
  );
}
