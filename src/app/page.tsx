export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Salta — The modern sales platform for hot tub dealers",
  description:
    "Digital contracts, instant financing, and real-time analytics — all from an iPad. Built for high-volume hot tub show sales.",
  openGraph: {
    title: "Salta — The modern sales platform for hot tub dealers",
    description:
      "Digital contracts, instant financing, and real-time analytics — all from an iPad. Close deals faster at every show.",
    url: "https://www.getsalta.com",
    siteName: "Salta",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Salta — The modern sales platform for hot tub dealers",
    description:
      "Digital contracts, instant financing, and real-time analytics — all from an iPad. Close deals faster at every show.",
  },
};
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* Nav */}
      <nav className="bg-[#010F21] px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/salta-logo-white.svg" alt="Salta" className="h-8 w-auto" />
        <Link
          href="/login"
          className="text-sm font-semibold text-white hover:text-[#00929C] transition-colors flex items-center gap-1"
        >
          Sign In
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </Link>
      </nav>

      {/* Hero */}
      <section className="bg-[#010F21] px-6 py-20 md:py-32 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-[#00929C]/20 border border-[#00929C]/40 rounded-full px-4 py-1.5 mb-8">
            <span className="w-2 h-2 rounded-full bg-[#00929C]" />
            <span className="text-[#00929C] text-sm font-medium">Built for the show floor</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
            The modern sales platform
            <br />
            <span className="text-[#00929C]">for hot tub dealers</span>
          </h1>
          <p className="text-slate-400 text-lg md:text-xl mb-10 max-w-xl mx-auto">
            Digital contracts, instant financing, and real-time analytics — all from an iPad. Close deals faster at every show.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="mailto:hello@getsalta.com"
              className="w-full sm:w-auto bg-[#00929C] hover:bg-[#007a82] text-white font-semibold px-8 py-4 rounded-xl transition-colors text-base"
            >
              Book a Demo
            </a>
            <Link
              href="/login"
              className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-4 rounded-xl transition-colors text-base border border-white/20"
            >
              Sign In →
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Everything your team needs on the floor
            </h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              Salta replaces clipboards, carbon copy contracts, and disconnected spreadsheets with one seamless platform.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

            {/* Digital Contracts */}
            <div className="bg-slate-50 rounded-2xl p-6 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-[#00929C]/10 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-[#00929C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Digital Contracts</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Sign on iPad — no printer, no paper, no hassle. Contracts emailed instantly.
              </p>
            </div>

            {/* Sales Analytics */}
            <div className="bg-slate-50 rounded-2xl p-6 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-[#00929C]/10 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-[#00929C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Sales Analytics</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Real-time leaderboards, revenue by show, and rep performance — all in one dashboard.
              </p>
            </div>

            {/* Customer Portal */}
            <div className="bg-slate-50 rounded-2xl p-6 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-[#00929C]/10 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-[#00929C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Customer Portal</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Buyers access their contract, delivery details, and documents anytime from any device.
              </p>
            </div>

            {/* QuickBooks Sync */}
            <div className="bg-slate-50 rounded-2xl p-6 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-[#00929C]/10 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-[#00929C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">QuickBooks Sync</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Sales flow automatically into QuickBooks Online — no double entry, no reconciliation headaches.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-[#010F21] px-6 py-20 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-5">
            Built for the spa show floor
          </h2>
          <p className="text-slate-400 text-lg mb-10">
            Salta was designed from the ground up for high-volume show sales events. Fast product lookup, on-the-spot financing, and instant contract generation — all optimized for iPad.
          </p>
          <a
            href="mailto:hello@getsalta.com"
            className="inline-block bg-[#00929C] hover:bg-[#007a82] text-white font-semibold px-10 py-4 rounded-xl transition-colors text-base"
          >
            Book a Demo
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#010F21] border-t border-white/10 px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/salta-logo-white.svg" alt="Salta" className="h-7 w-auto opacity-80" />
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <a href="mailto:hello@getsalta.com" className="hover:text-slate-300 transition-colors">
              hello@getsalta.com
            </a>
            <span>© {new Date().getFullYear()} Salta. All rights reserved.</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
