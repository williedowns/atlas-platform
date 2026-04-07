"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ROLES = [
  { value: "sales_rep", label: "Sales Rep" },
  { value: "manager", label: "Manager" },
  { value: "bookkeeper", label: "Bookkeeper" },
  { value: "field_crew", label: "Field Crew" },
  { value: "admin", label: "Admin" },
] as const;

export function InviteUserButton({ onInvited }: { onInvited?: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("sales_rep");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loginLink, setLoginLink] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, full_name: fullName, role }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to send invite");
      return;
    }

    setSuccess(true);
    onInvited?.();
    setTimeout(() => {
      setOpen(false);
      setSuccess(false);
      setEmail("");
      setFullName("");
      setRole("sales_rep");
    }, 1500);
  }

  async function handleGetLink() {
    setLinkLoading(true);
    const res = await fetch("/api/admin/generate-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setLinkLoading(false);
    if (res.ok) setLoginLink(data.link);
    else setError(data.error ?? "Failed to generate link");
  }

  async function handleCopyLink() {
    if (!loginLink) return;
    await navigator.clipboard.writeText(loginLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        + Invite
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Invite User</h2>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {success ? (
              <div className="py-6 text-center">
                <p className="text-2xl mb-2">✅</p>
                <p className="font-semibold text-slate-900">Invite sent!</p>
                <p className="text-sm text-slate-500 mt-1">{email}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Email"
                  type="email"
                  required
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Input
                  label="Full Name (optional)"
                  type="text"
                  placeholder="Jane Smith"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />

                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Role</p>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLES.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setRole(r.value)}
                        className={`px-3 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                          role === r.value
                            ? "border-[#00929C] bg-[#00929C]/8 text-[#00929C]"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {error && !loginLink && (
                  <div className="space-y-2">
                    <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                    {error.includes("already exists") && (
                      <button
                        type="button"
                        onClick={handleGetLink}
                        disabled={linkLoading}
                        className="w-full py-2.5 rounded-xl border-2 border-[#00929C] text-[#00929C] text-sm font-semibold hover:bg-[#00929C]/8 transition-colors disabled:opacity-50"
                      >
                        {linkLoading ? "Generating…" : "Get login link instead (no email)"}
                      </button>
                    )}
                  </div>
                )}
                {loginLink && (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600">
                      Send this link to <strong>{email}</strong> via text or Slack:
                    </p>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 break-all text-xs text-slate-700 font-mono">
                      {loginLink}
                    </div>
                    <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                      ⚠️ Expires in 24 hours.
                    </p>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors ${linkCopied ? "bg-emerald-500 text-white" : "bg-[#00929C] hover:bg-[#007a82] text-white"}`}
                    >
                      {linkCopied ? "✓ Copied!" : "Copy Link"}
                    </button>
                  </div>
                )}

                <Button
                  type="submit"
                  variant="accent"
                  size="lg"
                  className="w-full"
                  disabled={loading || !email}
                >
                  {loading ? "Sending…" : "Send Invite"}
                </Button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
