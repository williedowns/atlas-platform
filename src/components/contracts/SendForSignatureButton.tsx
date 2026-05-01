"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface SendForSignatureButtonProps {
  contractId: string;
  hasCustomerEmail: boolean;
}

interface SendResult {
  ok: true;
  signing_url: string;
  expires_at: string;
  email_sent: boolean;
  email_error: string | null;
  customer_email: string;
}

export function SendForSignatureButton({ contractId, hasCustomerEmail }: SendForSignatureButtonProps) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/contracts/${contractId}/send-for-signature`, {
        method: "POST",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error ?? `Send failed (${res.status})`);
      }
      setResult(body as SendResult);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  const copyUrl = async () => {
    if (!result?.signing_url) return;
    try {
      await navigator.clipboard.writeText(result.signing_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  if (result) {
    return (
      <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4 space-y-3">
        <div>
          <p className="text-sm font-bold text-emerald-900">
            {result.email_sent
              ? `Sent to ${result.customer_email}`
              : "Link generated (email not sent)"}
          </p>
          {!result.email_sent && (
            <p className="text-xs text-emerald-800 mt-1">
              {result.email_error
                ? `Email error: ${result.email_error}.`
                : ""}{" "}
              Copy the link below and send it manually via SMS or another channel.
            </p>
          )}
          <p className="text-xs text-emerald-800 mt-1">
            Expires: {new Date(result.expires_at).toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg bg-white border border-emerald-200 p-2 break-all text-xs text-slate-700 font-mono">
          {result.signing_url}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyUrl} className="flex-1">
            {copied ? "Copied!" : "Copy Link"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setResult(null)} className="flex-1">
            Resend / Rotate
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!hasCustomerEmail && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Customer has no email on file. Add one to the customer record before sending.
        </p>
      )}
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        disabled={sending || !hasCustomerEmail}
        onClick={send}
      >
        {sending ? "Sending…" : "Send for Remote Signature"}
      </Button>
      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
