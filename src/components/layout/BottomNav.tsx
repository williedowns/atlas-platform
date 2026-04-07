"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SHOW_BOOKS_ROLES = ["admin", "manager", "bookkeeper"];

export default function BottomNav({ role }: { role?: string | null }) {
  const pathname = usePathname();

  const active = (href: string) =>
    pathname === href || pathname.startsWith(href + "/")
      ? "text-[#00929C]"
      : "text-slate-400";

  const label = (href: string) =>
    pathname === href || pathname.startsWith(href + "/") ? "font-medium" : "";

  const showBooks = SHOW_BOOKS_ROLES.includes(role ?? "");

  // Field crew gets a stripped-down nav: just Work Orders + Profile
  if (role === "field_crew") {
    return (
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex safe-bottom z-20">
        <Link href="/field" className={`flex-1 flex flex-col items-center py-3 ${active("/field")}`}>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <span className={`text-xs mt-1 ${label("/field")}`}>Work Orders</span>
        </Link>
        <Link href="/profile" className={`flex-1 flex flex-col items-center py-3 ${active("/profile")}`}>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className={`text-xs mt-1 ${label("/profile")}`}>Profile</span>
        </Link>
      </nav>
    );
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex safe-bottom z-20">

      {/* Home */}
      <Link href="/dashboard" className={`flex-1 flex flex-col items-center py-3 ${active("/dashboard")}`}>
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        <span className={`text-xs mt-1 ${label("/dashboard")}`}>Home</span>
      </Link>

      {/* Contracts */}
      <Link href="/contracts" className={`flex-1 flex flex-col items-center py-3 ${active("/contracts")}`}>
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className={`text-xs mt-1 ${label("/contracts")}`}>Contracts</span>
      </Link>

      {/* Shows */}
      <Link href="/shows" className={`flex-1 flex flex-col items-center py-3 ${active("/shows")}`}>
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className={`text-xs mt-1 ${label("/shows")}`}>Shows</span>
      </Link>

      {/* Leads */}
      <Link href="/leads" className={`flex-1 flex flex-col items-center py-3 ${active("/leads")}`}>
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <span className={`text-xs mt-1 ${label("/leads")}`}>Leads</span>
      </Link>

      {/* Books — admin / manager / bookkeeper only */}
      {showBooks && (
        <Link href="/bookkeeper" className={`flex-1 flex flex-col items-center py-3 ${active("/bookkeeper")}`}>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span className={`text-xs mt-1 ${label("/bookkeeper")}`}>Books</span>
        </Link>
      )}

      {/* Profile */}
      <Link href="/profile" className={`flex-1 flex flex-col items-center py-3 ${active("/profile")}`}>
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span className={`text-xs mt-1 ${label("/profile")}`}>Profile</span>
      </Link>

    </nav>
  );
}
