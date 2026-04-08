export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SyncProductsButton } from "@/components/admin/SyncProductsButton";
import { PingButton } from "@/components/admin/PingButton";
import AppShell from "@/components/layout/AppShell";


export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");

  const [{ count: productCount }, { data: locations }, { count: userCount }, { data: qboToken }] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("locations").select("*").order("type").order("name"),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("qbo_tokens").select("id").eq("id", 1).single(),
  ]);

  const qboConnected = !!qboToken;
  const zampConfigured = !!process.env.ZAMP_API_TOKEN;

  return (
    <AppShell role={profile?.role} userName={(profile as any)?.full_name}>
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="p-2 rounded-lg hover:bg-white/10">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-bold">Admin Panel</h1>
        </div>
      </header>

      <main className="px-5 py-6 space-y-4 max-w-2xl mx-auto pb-24">

        {/* Analytics */}
        <Link href="/analytics" className="block">
          <Card className="border-[#00929C]/30 bg-gradient-to-r from-[#00929C]/5 to-transparent hover:border-[#00929C]/60 transition-colors">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">Analytics Dashboard</p>
                <p className="text-sm text-slate-500">Revenue · Leaderboard · Shows · Locations</p>
              </div>
              <svg className="w-6 h-6 text-[#00929C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </CardContent>
          </Card>
        </Link>

        {/* Work Orders */}
        <Link href="/admin/work-orders" className="block">
          <Card className="hover:border-slate-300 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">Work Orders</p>
                <p className="text-sm text-slate-500">Deliveries · Scheduling · Crew Assignment</p>
              </div>
              <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </CardContent>
          </Card>
        </Link>

        {/* Sales Goals */}
        <Link href="/admin/goals" className="block">
          <Card className="hover:border-slate-300 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">Sales Goals</p>
                <p className="text-sm text-slate-500">Monthly targets · Quota tracking per rep</p>
              </div>
              <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </CardContent>
          </Card>
        </Link>

        {/* Platform Settings */}
        <Link href="/admin/settings">
          <Card className="hover:border-slate-300 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">Platform Settings</p>
                <p className="text-sm text-slate-500">Org branding · Email · Colors</p>
              </div>
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </CardContent>
          </Card>
        </Link>

        {/* Inventory Management */}
        <Link href="/admin/inventory" className="block">
          <Card className="border-slate-200 hover:border-[#00929C]/40 transition-colors">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">Inventory Management</p>
                <p className="text-sm text-slate-500">Units · Transfers · Shows · Serial Numbers</p>
              </div>
              <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </CardContent>
          </Card>
        </Link>

        {/* QuickBooks */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>QuickBooks Online</CardTitle>
              <Badge variant={qboConnected ? "success" : "destructive"}>
                {qboConnected ? "Connected" : "Not Connected"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {!qboConnected && (
              <Link href="/api/qbo/connect">
                <Button variant="primary" size="lg" className="w-full">
                  Connect QuickBooks
                </Button>
              </Link>
            )}
            <SyncProductsButton />
            <p className="text-sm text-slate-500">
              Products in system: <strong>{productCount ?? 0}</strong>
            </p>
          </CardContent>
        </Card>

        {/* Locations */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Locations ({locations?.length ?? 0})</CardTitle>
              <Link href="/admin/locations/new">
                <Button variant="outline" size="sm">+ Add</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!locations?.length ? (
              <p className="text-slate-500 text-sm px-4 pb-4">No locations yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {locations.map((loc) => (
                  <li key={loc.id}>
                    <Link
                      href={`/admin/locations/${loc.id}`}
                      className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 active:bg-slate-100 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{loc.name}</p>
                        <p className="text-xs text-slate-500">{loc.city}, {loc.state}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={loc.type === "store" ? "default" : "warning"}>
                          {loc.type}
                        </Badge>
                        {loc.cc_surcharge_enabled && (
                          <span className="text-xs text-slate-500">
                            +{(loc.cc_surcharge_rate * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Users */}
        <Link href="/admin/users">
          <Card className="hover:border-slate-300 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">Manage Users</p>
                <p className="text-sm text-slate-500">{userCount ?? 0} team members · roles, passwords, access</p>
              </div>
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </CardContent>
          </Card>
        </Link>

        {/* Role Permissions */}
        <Link href="/admin/permissions">
          <Card className="hover:border-slate-300 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">Role Permissions</p>
                <p className="text-sm text-slate-500">Control what each role can access</p>
              </div>
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </CardContent>
          </Card>
        </Link>

        {/* Zamp Sales Tax */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Zamp Sales Tax</CardTitle>
              <Badge variant={zampConfigured ? "success" : "destructive"}>
                {zampConfigured ? "Configured" : "Not Configured"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {zampConfigured ? (
              <PingButton />
            ) : (
              <p className="text-sm text-slate-500">
                Add <code className="bg-slate-100 px-1 rounded text-xs">ZAMP_API_TOKEN</code> to environment variables to enable sales tax calculation and filing.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </AppShell>
  );
}
