"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function PortalLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) { setError(authError.message); return; }
      window.location.href = "/portal/dashboard";
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#010F21] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Atlas Spas" className="h-12 w-auto mx-auto bg-white rounded-lg px-3 py-1" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <p className="text-white/60 text-sm mt-3">Customer Portal</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h1 className="text-xl font-bold text-slate-900 mb-1">Sign In</h1>
          <p className="text-sm text-slate-500 mb-6">Access your contract and track your order</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C]"
                placeholder="you@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C]"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-[#00929C] text-white font-bold text-base hover:bg-[#007279] transition-colors disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-center">
            <p className="text-sm text-slate-500">
              New customer?{" "}
              <Link href="/portal/register" className="text-[#00929C] font-semibold">
                Create account
              </Link>
            </p>
            <Link href="/auth/forgot-password" className="block text-sm text-slate-400 hover:text-[#00929C] transition-colors">
              Forgot password?
            </Link>
          </div>
        </div>

        <p className="text-center text-white/30 text-xs mt-6">
          Atlas Spas & Swim Spas · 5511 Hwy 31 W · Tyler, TX 75709
        </p>
      </div>
    </div>
  );
}
