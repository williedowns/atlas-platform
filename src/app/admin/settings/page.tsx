export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OrgSettingsForm } from "@/components/admin/OrgSettingsForm";

export default async function OrgSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const { data: org } = await supabase.from("organizations").select("*").limit(1).single();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="p-2 rounded-lg hover:bg-white/10">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-bold">Platform Settings</h1>
        </div>
      </header>
      <main className="px-5 py-6 max-w-lg mx-auto pb-24">
        {org ? <OrgSettingsForm org={org} /> : (
          <p className="text-slate-500 text-sm">No organization found.</p>
        )}
      </main>
    </div>
  );
}
