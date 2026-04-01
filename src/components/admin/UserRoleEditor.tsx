"use client";

import { useState } from "react";

const ROLES = [
  { value: "sales_rep", label: "Sales Rep" },
  { value: "manager", label: "Manager" },
  { value: "bookkeeper", label: "Bookkeeper" },
  { value: "field_crew", label: "Field Crew" },
  { value: "admin", label: "Admin" },
] as const;

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-slate-800 text-white",
  manager: "bg-amber-100 text-amber-800",
  sales_rep: "bg-emerald-100 text-emerald-800",
  bookkeeper: "bg-slate-100 text-slate-700",
  field_crew: "bg-slate-100 text-slate-700",
};

export function UserRoleEditor({
  userId,
  currentRole,
  currentUserId,
}: {
  userId: string;
  currentRole: string;
  currentUserId: string;
}) {
  const [role, setRole] = useState(currentRole);
  const [saving, setSaving] = useState(false);
  const isSelf = userId === currentUserId;

  async function handleChange(newRole: string) {
    if (newRole === role || isSelf) return;
    setSaving(true);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    setSaving(false);
    if (res.ok) setRole(newRole);
  }

  const label = ROLES.find((r) => r.value === role)?.label ?? role.replace(/_/g, " ");
  const colorClass = ROLE_COLORS[role] ?? "bg-slate-100 text-slate-700";

  if (isSelf) {
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${colorClass}`}>
        {label}
      </span>
    );
  }

  return (
    <div className="relative">
      <select
        value={role}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving}
        className={`appearance-none pl-2.5 pr-6 py-1 rounded-full text-xs font-semibold border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#00929C] ${colorClass} ${saving ? "opacity-50" : ""}`}
      >
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}
