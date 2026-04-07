"use client";

import { useState } from "react";
import {
  FEATURES,
  ROLES_WITH_PERMISSIONS,
  DEFAULT_PERMISSIONS,
  type RolePermissions,
  type Feature,
} from "@/lib/permissions";

export function PermissionsEditor({
  initialPermissions,
}: {
  initialPermissions: RolePermissions;
}) {
  const [perms, setPerms] = useState<RolePermissions>(() => {
    // Merge stored permissions with defaults so all keys are always present
    const merged: RolePermissions = {};
    for (const { key: role } of ROLES_WITH_PERMISSIONS) {
      merged[role] = { ...DEFAULT_PERMISSIONS[role], ...initialPermissions?.[role] };
    }
    return merged;
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(role: string, feature: Feature) {
    setPerms((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [feature]: !prev[role]?.[feature],
      },
    }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/role-permissions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions: perms }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to save");
    }
  }

  return (
    <div className="space-y-6">
      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-3 pr-4 font-semibold text-slate-700 w-32">Feature</th>
              {ROLES_WITH_PERMISSIONS.map((r) => (
                <th key={r.key} className="text-center py-3 px-3 font-semibold text-slate-700 min-w-[90px]">
                  {r.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((f, i) => (
              <tr
                key={f.key}
                className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}
              >
                <td className="py-3 pr-4">
                  <p className="font-medium text-slate-800">{f.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{f.description}</p>
                </td>
                {ROLES_WITH_PERMISSIONS.map((r) => {
                  const enabled = perms[r.key]?.[f.key] ?? false;
                  return (
                    <td key={r.key} className="text-center py-3 px-3">
                      <button
                        onClick={() => toggle(r.key, f.key)}
                        aria-label={`${enabled ? "Disable" : "Enable"} ${f.label} for ${r.label}`}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#00929C] focus:ring-offset-2 ${
                          enabled ? "bg-[#00929C]" : "bg-slate-200"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                            enabled ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Admin note */}
      <p className="text-xs text-slate-500 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
        <strong>Admin</strong> always has full access to all features — their permissions cannot be restricted.
      </p>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
      )}

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors ${
          saved
            ? "bg-emerald-500 text-white"
            : "bg-[#00929C] hover:bg-[#007a82] text-white disabled:opacity-50"
        }`}
      >
        {saving ? "Saving…" : saved ? "✓ Saved" : "Save Permissions"}
      </button>
    </div>
  );
}
