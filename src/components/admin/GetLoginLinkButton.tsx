"use client";

import { useState } from "react";

export function GetLoginLinkButton({
  email,
  userId,
  currentUserId,
}: {
  email: string;
  userId: string;
  currentUserId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (userId === currentUserId) return null;

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setLink(null);

    const res = await fetch("/api/admin/generate-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to generate link");
      return;
    }

    setLink(data.link);
  }

  async function handleCopy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <button
        onClick={handleGenerate}
        disabled={loading}
        title="Generate login link (no email)"
        className="ml-1 p-1.5 rounded-lg text-slate-400 hover:text-[#00929C] hover:bg-[#00929C]/8 transition-colors disabled:opacity-40"
      >
        {loading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        )}
      </button>

      {(link || error) && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setLink(null); setError(null); } }}
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Login Link</h2>
              <button
                onClick={() => { setLink(null); setError(null); }}
                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {error ? (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            ) : (
              <>
                <p className="text-sm text-slate-600">
                  Copy this link and send it to <strong>{email}</strong> via text or Slack.
                  No email required.
                </p>

                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 break-all text-xs text-slate-700 font-mono leading-relaxed">
                  {link}
                </div>

                <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  <p className="text-xs text-amber-800">
                    <strong>Expires in 24 hours.</strong> If unused, generate a new link.
                  </p>
                </div>

                <button
                  onClick={handleCopy}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors ${
                    copied
                      ? "bg-emerald-500 text-white"
                      : "bg-[#00929C] hover:bg-[#007a82] text-white"
                  }`}
                >
                  {copied ? "✓ Copied!" : "Copy Link"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
