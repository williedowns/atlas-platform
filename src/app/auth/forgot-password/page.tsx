"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div className="min-h-screen bg-[#010F21] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-white rounded-2xl px-8 py-5 shadow-xl mb-3">
            <img src="/logo.png" alt="Atlas Spas & Swim Spas" className="h-14 w-auto" />
          </div>
          <p className="text-white/50 text-xs mt-1 tracking-wide uppercase">Sales Platform</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          {sent ? (
            <div className="text-center space-y-3">
              <div className="text-4xl">📬</div>
              <h2 className="text-xl font-semibold text-slate-900">Check your email</h2>
              <p className="text-sm text-slate-500">
                We sent a password reset link to <strong>{email}</strong>. Click the link in that email to set your password.
              </p>
              <p className="text-xs text-slate-400 pt-2">
                If you don&apos;t see it, check your spam folder.
              </p>
              <Link href="/login" className="block mt-4 text-sm text-[#00929C] hover:underline">
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-slate-900">Reset your password</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Enter your email and we&apos;ll send you a link to set a new password. Works even if you signed up with GitHub.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@atlasspas.com"
                  required
                  autoFocus
                />

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                )}

                <Button
                  type="submit"
                  className="w-full bg-[#00929C] hover:bg-[#007a82] text-white font-semibold"
                  size="xl"
                  loading={loading}
                  disabled={!email}
                >
                  Send Reset Link
                </Button>
              </form>

              <div className="mt-4 text-center">
                <Link href="/login" className="text-sm text-slate-400 hover:text-[#00929C] transition-colors">
                  ← Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
