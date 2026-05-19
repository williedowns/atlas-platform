"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface CmdKResult {
  id: string;
  type: "contact" | "household" | "opportunity" | "action" | "navigate";
  label: string;
  subtitle?: string;
  href?: string;
  /** Hex color for the type icon background */
  accent?: string;
  icon: React.ReactNode;
  /** Optional: search keywords beyond the label */
  keywords?: string;
}

const NAVIGATE_ACTIONS: CmdKResult[] = [
  {
    id: "nav-home",
    type: "navigate",
    label: "Home",
    subtitle: "Dashboard",
    href: "/dashboard",
    accent: "#64748b",
    keywords: "dashboard home",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    id: "nav-crm",
    type: "navigate",
    label: "CRM hub",
    href: "/crm",
    accent: "#00929C",
    keywords: "crm home",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    id: "nav-contacts",
    type: "navigate",
    label: "Contacts",
    href: "/crm/contacts",
    accent: "#00929C",
    keywords: "people person",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: "nav-households",
    type: "navigate",
    label: "Households",
    href: "/crm/households",
    accent: "#00929C",
    keywords: "household family",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    id: "nav-pipeline",
    type: "navigate",
    label: "Pipeline (Kanban)",
    href: "/crm/pipeline",
    accent: "#00929C",
    keywords: "deals opportunities sales kanban",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M5 12h14M7 18h10" />
      </svg>
    ),
  },
  {
    id: "nav-inbox",
    type: "navigate",
    label: "Inbox",
    href: "/crm/inbox",
    accent: "#00929C",
    keywords: "conversations messages sms email",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    id: "nav-forecast",
    type: "navigate",
    label: "Forecast",
    subtitle: "Pipeline by month + rep leaderboard",
    href: "/crm/forecast",
    accent: "#00929C",
    keywords: "forecast pipeline weighted manager dashboard",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: "nav-leads",
    type: "navigate",
    label: "Leads (legacy)",
    subtitle: "Show check-ins from the original Salta leads table",
    href: "/leads",
    accent: "#64748b",
    keywords: "leads show",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: "nav-contracts",
    type: "navigate",
    label: "Contracts",
    href: "/contracts",
    accent: "#64748b",
    keywords: "contract sales",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: "nav-shows",
    type: "navigate",
    label: "Shows",
    href: "/shows",
    accent: "#64748b",
    keywords: "show event trade",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      </svg>
    ),
  },
];

const CREATE_ACTIONS: CmdKResult[] = [
  {
    id: "new-contact",
    type: "action",
    label: "New contact",
    subtitle: "Create a person record",
    href: "/crm/contacts/new",
    accent: "#10b981",
    keywords: "create add new person contact",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    id: "new-opportunity",
    type: "action",
    label: "New opportunity",
    subtitle: "Create a deal in the pipeline",
    href: "/crm/opportunities/new",
    accent: "#10b981",
    keywords: "create add new deal opportunity pipeline",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    id: "new-household",
    type: "action",
    label: "New household",
    subtitle: "Group multiple contacts under one deal",
    href: "/crm/households/new",
    accent: "#10b981",
    keywords: "create add new household family couple",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
];

const CONTACT_ICON = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const HOUSEHOLD_ICON = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const OPP_ICON = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M5 12h14M7 18h10" />
  </svg>
);

const TYPE_LABEL: Record<CmdKResult["type"], string> = {
  contact: "Contact",
  household: "Household",
  opportunity: "Opportunity",
  action: "Action",
  navigate: "Navigate",
};

