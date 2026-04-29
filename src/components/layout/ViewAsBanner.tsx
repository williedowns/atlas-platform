"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  sales_rep: "Sales Rep",
  bookkeeper: "Bookkeeper",
  field_crew: "Field Crew",
  customer: "Customer",
};

interface ViewAsBannerProps {
  /** SSR-supplied props for instant first paint. When omitted, the banner
   *  reads cookies client-side as a fallback so it works on every page. */
  effectiveRole?: string | null;
  viewAsUserName?: string | null;
  isImpersonatingRole?: boolean;
  isImpersonatingUser?: boolean;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

export default function ViewAsBanner(props: ViewAsBannerProps) {
  const router = useRouter();
  const [exiting, setExiting] = useState(false);

  // Client-side fallback: if SSR didn't pass props, read cookies + fetch
  // user name. This is what makes the banner appear on every page in the
  // app without us having to update 24 AppShell callers.
  const ssrSaysImpersonating = !!(props.isImpersonatingRole || props.isImpersonatingUser);
  const [clientRole, setClientRole] = useState<string | null>(null);
  const [clientUserName, setClientUserName] = useState<string | null>(null);
  const [clientImpersonatingUser, setClientImpersonatingUser] = useState(false);
  const [clientImpersonatingRole, setClientImpersonatingRole] = useState(false);

  useEffect(() => {
    if (ssrSaysImpersonating) return; // SSR already populated everything
    const roleCookie = readCookie("view_as_role");
    const userCookie = readCookie("view_as_user_id");
    if (!roleCookie && !userCookie) return;

    setClientImpersonatingRole(!!roleCookie);
    setClientImpersonatingUser(!!userCookie);

    if (userCookie) {
      // Fetch the user list and pluck the impersonated user's name + role.
      // This list is cached for the session so subsequent banner mounts are
      // instant.
      fetch("/api/admin/users")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            const u = data.find((x) => x.id === userCookie);
            if (u) {
              setClientUserName(u.full_name ?? null);
              setClientRole(u.role ?? roleCookie ?? null);
            }
          }
        })
        .catch(() => {});
    } else if (roleCookie) {
      setClientRole(roleCookie);
    }
  }, [ssrSaysImpersonating]);

  const isImpersonating =
    props.isImpersonatingRole ||
    props.isImpersonatingUser ||
    clientImpersonatingRole ||
    clientImpersonatingUser;

  if (!isImpersonating) return null;

  const effectiveRole = props.effectiveRole ?? clientRole ?? "";
  const userName = props.viewAsUserName ?? clientUserName ?? null;

  const roleLabel = effectiveRole ? ROLE_LABELS[effectiveRole] ?? effectiveRole : "";
  const detail = userName ? `${userName} (${roleLabel})` : roleLabel;

  async function handleExit() {
    setExiting(true);
    try {
      await fetch("/api/admin/view-as", { method: "DELETE" });
      router.refresh();
      // Hard reload guarantees stale cookies on this page are gone too.
      if (typeof window !== "undefined") window.location.reload();
    } finally {
      setExiting(false);
    }
  }

  return (
    <div
      role="status"
      className="sticky top-0 z-40 w-full bg-amber-400 border-b-2 border-amber-600 shadow"
    >
      <div className="px-4 py-2.5 flex items-center justify-between gap-3 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 min-w-0">
          <svg
            className="w-5 h-5 flex-shrink-0 text-amber-900"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
          <p className="text-sm font-bold text-amber-900 truncate">
            Viewing as <span className="underline">{detail || "another user"}</span>
            <span className="font-normal opacity-75"> — writes still recorded as you</span>
          </p>
        </div>
        <button
          type="button"
          onClick={handleExit}
          disabled={exiting}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-900 text-amber-50 text-xs font-bold hover:bg-amber-950 disabled:opacity-50 transition-colors"
        >
          {exiting ? "Exiting…" : "Return to Admin"}
        </button>
      </div>
    </div>
  );
}
