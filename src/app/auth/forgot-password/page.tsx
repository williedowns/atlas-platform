"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        setSent(true);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
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
                If <strong>{email}</strong> has an account, we&apos;ve sent a password reset link. Click the link in that email to set your password.
              </p>
              <p className="text-xs text-slate-400 pt-2">
                Don&apos;t see it? Check your spam folder.
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
                  Enter your email and we&apos;ll send you a link to set a new password.
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
