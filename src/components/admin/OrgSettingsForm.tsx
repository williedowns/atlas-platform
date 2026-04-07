"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Org {
  id: string;
  name: string | null;
  slug: string | null;
  primary_color: string | null;
  from_email: string | null;
  from_name: string | null;
  subscription_tier: string | null;
}

interface Props {
  org: Org;
}

export function OrgSettingsForm({ org }: Props) {
  const [name, setName] = useState(org.name ?? "");
  const [primaryColor, setPrimaryColor] = useState(org.primary_color ?? "");
  const [fromEmail, setFromEmail] = useState(org.from_email ?? "");
  const [fromName, setFromName] = useState(org.from_name ?? "");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    setError(null);

    try {
      const res = await fetch("/api/admin/org-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: org.id,
          name,
          primary_color: primaryColor,
          from_email: fromEmail,
          from_name: fromName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to save settings.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h2 className="text-base font-semibold text-slate-900">Organization Settings</h2>

      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm font-medium text-green-700">
          Settings saved ✓
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <Input
        label="Organization Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Atlas Spas"
      />

      <Input
        label="From Name"
        value={fromName}
        onChange={(e) => setFromName(e.target.value)}
        placeholder="Atlas Spas Team"
      />

      <Input
        label="From Email"
        type="email"
        value={fromEmail}
        onChange={(e) => setFromEmail(e.target.value)}
        placeholder="hello@example.com"
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-700">Primary Color</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={primaryColor || "#00929C"}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-12 w-14 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
          />
          <Input
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            placeholder="#00929C"
            className="flex-1"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-700">Slug</label>
        <div className="flex h-12 w-full items-center rounded-lg border border-slate-200 bg-slate-100 px-4 text-sm text-slate-500">
          {org.slug ?? "—"}
        </div>
        <p className="text-xs text-slate-400">Slug cannot be changed after creation.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-700">Subscription Tier</label>
        <div className="flex h-12 w-full items-center rounded-lg border border-slate-200 bg-slate-100 px-4 text-sm text-slate-500 capitalize">
          {org.subscription_tier ?? "—"}
        </div>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={loading}
        className="w-full"
      >
        Save Settings
      </Button>
    </form>
  );
}
