export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import AppShell from "@/components/layout/AppShell";

export default async function ShowsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, organization:organizations(role_permissions)")
    .eq("id", user.id)
    .single();

  if (profile?.role === "field_crew") redirect("/field");

  const { hasPermission } = await import("@/lib/permissions");
  const orgPerms = (profile?.organization as any)?.role_permissions;
  if (!hasPermission(orgPerms, profile?.role, "shows")) redirect("/dashboard");

  const { data: shows } = await supabase
    .from("shows")
    .select("*, location:locations(name, city, state)")
    .eq("active", true)
    .order("start_date");

  const today = new Date().toISOString().split("T")[0];
  const upcoming = shows?.filter((s) => s.end_date >= today) ?? [];
  const past = shows?.filter((s) => s.end_date < today).slice(0, 5) ?? [];

  const canCreateShows = profile?.role === "admin" || profile?.role === "manager";
  const canEditShows = profile?.role === "admin";

  return (
    <AppShell role={profile?.role} userName={profile?.full_name} orgPerms={orgPerms}>
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">Shows & Events</h1>
          {canCreateShows && (
            <Link href="/admin/shows/new">
              <Button variant="accent" size="sm">+ New Show</Button>
            </Link>
          )}
        </div>
      </header>

      <main className="px-5 py-6 space-y-6 max-w-2xl mx-auto pb-24">
        {/* Upcoming */}
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Upcoming Shows ({upcoming.length})
          </h2>
          {upcoming.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-slate-500">
                <p className="text-lg">No upcoming shows.</p>
                <p className="text-sm mt-1">Check back with your manager.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {upcoming.map((show) => (
                <div key={show.id} className="relative">
                  <Link href={`/shows/${show.id}`} className="block">
                    <Card className="active:bg-slate-50 hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900 text-lg">{show.name}</p>
                            <p className="text-slate-600 mt-0.5">{show.venue_name}</p>
                            <p className="text-slate-500 text-sm">
                              {show.city}, {show.state}
                            </p>
                          </div>
                          <div className="text-right ml-3">
                            <Badge variant="default" className="mb-1">Active</Badge>
                            <p className="text-xs text-slate-500 mt-1">
                              {formatDate(show.start_date)}
                              {show.start_date !== show.end_date && ` – ${formatDate(show.end_date)}`}
                            </p>
                            {canEditShows && (
                              <Link
                                href={`/admin/shows/${show.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs text-[#00929C] underline mt-1 block"
                              >
                                Edit / QBO
                              </Link>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Past */}
        {past.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Recent Past Shows
            </h2>
            <div className="space-y-2">
              {past.map((show) => (
                <Link key={show.id} href={`/shows/${show.id}`}>
                  <Card className="opacity-60 active:opacity-80 cursor-pointer">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-700">{show.name}</p>
                        <p className="text-sm text-slate-500">{show.city}, {show.state}</p>
                      </div>
                      <p className="text-xs text-slate-400">{formatDate(show.end_date)}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

    </AppShell>
  );
}
