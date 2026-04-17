"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function PingButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null);

  async function handlePing() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/avalara/ping", { method: "POST" });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ ok: false });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="sm" onClick={handlePing} loading={loading}>
        Test Connection
      </Button>
      {result && (
        <span className={`text-sm ${result.ok ? "text-emerald-600" : "text-red-600"}`}>
          {result.ok ? "✓ Connected" : `✗ Failed${result.error ? `: ${result.error}` : ""}`}
        </span>
      )}
    </div>
  );
}
