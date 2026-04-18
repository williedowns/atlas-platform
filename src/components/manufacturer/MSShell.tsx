"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MS_BRAND } from "@/lib/manufacturer/brand";

const NAV_ITEMS = [
  { href: "/manufacturer", label: "Overview", icon: "dashboard" },
  { href: "/manufacturer/command-center", label: "Command Center", icon: "command" },
  { href: "/manufacturer/sell-through", label: "Live Sell-Through", icon: "activity" },
  { href: "/manufacturer/dealer-orders", label: "Dealer Orders", icon: "orders" },
  { href: "/manufacturer/factory", label: "Factory OS", icon: "factory" },
  { href: "/manufacturer/freight", label: "Freight", icon: "truck" },
  { href: "/manufacturer/warranty", label: "Warranty & Service", icon: "wrench" },
  { href: "/manufacturer/finance", label: "Finance & AR", icon: "dollar" },
  { href: "/manufacturer/marketing", label: "Marketing Hub", icon: "megaphone" },
  { href: "/manufacturer/dealers", label: "Dealers", icon: "users" },
  { href: "/manufacturer/showrooms", label: "Showrooms", icon: "store" },
  { href: "/manufacturer/leaderboard", label: "Leaderboard", icon: "trophy" },
  { href: "/manufacturer/inventory", label: "Network Inventory", icon: "box" },
  { href: "/manufacturer/shows", label: "Active Shows", icon: "radio" },
  { href: "/manufacturer/mix", label: "Model / Color Mix", icon: "pie" },
  { href: "/manufacturer/price-realization", label: "Price Realization", icon: "tag" },
] as const;

function Icon({ name }: { name: string }) {
  const common = "w-5 h-5";
  switch (name) {
    case "dashboard":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" />
        </svg>
      );
    case "command":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H6a3 3 0 000 6h3V3zM9 15H6a3 3 0 100 6h3v-6zM15 3h3a3 3 0 110 6h-3V3zM15 15h3a3 3 0 110 6h-3v-6zM9 9h6v6H9z" />
        </svg>
      );
    case "activity":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      );
    case "users":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m10-6a4 4 0 11-8 0 4 4 0 018 0zM21 8a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case "trophy":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8M12 17v4M5 3h14v5a5 5 0 01-5 5h-4a5 5 0 01-5-5V3zM19 4h2a2 2 0 010 4h-2M5 4H3a2 2 0 000 4h2" />
        </svg>
      );
    case "box":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      );
    case "radio":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.93 19.07a10 10 0 010-14.14M19.07 4.93a10 10 0 010 14.14M7.76 16.24a6 6 0 010-8.48M16.24 7.76a6 6 0 010 8.48M12 14a2 2 0 100-4 2 2 0 000 4z" />
        </svg>
      );
    case "pie":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.21 15.89A10 10 0 118.11 2.79M22 12A10 10 0 0012 2v10z" />
        </svg>
      );
    case "tag":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82zM7 7h.01" />
        </svg>
      );
    case "store":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l2-5h14l2 5M3 9v11a1 1 0 001 1h16a1 1 0 001-1V9M3 9h18M9 21v-6a2 2 0 012-2h2a2 2 0 012 2v6" />
        </svg>
      );
    case "orders":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      );
    case "truck":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
        </svg>
      );
    case "factory":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21V10l6 3V10l6 3V4l6 3v14H3zM7 18h2M11 18h2M15 18h2" />
        </svg>
      );
    case "megaphone":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
      );
    case "dollar":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "wrench":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    default:
      return null;
  }
}

export default function MSShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: MS_BRAND.colors.pageBg }}>
      <aside
        className="w-64 flex-shrink-0 flex flex-col"
        style={{ backgroundColor: MS_BRAND.colors.sidebarBg }}
      >
        <div className="px-6 py-5 border-b" style={{ borderColor: MS_BRAND.colors.sidebarBorder }}>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded flex items-center justify-center font-black text-white"
              style={{ backgroundColor: MS_BRAND.colors.primary }}
            >
              M
            </div>
            <div>
              <div className="text-white font-bold text-sm leading-tight">{MS_BRAND.companyName}</div>
              <div className="text-white/50 text-[10px] uppercase tracking-widest leading-tight">
                Dealer Network
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/manufacturer"
                ? pathname === "/manufacturer"
                : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-white/10 text-white font-semibold"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-6 py-4 border-t" style={{ borderColor: MS_BRAND.colors.sidebarBorder }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white font-bold text-sm">
              KR
            </div>
            <div>
              <div className="text-white text-sm font-semibold leading-tight">Kevin Richards</div>
              <div className="text-white/50 text-xs leading-tight">CEO · Master Spas</div>
            </div>
          </div>
          <div className="mt-3 text-[10px] text-white/30 uppercase tracking-widest">
            {MS_BRAND.poweredBy}
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="h-16 px-8 flex items-center justify-between border-b border-slate-200"
          style={{ backgroundColor: MS_BRAND.colors.headerBg }}
        >
          <div>
            <h1 className="text-white font-bold text-lg tracking-tight">
              {NAV_ITEMS.find((n) =>
                n.href === "/manufacturer"
                  ? pathname === "/manufacturer"
                  : pathname?.startsWith(n.href)
              )?.label ?? "Dashboard"}
            </h1>
            <p className="text-white/50 text-xs">{MS_BRAND.tagline}</p>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-white/80 text-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Network Live</span>
            </div>
            <div className="text-white/60 text-sm" suppressHydrationWarning>
              {new Date().toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
            <Link
              href="/manufacturer/login"
              className="text-white/40 hover:text-white/80 text-xs transition-colors"
            >
              Sign out
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
