export const dynamic = "force-dynamic";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/ui/AppHeader";
import { hasPermission, type RolePermissions } from "@/lib/permissions";
import { loadWorkbookDeals } from "@/lib/show-sales/workbook-loader";
import WorkbookClient from "./WorkbookClient";

export default async function ShowWorkbookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization:organizations(role_permissions)")
    .eq("id", user.id)
    .single();

  const orgPerms = (profile?.organization as { role_permissions?: RolePermissions } | null)
    ?.role_permissions;
  if (!hasPermission(orgPerms, profile?.role, "shows")) {
    redirect("/dashboard");
  }
  const canEdit = ["admin", "manager", "bookkeeper"].includes(profile?.role ?? "");

  const { data: show } = await supabase
    .from("shows")
    .select("id, name, venue_name, city, state, start_date, end_date")
    .eq("id", id)
    .single();
  if (!show) notFound();

  const initialDeals = await loadWorkbookDeals(supabase, show.id);

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        title={`${show.name} · Workbook`}
        subtitle={`${initialDeals.length} deal${initialDeals.length === 1 ? "" : "s"} · live spreadsheet`}
        backHref={`/shows/${show.id}`}
        actions={
          <a
            href={`/api/shows/${show.id}/spreadsheet`}
            className="px-3 py-1.5 rounded-md bg-[#00929C] hover:bg-[#007a82] text-white text-xs font-semibold transition-colors"
          >
            Download .xlsx
          </a>
        }
      />
      <main className="px-5 py-5 max-w-3xl mx-auto pb-24">
        <WorkbookClient showId={show.id} initialDeals={initialDeals} canEdit={canEdit} />
      </main>
    </div>
  );
}
