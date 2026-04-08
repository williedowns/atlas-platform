export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/AppShell";

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function showStatus(startDate: string | null, endDate: string | null) {
  if (!startDate) return null;
  const now = new Date();
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : start;
  if (now < start) return { label: "Upcoming", style: "bg-blue-100 text-blue-700" };
  if (now <= end) return { label: "Active", style: "bg-emerald-100 text-emerald-700" };
  return { label: "Past", style: "bg-slate-100 text-slate-500" };
}

export default async function AdminShowsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, organization:organizations(role_permissions)")
    .eq("id", user.id)
    .single();

  if (!["admin", "manager"].includes(profile?.role ?? "")) redirect("/dashboard");

  const { data: shows } = await supabase
    .from("shows")
    .select("id, name, venue_name, city, state, start_date, end_date, location:locations(name)")
    .order("start_date", { ascending: false });

  return (
    <AppShell role={profile?.role} userName={profile?.full_name} orgPerms={(profile?.organization as any)?.role_permissions ?? null}>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Shows</h1>
            <p className="text-sm text-slate-500 mt-1">{shows?.length ?? 0} show{shows?.length !== 1 ? "s" : ""}</p>
          </div>
          <Link
            href="/admin/shows/new"
            className="bg-[#00929C] hover:bg-[#007a82] text-white font-semibold text-sm px-4 py-2 rounded-xl transition-colors"
          >
            + Add Show
          </Link>
        </div>

        {!shows?.length ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <p className="text-slate-500 font-medium">No shows yet.</p>
            <Link href="/admin/shows/new" className="mt-3 inline-block text-sm text-[#00929C] font-semibold hover:underline">
              Add your first show →
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
            {shows.map((show) => {
              const status = showStatus(show.start_date, show.end_date);
              const location = Array.isArray(show.location) ? show.location[0] : show.location;
              return (
                <Link
                  key={show.id}
                  href={`/admin/shows/${show.id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 group-hover:text-[#00929C] transition-colors">{show.name}</p>
                      <p className="text-xs text-slate-400">
                        {show.venue_name && <span>{show.venue_name} · </span>}
                        {location?.name && <span>{location.name} · </span>}
                        {show.start_date && <span>{formatDate(show.start_date)}{show.end_date && show.end_date !== show.start_date ? ` – ${formatDate(show.end_date)}` : ""}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {status && (
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${status.style}`}>
                        {status.label}
                      </span>
                    )}
                    <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
