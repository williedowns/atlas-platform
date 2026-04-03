export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const STATUS_STEPS = [
  { key: "pending_signature", label: "Signed" },
  { key: "deposit_collected", label: "Order Placed" },
  { key: "in_production", label: "In Production" },
  { key: "ready_for_delivery", label: "Ready" },
  { key: "delivered", label: "Delivered" },
];

const STATUS_ORDER: Record<string, number> = {
  pending_signature: 0,
  signed: 0,
  deposit_collected: 1,
  in_production: 2,
  ready_for_delivery: 3,
  delivered: 4,
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function PortalDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  // Find customer record by email
  const { data: customer } = await supabase
    .from("customers")
    .select("id, first_name, last_name")
    .eq("email", user.email ?? "")
    .maybeSingle();

  const contracts: any[] = [];
  if (customer) {
    const { data } = await supabase
      .from("contracts")
      .select(`
        id, contract_number, status, total, deposit_paid, balance_due,
        created_at, line_items,
        show:shows(name),
        location:locations(name)
      `)
      .eq("customer_id", customer.id)
      .not("status", "in", '("draft","cancelled")')
      .order("created_at", { ascending: false });
    contracts.push(...(data ?? []));
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <img src="/logo.png" alt="Atlas Spas" className="h-8 w-auto bg-white rounded px-2 py-0.5" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <p className="text-white/60 text-xs mt-0.5">Welcome back, {customer?.first_name ?? user.email}</p>
          </div>
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-white/50 text-xs hover:text-white">Sign out</button>
          </form>
        </div>
      </header>

      <main className="px-4 py-6 max-w-2xl mx-auto space-y-4">
        <h2 className="font-bold text-lg text-slate-900">Your Orders</h2>

        {contracts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <p className="text-slate-500">No orders found.</p>
            <p className="text-sm text-slate-400 mt-1">If you just purchased, it may take a few minutes to appear.</p>
          </div>
        ) : (
          contracts.map((c) => {
            const items: any[] = Array.isArray(c.line_items) ? c.line_items : [];
            const productNames = items.filter((i: any) => !i.waived).map((i: any) => i.product_name).filter(Boolean);
            const step = STATUS_ORDER[c.status] ?? 0;

            return (
              <Link key={c.id} href={`/portal/contract/${c.id}`} className="block bg-white rounded-2xl border border-slate-200 p-5 hover:border-[#00929C]/40 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="font-bold text-slate-900">{productNames.join(", ") || "Order"}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{c.contract_number} · {formatDate(c.created_at)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-[#00929C]">{formatCurrency(c.total)}</p>
                    {c.balance_due > 0 && <p className="text-xs text-amber-600 mt-0.5">Bal: {formatCurrency(c.balance_due)}</p>}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="flex items-center gap-1">
                  {STATUS_STEPS.map((s, i) => (
                    <div key={s.key} className="flex-1 flex flex-col items-center gap-1">
                      <div className={`h-1.5 w-full rounded-full ${i <= step ? "bg-[#00929C]" : "bg-slate-200"}`} />
                      {i === step && <p className="text-xs font-semibold text-[#00929C] whitespace-nowrap">{s.label}</p>}
                    </div>
                  ))}
                </div>
              </Link>
            );
          })
        )}
      </main>
    </div>
  );
}