export default function CmdK() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [liveResults, setLiveResults] = useState<CmdKResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Global keyboard shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus input + reset state on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery("");
      setActive(0);
      setLiveResults([]);
    }
  }, [open]);

  // Debounced search across contacts, households, opportunities
  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setLiveResults([]);
      return;
    }
    setSearching(true);
    const supabase = createClient();
    const term = `%${q.trim()}%`;

    const [contactsRes, householdsRes, oppsRes] = await Promise.all([
      supabase
        .from("contacts")
        .select("id, first_name, last_name, email_primary, phone_primary, source")
        .or(`first_name.ilike.${term},last_name.ilike.${term},email_primary.ilike.${term},phone_primary.ilike.${term}`)
        .limit(5),
      supabase
        .from("households")
        .select("id, name, lifecycle_stage, city, state")
        .ilike("name", term)
        .limit(5),
      supabase
        .from("opportunities")
        .select("id, name, value_estimate, status")
        .ilike("name", term)
        .limit(5),
    ]);

    const results: CmdKResult[] = [];

    for (const c of contactsRes.data ?? []) {
      const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed";
      results.push({
        id: `contact-${c.id}`,
        type: "contact",
        label: fullName,
        subtitle:
          [c.email_primary, c.phone_primary].filter(Boolean).join(" · ") ||
          (c.source ? `source: ${c.source}` : "no email"),
        href: `/crm/contacts/${c.id}`,
        accent: "#00929C",
        icon: CONTACT_ICON,
      });
    }
    for (const h of householdsRes.data ?? []) {
      const loc = [h.city, h.state].filter(Boolean).join(", ");
      results.push({
        id: `household-${h.id}`,
        type: "household",
        label: h.name,
        subtitle: [h.lifecycle_stage, loc].filter(Boolean).join(" · ") || undefined,
        href: `/crm/households/${h.id}`,
        accent: "#7c3aed",
        icon: HOUSEHOLD_ICON,
      });
    }
    for (const o of oppsRes.data ?? []) {
      const value =
        o.value_estimate != null
          ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(o.value_estimate)
          : null;
      results.push({
        id: `opp-${o.id}`,
        type: "opportunity",
        label: o.name,
        subtitle: [value, o.status].filter(Boolean).join(" · ") || undefined,
        href: `/crm/opportunities/${o.id}`,
        accent: "#f59e0b",
        icon: OPP_ICON,
      });
    }

    setLiveResults(results);
    setSearching(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => runSearch(query), 150);
    return () => clearTimeout(handle);
  }, [query, open, runSearch]);

  // Static results — always shown, filtered locally by query keywords
  const staticResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = [...CREATE_ACTIONS, ...NAVIGATE_ACTIONS];
    if (!q) return all;
    return all.filter((r) => {
      const hay = `${r.label} ${r.subtitle ?? ""} ${r.keywords ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query]);

  // Combined ordered list (live first, then static)
  const allResults = useMemo(() => [...liveResults, ...staticResults], [liveResults, staticResults]);

  // Clamp active index
  useEffect(() => {
    if (active >= allResults.length) setActive(0);
  }, [allResults, active]);

  // Scroll active row into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function executeResult(r: CmdKResult) {
    setOpen(false);
    if (r.href) {
      router.push(r.href);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(allResults.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = allResults[active];
      if (r) executeResult(r);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  if (!open) {
    return null;
  }

  // Group static results by type for visual sections
  const liveContacts = liveResults.filter((r) => r.type === "contact");
  const liveHouseholds = liveResults.filter((r) => r.type === "household");
  const liveOpps = liveResults.filter((r) => r.type === "opportunity");
  const staticCreate = staticResults.filter((r) => r.type === "action");
  const staticNav = staticResults.filter((r) => r.type === "navigate");

  // Build a single flat index→result map so keyboard nav matches visual order
  const ordered: CmdKResult[] = [
    ...liveContacts,
    ...liveHouseholds,
    ...liveOpps,
    ...staticCreate,
    ...staticNav,
  ];

  function renderRow(r: CmdKResult, idx: number) {
    const isActive = idx === active;
    return (
      <button
        key={r.id}
        data-idx={idx}
        type="button"
        onClick={() => executeResult(r)}
        onMouseEnter={() => setActive(idx)}
        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
          isActive ? "bg-[#00929C]/10" : "hover:bg-slate-50"
        }`}
      >
        <span
          className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 text-white"
          style={{ backgroundColor: r.accent ?? "#94a3b8" }}
        >
          {r.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-semibold truncate ${isActive ? "text-[#00929C]" : "text-slate-900"}`}>
              {r.label}
            </p>
            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">
              {TYPE_LABEL[r.type]}
            </span>
          </div>
          {r.subtitle && (
            <p className="text-[11px] text-slate-500 truncate">{r.subtitle}</p>
          )}
        </div>
        {isActive && (
          <span className="text-[10px] text-slate-400 font-medium flex-shrink-0">↵</span>
        )}
      </button>
    );
  }

  function renderSection(label: string, items: CmdKResult[], startIdx: number) {
    if (items.length === 0) return null;
    return (
      <div>
        <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </div>
        <div>
          {items.map((r, i) => renderRow(r, startIdx + i))}
        </div>
      </div>
    );
  }

  let runningIdx = 0;
  const contactSection = (() => {
    const s = renderSection("Contacts", liveContacts, runningIdx);
    runningIdx += liveContacts.length;
    return s;
  })();
  const householdSection = (() => {
    const s = renderSection("Households", liveHouseholds, runningIdx);
    runningIdx += liveHouseholds.length;
    return s;
  })();
  const oppSection = (() => {
    const s = renderSection("Opportunities", liveOpps, runningIdx);
    runningIdx += liveOpps.length;
    return s;
  })();
  const createSection = (() => {
    const s = renderSection("Create", staticCreate, runningIdx);
    runningIdx += staticCreate.length;
    return s;
  })();
  const navSection = (() => {
    const s = renderSection("Navigate", staticNav, runningIdx);
    runningIdx += staticNav.length;
    return s;
  })();

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4 bg-black/30 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[70vh]"
      >
        {/* Header / Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search contacts, deals, households…  or type to navigate"
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-[10px] font-mono text-slate-500 flex-shrink-0">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {ordered.length === 0 ? (
            <div className="px-4 py-8 text-center">
              {searching ? (
                <p className="text-sm text-slate-400">Searching…</p>
              ) : query.trim() ? (
                <p className="text-sm text-slate-400">No matches for "{query}"</p>
              ) : (
                <p className="text-sm text-slate-400">Start typing to search…</p>
              )}
            </div>
          ) : (
            <>
              {contactSection}
              {householdSection}
              {oppSection}
              {createSection}
              {navSection}
            </>
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border border-slate-200 bg-white font-mono text-[10px]">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border border-slate-200 bg-white font-mono text-[10px]">↵</kbd>
              open
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded border border-slate-200 bg-white font-mono text-[10px]">⌘ K</kbd>
            toggle
          </span>
        </div>
      </div>
    </div>
  );
}
