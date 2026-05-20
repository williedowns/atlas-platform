export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/active-show";
import ShowPickerGrid from "./_components/ShowPickerGrid";
import SkipForNowLink from "./_components/SkipForNowLink";
import { formatDate } from "@/lib/utils";

export default async function SelectActiveShowPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  // If they already have a valid active workspace, send them home.
  const existing = await getActiveWorkspace();
  if (existing) redirect("/dashboard");

  // Shows running today.
  const today = new Date().toISOString().split("T")[0];
  const [showsResult, showroomsResult] = await Promise.all([
    supabase
      .from("shows")
      .select("id, name, venue_name, city, state, start_date, end_date")
      .lte("start_date", today)
      .gte("end_date", today)
      .eq("active", true)
      .order("start_date", { ascending: true }),
    supabase
      .from("locations")
      .select("id, name, city, state, address")
      .eq("type", "store")
      .eq("active", true)
      .order("name", { ascending: true }),
  ]);

  const shows = (showsResult.data ?? []).map((s) => ({
    type: "show" as const,
    id: s.id,
    name: s.name,
    venue_name: s.venue_name,
    city: s.city,
    state: s.state,
    dateLabel:
      s.start_date === s.end_date
        ? formatDate(s.start_date)
        : `${formatDate(s.start_date)} – ${formatDate(s.end_date)}`,
  }));

  const showrooms = (showroomsResult.data ?? []).map((l) => ({
    type: "location" as const,
    id: l.id,
    name: l.name,
    address: l.address,
    city: l.city,
    state: l.state,
  }));

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const nothingAvailable = shows.length === 0 && showrooms.length === 0;

  return (
    <div className="min-h-screen bg-[#010F21] flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <p className="text-sm font-bold uppercase tracking-widest text-[#00929C]">
              {greeting}, {firstName}
            </p>
            <h1 className="text-3xl sm:text-4xl font-black text-white mt-2">
              Where are you working today?
            </h1>
            <p className="text-base text-slate-400 mt-2">
              We&rsquo;ll set this as your default across Check-Ins and Contracts.
            </p>
          </div>

          {nothingAvailable ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
              <p className="text-lg text-slate-300">Nothing to pick from today.</p>
              <p className="text-sm text-slate-500 mt-2">
                No shows running and no active showrooms.
              </p>
              <div className="mt-6">
                <SkipForNowLink label="Continue to dashboard" />
              </div>
            </div>
          ) : (
            <>
              <ShowPickerGrid shows={shows} showrooms={showrooms} />
              <div className="mt-6 text-center">
                <SkipForNowLink label="Skip for now" />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
