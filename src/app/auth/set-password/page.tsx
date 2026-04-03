"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    setError("");

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img
            src="/logo.png"
            alt="Atlas Spas & Swim Spas"
            className="h-10 w-auto bg-[#010F21] rounded px-3 py-1"
          />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Create your password</h1>
            <p className="text-sm text-slate-500 mt-1">
              You&apos;re almost in. Set a password to finish creating your account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                New Password
              </label>
              <Input
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                Confirm Password
              </label>
              <Input
                type="password"
                placeholder="Repeat password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading || !password || !confirm}
              className="w-full bg-[#00929C] hover:bg-[#007a82] text-white font-semibold py-3"
            >
              {loading ? "Setting password…" : "Set Password & Continue →"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
