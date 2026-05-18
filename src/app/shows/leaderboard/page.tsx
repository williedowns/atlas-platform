export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions";
import AppShell from "@/components/layout/AppShell";
import { buildRanking } from "@/lib/show-leaderboard/ranking";
import LeaderboardClient from "./LeaderboardClient";

export default async function ShowLeaderboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, organization:organizations(role_permissions)")
    .eq("id", user.id)
    .single();

  if (profile?.role === "field_crew") redirect("/field");
  const orgPerms = (profile?.organization as any)?.role_permissions;
  if (!hasPermission(orgPerms, profile?.role, "shows")) redirect("/dashboard");

  const ranking = buildRanking();

  return (
    <AppShell role={profile?.role} userName={profile?.full_name} orgPerms={orgPerms}>
      <LeaderboardClient ranking={ranking} />
    </AppShell>
  );
}
