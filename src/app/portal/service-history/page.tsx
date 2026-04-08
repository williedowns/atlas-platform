export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const URGENCY_STYLES: Record<string, string> = {
  routine: "bg-slate-100 text-slate-600",
  urgent: "bg-amber-100 text-amber-700",
  emergency: "bg-red-100 text-red-700",
};

const STATUS_STYLES: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  acknowledged: "bg-teal-100 text-teal-700",
  scheduled: "bg-purple-100 text-purple-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-500",
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function PortalServiceHistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const { data: customer } = await supabase
    .from("customers")
    .select("id, first_name, last_name")
    .eq("email", user.email ?? "")
    .maybeSingle();

  let requests: any[] = [];
  if (customer) {
    const { data } = await supabase
      .from("service_requests")
      .select(`
        id, description, urgency, contact_method, status, admin_notes, created_at,
        equipment:equipment(product_name)
      `)
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });
    requests = data ?? [];
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/portal/dashboard" className="text-white/50 hover:text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <img src="/logo.png" alt="Atlas Spas" className="h-8 w-auto bg-white rounded px-2 py-0.5" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <p className="text-white/60 text-xs mt-0.5">Service History</p>
            </div>
          </div>
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-white/50 text-xs hover:text-white">Sign out</button>
          </form>
        </div>
      </header>

      <main className="px-4 py-6 max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg text-slate-900">Service Requests</h2>
          <Link
            href="/portal/service-request"
            className="text-sm font-semibold text-[#00929C] hover:text-[#007a82] border border-[#00929C]/30 rounded-lg px-3 py-1.5 hover:border-[#00929C]/60 transition-colors"
          >
            + New Request
          </Link>
        </div>

        {requests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <p className="text-slate-500 font-medium">No service requests yet.</p>
            <p className="text-sm text-slate-400 mt-1 mb-4">Need help with your spa or swim spa?</p>
            <Link
              href="/portal/service-request"
              className="inline-block bg-[#00929C] text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-[#007a82] transition-colors"
            >
              Submit Your First Request
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => {
              const equipment = Array.isArray(req.equipment) ? req.equipment[0] : req.equipment;
              return (
                <div key={req.id} className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[req.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {req.status?.replace(/_/g, " ")}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${URGENCY_STYLES[req.urgency] ?? "bg-slate-100 text-slate-600"}`}>
                        {req.urgency}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">{formatDate(req.created_at)}</p>
                  </div>

                  {equipment?.product_name && (
                    <p className="text-xs text-slate-500 font-medium mb-1">{equipment.product_name}</p>
                  )}

                  <p className="text-sm text-slate-700 line-clamp-2">{req.description}</p>

                  {req.admin_notes && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-xs font-semibold text-[#00929C] mb-0.5">Update from Atlas:</p>
                      <p className="text-sm text-slate-600 italic">{req.admin_notes}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
