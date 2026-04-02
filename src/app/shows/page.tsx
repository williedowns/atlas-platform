export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export default async function ShowsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const { data: shows } = await supabase
    .from("shows")
    .select("*, location:locations(name, city, state)")
    .eq("active", true)
    .order("start_date");

  const today = new Date().toISOString().split("T")[0];
  const upcoming = shows?.filter((s) => s.end_date >= today) ?? [];
  const past = shows?.filter((s) => s.end_date < today).slice(0, 5) ?? [];

  const canCreateShows = profile?.role === "admin" || profile?.role === "manager";

  return (
    <div className="min-h-screen bg-slate-50">
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
                <Link key={show.id} href={`/shows/${show.id}`} className="block">
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
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
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

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex">
        <Link href="/dashboard" className="flex-1 flex flex-col items-center py-3 text-slate-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          <span className="text-xs mt-1">Home</span>
        </Link>
        <Link href="/contracts" className="flex-1 flex flex-col items-center py-3 text-slate-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          <span className="text-xs mt-1">Contracts</span>
        </Link>
        <Link href="/shows" className="flex-1 flex flex-col items-center py-3 text-[#00929C]">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <span className="text-xs mt-1 font-medium">Shows</span>
        </Link>
        <Link href="/profile" className="flex-1 flex flex-col items-center py-3 text-slate-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          <span className="text-xs mt-1">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
