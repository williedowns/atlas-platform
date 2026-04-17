"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MS_BRAND } from "@/lib/manufacturer/brand";

export default function ManufacturerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("kevin.richards@masterspas.com");
  const [password, setPassword] = useState("••••••••");
  const [loading, setLoading] = useState(false);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => router.push("/manufacturer"), 400);
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: `radial-gradient(ellipse at top, ${MS_BRAND.colors.sidebarBg} 0%, ${MS_BRAND.colors.headerBg} 70%)`,
      }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-4">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-black text-3xl shadow-xl"
              style={{ backgroundColor: MS_BRAND.colors.primary }}
            >
              M
            </div>
            <div className="text-left">
              <div className="text-white text-2xl font-black tracking-tight leading-none">
                MASTER SPAS
              </div>
              <div className="text-white/60 text-xs uppercase tracking-[0.2em] mt-1">
                Dealer Network Portal
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Sign in</h2>
          <p className="text-sm text-slate-500 mb-6">
            Access the real-time dealer network operating system.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-lg text-white font-bold text-sm uppercase tracking-wide transition-all disabled:opacity-60"
              style={{ backgroundColor: MS_BRAND.colors.primary }}
            >
              {loading ? "Signing in..." : "Sign In to Network"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between text-xs">
            <Link href="#" className="text-slate-500 hover:text-slate-700">
              Forgot password?
            </Link>
            <span className="text-slate-400">SSO · Master Spas Identity</span>
          </div>
        </div>

        <p className="text-center text-white/40 text-xs mt-6 uppercase tracking-[0.2em]">
          {MS_BRAND.poweredBy}
        </p>
      </div>
    </div>
  );
}
