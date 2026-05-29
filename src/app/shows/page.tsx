export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import AppShell from "@/components/layout/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import ShowsListClient from "./ShowsListClient";

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
    .select("id, name, venue_name, city, state, start_date, end_date, active")
    .order("start_date", { ascending: false });

  const today = new Date().toISOString().split("T")[0];
  const allShows = shows ?? [];
  const upcomingCount = allShows.filter((s) => s.end_date >= today).length;

  const canCreateShows = profile?.role === "admin" || profile?.role === "manager";
  const canEditShows = profile?.role === "admin";

  return (
    <AppShell role={profile?.role} userName={profile?.full_name} orgPerms={orgPerms}>
      <AppHeader
        title="Shows & Events"
        subtitle={`${upcomingCount} upcoming`}
        actions={
          <div className="flex gap-2">
            <Link href="/shows/leaderboard">
              <Button variant="outline" size="sm">Leaderboard</Button>
            </Link>
            {canCreateShows && (
              <Link href="/admin/shows/new">
                <Button variant="accent" size="sm">+ New Show</Button>
              </Link>
            )}
          </div>
        }
      />

      <main className="px-5 py-6 space-y-6 max-w-4xl mx-auto pb-24">
        <ShowsListClient shows={allShows} today={today} canEditShows={canEditShows} />
      </main>

    </AppShell>
  );
}
