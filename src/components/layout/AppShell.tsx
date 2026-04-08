"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_PERMISSIONS } from "@/lib/permissions";
import type { Feature, RolePermissions } from "@/lib/permissions";

interface AppShellProps {
  role?: string | null;
  userName?: string | null;
  orgPerms?: RolePermissions | null;
  children: React.ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles?: string[];    // role whitelist
  feature?: Feature;  // if set, also checked against orgPerms
}

function HomeIcon() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
}
function ContractsIcon() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
}
function ShowsIcon() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
}
function LeadsIcon() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
}
function AnalyticsIcon() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
}
function InventoryIcon() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
}
function FinanceIcon() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>;
}
function FinancingIcon() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
}
function AdminIcon() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
}
function WorkOrdersIcon() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>;
}
function ServiceIcon() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
}

const ALL_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",  label: "Home",        icon: <HomeIcon />,        roles: ["admin","manager","sales_rep"] },
  { href: "/field",             label: "Work Orders", icon: <WorkOrdersIcon />,  roles: ["field_crew"] },
  { href: "/admin/work-orders", label: "Work Orders", icon: <WorkOrdersIcon />,  roles: ["admin","manager"] },
  { href: "/service/jobs",      label: "Service",     icon: <ServiceIcon />,     roles: ["admin","manager"] },
  { href: "/contracts",  label: "Contracts",   icon: <ContractsIcon />,   roles: ["admin","manager","sales_rep","bookkeeper"], feature: "contracts" },
  { href: "/leads",      label: "Leads",       icon: <LeadsIcon />,       roles: ["admin","manager","sales_rep"],              feature: "leads" },
  { href: "/shows",      label: "Shows",       icon: <ShowsIcon />,       roles: ["admin","manager","sales_rep"],              feature: "shows" },
  { href: "/analytics",  label: "Analytics",   icon: <AnalyticsIcon />,   roles: ["admin","manager"],                          feature: "analytics" },
  { href: "/admin/inventory", label: "Inventory", icon: <InventoryIcon />, roles: ["admin","manager"], feature: "inventory" },
  { href: "/bookkeeper", label: "Books",       icon: <FinanceIcon />,     roles: ["admin","manager","bookkeeper"],             feature: "bookkeeper" },
  { href: "/financing",  label: "Financing",   icon: <FinancingIcon />,   roles: ["admin","manager","bookkeeper"] },
  { href: "/admin",      label: "Admin",       icon: <AdminIcon />,       roles: ["admin"] },
];

function checkPermission(
  orgPerms: RolePermissions | null | undefined,
  role: string,
  feature: Feature
): boolean {
  if (role === "admin") return true;
  const perms = orgPerms ?? DEFAULT_PERMISSIONS;
  return perms[role]?.[feature] ?? DEFAULT_PERMISSIONS[role]?.[feature] ?? false;
}

function SidebarNav({
  role,
  userName,
  orgPerms,
  onSignOut,
}: {
  role?: string | null;
  userName?: string | null;
  orgPerms?: RolePermissions | null;
  onSignOut: () => void;
}) {
  const pathname = usePathname();

  const visibleItems = ALL_NAV_ITEMS.filter((item) => {
    // Role check
    if (item.roles && !item.roles.includes(role ?? "")) return false;
    // Feature / orgPerms check (admin always passes)
    if (item.feature && role && role !== "admin") {
      if (!checkPermission(orgPerms, role, item.feature)) return false;
    }
    return true;
  });

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && href !== "/field" && pathname.startsWith(href + "/"));

  const initials = userName
    ? userName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/salta-logo-white.svg" alt="Salta" className="h-7 w-auto" />
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? "bg-[#00929C] text-white"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
            >
              <span className={active ? "text-white" : "text-white/60"}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User + sign out */}
      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        <Link
          href="/profile"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            pathname === "/profile" ? "bg-[#00929C] text-white" : "text-white/70 hover:text-white hover:bg-white/10"
          }`}
        >
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {initials}
          </div>
          <span className="truncate">{userName ?? "Profile"}</span>
        </Link>
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function AppShell({ role, userName, orgPerms, children }: AppShellProps) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc" }}>
      {/* Left sidebar — always visible */}
      <aside style={{ width: "224px", flexShrink: 0, position: "fixed", left: 0, top: 0, bottom: 0, background: "#010F21", zIndex: 30, boxShadow: "4px 0 20px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column" }}>
        <SidebarNav role={role} userName={userName} orgPerms={orgPerms} onSignOut={handleSignOut} />
      </aside>

      {/* Content area — offset by sidebar */}
      <div style={{ marginLeft: "224px", flex: 1, minHeight: "100vh", minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}
