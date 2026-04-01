"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SyncProductsButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ synced?: number; errors?: number } | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/qbo/sync-products", { method: "POST" });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ errors: 1 });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="sm" onClick={handleSync} loading={loading}>
        Sync Products Now
      </Button>
      {result && (
        <span className="text-sm text-slate-600">
          {result.synced !== undefined
            ? `✓ ${result.synced} synced${result.errors ? `, ${result.errors} errors` : ""}`
            : "Sync failed"}
        </span>
      )}
    </div>
  );
}
