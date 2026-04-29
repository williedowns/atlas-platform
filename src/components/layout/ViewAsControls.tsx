"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

interface UserOption {
  id: string;
  full_name: string | null;
  role: string | null;
}

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "manager", label: "Manager" },
  { value: "sales_rep", label: "Sales Rep" },
  { value: "bookkeeper", label: "Bookkeeper" },
  { value: "field_crew", label: "Field Crew" },
  { value: "customer", label: "Customer" },
];

interface ViewAsControlsProps {
  /** SSR-supplied real role. Optional — when omitted, the component fetches
   *  /api/admin/users and uses 200-vs-403 to detect admin status. */
  realRole?: string | null;
  effectiveRole?: string | null;
  viewAsUserId?: string | null;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

export default function ViewAsControls({
  realRole,
  effectiveRole,
  viewAsUserId,
}: ViewAsControlsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  // Auto-detect admin status when SSR didn't supply realRole.
  // GET /api/admin/users returns 403 for non-admins, so a successful array
  // response = admin. Cached for the component's lifetime.
  const [autoDetectedAdmin, setAutoDetectedAdmin] = useState<boolean | null>(null);
  const [autoLoadedUsers, setAutoLoadedUsers] = useState<UserOption[] | null>(null);

  useEffect(() => {
    if (realRole !== undefined && realRole !== null) {
      setAutoDetectedAdmin(realRole === "admin");
      return;
    }
    let cancelled = false;
    fetch("/api/admin/users")
      .then(async (r) => {
        if (!r.ok) return null;
        const data = await r.json();
        return Array.isArray(data) ? data : null;
      })
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setAutoDetectedAdmin(true);
          setAutoLoadedUsers(data as UserOption[]);
        } else {
          setAutoDetectedAdmin(false);
        }
      })
      .catch(() => {
        if (!cancelled) setAutoDetectedAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, [realRole]);

  // Read cookie-only state when SSR didn't pass effective role / user
  const effectiveRoleResolved =
    effectiveRole ?? (typeof window !== "undefined" ? readCookie("view_as_role") : null);
  const viewAsUserIdResolved =
    viewAsUserId ?? (typeof window !== "undefined" ? readCookie("view_as_user_id") : null);

  // Lazy-load the user list when the picker opens (unless we already loaded it
  // during admin detection)
  useEffect(() => {
    if (!open) return;
    if (users.length > 0) return;
    if (autoLoadedUsers) {
      setUsers(autoLoadedUsers);
      return;
    }
    setLoadingUsers(true);
    fetch("/api/admin/users")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setUsers(data);
      })
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, [open, users.length, autoLoadedUsers]);

  // Don't render anything until we know whether the user is an admin
  if (autoDetectedAdmin !== true) return null;

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.trim().toLowerCase();
    return users.filter(
      (u) =>
        (u.full_name ?? "").toLowerCase().includes(q) ||
        (u.role ?? "").toLowerCase().includes(q)
    );
  }, [users, search]);

  async function applyRole(role: string) {
    setSubmitting(true);
    try {
      await fetch("/api/admin/view-as", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, user_id: "" }),
      });
      router.refresh();
      if (typeof window !== "undefined") window.location.reload();
    } finally {
      setSubmitting(false);
    }
  }

  async function applyUser(user: UserOption) {
    setSubmitting(true);
    try {
      await fetch("/api/admin/view-as", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, role: "" }),
      });
      router.refresh();
      if (typeof window !== "undefined") window.location.reload();
    } finally {
      setSubmitting(false);
    }
  }

  async function clearAll() {
    setSubmitting(true);
    try {
      await fetch("/api/admin/view-as", { method: "DELETE" });
      router.refresh();
      if (typeof window !== "undefined") window.location.reload();
    } finally {
      setSubmitting(false);
    }
  }

  const isActive =
    (effectiveRoleResolved && effectiveRoleResolved !== "admin") ||
    !!viewAsUserIdResolved;

  return (
    <div className="px-4 py-3 border-t border-white/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
          isActive
            ? "bg-amber-400/20 text-amber-200 border border-amber-400/40"
            : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10"
        }`}
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          {isActive ? "Impersonating" : "View as"}
        </span>
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-2 space-y-3 rounded-lg bg-black/30 p-3 border border-white/10">
          {isActive && (
            <button
              type="button"
              onClick={clearAll}
              disabled={submitting}
              className="w-full px-3 py-1.5 rounded text-[11px] font-bold bg-amber-500 text-amber-950 hover:bg-amber-400 disabled:opacity-50"
            >
              Stop impersonating
            </button>
          )}

          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-1.5">
              By role
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {ROLE_OPTIONS.map((opt) => {
                const active = effectiveRoleResolved === opt.value && !viewAsUserIdResolved;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => applyRole(opt.value)}
                    disabled={submitting}
                    className={`px-2 py-1.5 rounded text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                      active
                        ? "bg-amber-400 text-amber-950"
                        : "bg-white/5 text-white/80 hover:bg-white/10"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-1.5">
              By user
            </p>
            <input
              type="search"
              placeholder="Search users…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-2 py-1.5 mb-2 rounded bg-white/5 text-white text-xs placeholder:text-white/40 border border-white/10 focus:border-amber-400 focus:outline-none"
            />
            <div className="max-h-44 overflow-y-auto space-y-1">
              {loadingUsers && (
                <p className="text-[11px] text-white/50 italic px-2">Loading…</p>
              )}
              {!loadingUsers && filteredUsers.length === 0 && (
                <p className="text-[11px] text-white/50 italic px-2">No matches</p>
              )}
              {filteredUsers.map((u) => {
                const active = viewAsUserIdResolved === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => applyUser(u)}
                    disabled={submitting}
                    className={`w-full text-left px-2 py-1.5 rounded text-[11px] transition-colors disabled:opacity-50 ${
                      active
                        ? "bg-amber-400 text-amber-950 font-bold"
                        : "bg-white/5 text-white/80 hover:bg-white/10"
                    }`}
                  >
                    <div className="font-semibold truncate">
                      {u.full_name ?? "(no name)"}
                    </div>
                    <div className="text-[10px] opacity-75 capitalize">
                      {u.role?.replace("_", " ") ?? "—"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
