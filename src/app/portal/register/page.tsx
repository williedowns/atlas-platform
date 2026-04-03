"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function PortalRegisterPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { first_name: firstName, last_name: lastName, role: "customer" },
          emailRedirectTo: `${window.location.origin}/portal/dashboard`,
        },
      });
      if (authError) { setError(authError.message); return; }
      setSuccess(true);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#010F21] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Check Your Email</h2>
          <p className="text-slate-500 text-sm">We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.</p>
          <Link href="/portal/login" className="block mt-6 text-[#00929C] font-semibold text-sm">Back to Sign In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#010F21] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Atlas Spas" className="h-12 w-auto mx-auto bg-white rounded-lg px-3 py-1" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <p className="text-white/60 text-sm mt-3">Customer Portal</p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h1 className="text-xl font-bold text-slate-900 mb-1">Create Account</h1>
          <p className="text-sm text-slate-500 mb-6">Track your order and manage your purchase</p>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">First Name</label>
                <input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full h-12 px-4 rounded-xl border border-slate-200 text-base focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Last Name</label>
                <input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full h-12 px-4 rounded-xl border border-slate-200 text-base focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C]" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-12 px-4 rounded-xl border border-slate-200 text-base focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C]" placeholder="you@email.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full h-12 px-4 rounded-xl border border-slate-200 text-base focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C]" placeholder="Min 8 characters" />
            </div>
            {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3"><p className="text-sm text-red-700">{error}</p></div>}
            <button type="submit" disabled={loading} className="w-full h-12 rounded-xl bg-[#00929C] text-white font-bold text-base hover:bg-[#007279] transition-colors disabled:opacity-50">
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>
          <p className="text-center text-sm text-slate-500 mt-6">Already have an account? <Link href="/portal/login" className="text-[#00929C] font-semibold">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}
