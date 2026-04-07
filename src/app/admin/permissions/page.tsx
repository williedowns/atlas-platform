export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PermissionsEditor } from "@/components/admin/PermissionsEditor";
import { DEFAULT_PERMISSIONS } from "@/lib/permissions";

export default async function PermissionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");

  // Load current permissions from org
  const { data: org } = await supabase
    .from("organizations")
    .select("name, role_permissions")
    .eq("id", profile.organization_id)
    .single();

  const permissions = (org?.role_permissions ?? DEFAULT_PERMISSIONS) as typeof DEFAULT_PERMISSIONS;

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/admin" className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold">Role Permissions</h1>
            <p className="text-white/60 text-xs">What each role can access</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <PermissionsEditor initialPermissions={permissions} />
        </div>
      </main>
    </div>
  );
}
