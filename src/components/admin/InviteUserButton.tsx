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

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
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
