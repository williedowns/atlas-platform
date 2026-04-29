"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const DEMO_EMAIL = "demo@atlasspas.com";
export const DEMO_PASSWORD = "demo2026";

export interface DealerLoginFormProps {
  /** When true the demo banner + pre-filled credentials show on mount. */
  demoMode: boolean;
}

export function DealerLoginForm({ demoMode }: DealerLoginFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (demoMode) {
      setEmail(DEMO_EMAIL);
      setPassword(DEMO_PASSWORD);
    }
  }, [demoMode]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Clear any leftover contract draft from a prior rep on this device.
      // Belt-and-suspenders alongside the signOut clear in AppShell — covers
      // direct logins on a shared iPad where the prior session was abandoned
      // without an explicit signOut. Audit fix 2026-04-29.
      if (typeof window !== "undefined") {
        try { window.localStorage.removeItem("atlas-contract-draft-v4"); } catch {}
      }
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen bg-[#010F21] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {demoMode && (
          <div className="flex justify-center mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-amber-300 text-[10px] font-bold uppercase tracking-[0.25em]">
                Demo Mode · Credentials Pre-filled
              </span>
            </div>
          </div>
        )}

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-white rounded-2xl px-8 py-5 shadow-xl mb-3">
            <img src="/logo.png" alt="Atlas Spas & Swim Spas" className="h-14 w-auto" />
          </div>
          <p className="text-white/50 text-xs mt-1 tracking-wide uppercase">
            {process.env.NEXT_PUBLIC_COMPANY_NAME ?? "Atlas Spas"}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-slate-900 mb-6">Sign in</h2>

          {demoMode && (
            <div className="mb-5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
              <p className="text-xs text-amber-800">
                <span className="font-bold">Demo:</span> This is a live demonstration of
                the Atlas Spas dealer platform running on real company data. Click Sign In
                to explore.
              </p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@atlasspas.com"
              required
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <Button type="submit" className="w-full" size="xl" loading={loading}>
              Sign In
            </Button>
          </form>

          {/* Demo Credentials button hidden on the main /login page.
              The /demo route still pre-fills credentials via demoMode=true
              for sales-pitch sessions if needed. */}

          <div className="mt-4 text-center">
            <Link
              href="/auth/forgot-password"
              className="text-sm text-slate-400 hover:text-[#00929C] transition-colors"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <p className="text-center text-white/50 text-xs mt-6">
          Powered by {process.env.NEXT_PUBLIC_PLATFORM_NAME ?? "Salta"}
        </p>
      </div>
    </div>
  );
}
