export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SyncProductsButton } from "@/components/admin/SyncProductsButton";
import { PingButton } from "@/components/admin/PingButton";
import { InviteUserButton } from "@/components/admin/InviteUserButton";
import { UserRoleEditor } from "@/components/admin/UserRoleEditor";


export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");

  const [{ count: productCount }, { data: locations }, { data: profiles }] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("locations").select("*").order("type").order("name"),
    supabase.from("profiles").select("*").order("full_name"),
  ]);

  const qboConnected = !!process.env.QBO_ACCESS_TOKEN;
  const avalaraConfigured = !!process.env.AVALARA_ACCOUNT_ID;

  return (
    <div className="min-h-screen bg-slate-50">
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
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Users ({profiles?.length ?? 0})</CardTitle>
              <InviteUserButton />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-100">
              {profiles?.map((p) => (
                <li key={p.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{p.full_name}</p>
                    <p className="text-xs text-slate-500">{p.email}</p>
                  </div>
                  <UserRoleEditor
                    userId={p.id}
                    currentRole={p.role ?? "sales_rep"}
                    currentUserId={user.id}
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Avalara */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Avalara AvaTax</CardTitle>
              <Badge variant={avalaraConfigured ? "success" : "destructive"}>
                {avalaraConfigured ? "Configured" : "Not Configured"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {avalaraConfigured ? (
              <PingButton />
            ) : (
              <p className="text-sm text-slate-500">
                Add AVALARA_ACCOUNT_ID and AVALARA_LICENSE_KEY to .env.local to enable sales tax.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
