export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/AppShell";

const TYPE_STYLES: Record<string, string> = {
  store: "bg-blue-100 text-blue-700",
  show: "bg-purple-100 text-purple-700",
};

export default async function AdminLocationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, organization:organizations(role_permissions)")
    .eq("id", user.id)
    .single();

  if (!["admin", "manager"].includes(profile?.role ?? "")) redirect("/dashboard");

  const { data: locations } = await supabase
    .from("locations")
    .select("id, name, type, city, state, address")
    .order("name");

  return (
    <AppShell role={profile?.role} userName={profile?.full_name} orgPerms={(profile?.organization as any)?.role_permissions ?? null}>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Locations</h1>
            <p className="text-sm text-slate-500 mt-1">{locations?.length ?? 0} location{locations?.length !== 1 ? "s" : ""}</p>
          </div>
          <Link
            href="/admin/locations/new"
            className="bg-[#00929C] hover:bg-[#007a82] text-white font-semibold text-sm px-4 py-2 rounded-xl transition-colors"
          >
            + Add Location
          </Link>
        </div>

        {!locations?.length ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <p className="text-slate-500 font-medium">No locations yet.</p>
            <Link href="/admin/locations/new" className="mt-3 inline-block text-sm text-[#00929C] font-semibold hover:underline">
              Add your first location →
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
            {locations.map((loc) => (
              <Link
                key={loc.id}
                href={`/admin/locations/${loc.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 group-hover:text-[#00929C] transition-colors">{loc.name}</p>
                    {(loc.city || loc.state) && (
                      <p className="text-xs text-slate-400">{[loc.city, loc.state].filter(Boolean).join(", ")}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {loc.type && (
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${TYPE_STYLES[loc.type] ?? "bg-slate-100 text-slate-600"}`}>
                      {loc.type}
                    </span>
                  )}
                  <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
