"use client";

import { useState } from "react";

export function SetPasswordButton({
  userId,
  userName,
  currentUserId,
}: {
  userId: string;
  userName: string;
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Admins can't set their own password here
  if (userId === currentUserId) return null;

  function handleOpen() {
    setOpen(true);
    setPassword("");
    setConfirm("");
    setError(null);
    setSuccess(false);
  }

  function handleClose() {
    setOpen(false);
    setPassword("");
    setConfirm("");
    setError(null);
    setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/admin/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to set password");
      return;
    }

    setSuccess(true);
    setTimeout(handleClose, 1500);
  }

  return (
    <>
      {/* Lock icon button */}
      <button
        onClick={handleOpen}
        title="Set password"
        className="p-1.5 rounded-lg text-slate-400 hover:text-[#00929C] hover:bg-[#00929C]/8 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Set Password</h2>
                <p className="text-sm text-slate-500 mt-0.5">{userName}</p>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {success ? (
              <div className="py-6 text-center">
                <p className="text-3xl mb-2">✅</p>
                <p className="font-semibold text-slate-900">Password updated</p>
                <p className="text-sm text-slate-500 mt-1">They can now sign in with the new password.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">New Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    autoFocus
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00929C]/40 focus:border-[#00929C]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Confirm Password</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repeat password"
                    required
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00929C]/40 focus:border-[#00929C]"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading || !password || !confirm}
                  className="w-full bg-[#00929C] hover:bg-[#007a82] disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                >
                  {loading ? "Saving…" : "Set Password"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
