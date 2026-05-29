"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UserActiveToggle({
  userId,
  userName,
  active,
  currentUserId,
}: {
  userId: string;
  userName: string;
  active: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // An admin can't disable themselves — hide the control on their own row.
  if (userId === currentUserId) return null;

  async function apply(next: boolean) {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: next }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to update user");
      return;
    }
    setConfirming(false);
    router.refresh();
  }

  if (active) {
    return (
      <>
        <button
          onClick={() => setConfirming(true)}
          disabled={loading}
          title="Disable user (blocks login, keeps their data)"
          className="ml-1 p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </button>

        {confirming && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setConfirming(false); }}
          >
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4">
              <h2 className="text-base font-bold text-slate-900">Disable {userName}?</h2>
              <p className="text-sm text-slate-600">
                They will no longer be able to sign in and won&apos;t appear when
                assigning deals. All of their existing contracts, commissions, and
                history stay intact. You can re-enable them anytime.
              </p>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirming(false)}
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={() => apply(false)}
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-40"
                >
                  {loading ? "Disabling…" : "Disable"}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Disabled → offer re-enable inline (no confirm needed; it restores access).
  return (
    <button
      onClick={() => apply(true)}
      disabled={loading}
      title="Re-enable user"
      className="ml-1 px-2 py-1 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors disabled:opacity-40"
    >
      {loading ? "…" : "Enable"}
    </button>
  );
}
