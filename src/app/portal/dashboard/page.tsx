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
  const equipment: any[] = [];
  if (customer) {
    const [{ data: contractData }, { data: equipmentData }] = await Promise.all([
      supabase
        .from("contracts")
        .select(`
          id, contract_number, status, total, deposit_paid, balance_due,
          created_at, line_items,
          show:shows(name),
          location:locations(name)
        `)
        .eq("customer_id", customer.id)
        .not("status", "in", '("draft","cancelled")')
        .order("created_at", { ascending: false }),
      supabase
        .from("equipment")
        .select("id, product_name, serial_number, purchase_date, warranty_expires")
        .eq("customer_id", customer.id)
        .order("product_name"),
    ]);
    contracts.push(...(contractData ?? []));
    equipment.push(...(equipmentData ?? []));
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#010F21] text-white sticky top-0 z-10 shadow-lg">
        <div className="max-w-3xl mx-auto h-16 px-5 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Atlas Spas"
              className="h-9 w-9 object-contain bg-white rounded-lg p-1 shadow-sm shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight truncate">Your Atlas Spas Account</p>
              <p className="text-white/50 text-xs leading-tight truncate">
                Welcome back, {customer?.first_name ?? user.email}
              </p>
            </div>
          </div>
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-white/50 text-xs hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="px-4 py-6 max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg text-slate-900">Your Orders</h2>
          <div className="flex items-center gap-3">
            <Link
              href="/portal/service-history"
              className="text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors"
            >
              Service History
            </Link>
            <Link
              href="/portal/service-request"
              className="flex items-center gap-1.5 text-sm font-semibold text-[#00929C] hover:text-[#007a82] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Request Service
            </Link>
          </div>
        </div>

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

        {/* Equipment */}
        {equipment.length > 0 && (
          <>
            <h2 className="font-bold text-lg text-slate-900 pt-2">Your Equipment</h2>
            {equipment.map((eq) => (
              <div key={eq.id} className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{eq.product_name}</p>
                    {eq.serial_number && (
                      <p className="text-xs text-slate-500 mt-0.5">S/N: {eq.serial_number}</p>
                    )}
                    {eq.purchase_date && (
                      <p className="text-xs text-slate-400 mt-0.5">Purchased {formatDate(eq.purchase_date)}</p>
                    )}
                    {eq.warranty_expires && (
                      <p className={`text-xs mt-0.5 font-medium ${new Date(eq.warranty_expires) > new Date() ? "text-emerald-600" : "text-slate-400"}`}>
                        Warranty {new Date(eq.warranty_expires) > new Date() ? `expires ${formatDate(eq.warranty_expires)}` : "expired"}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/portal/service-request?equipment_id=${eq.id}`}
                    className="flex-shrink-0 text-xs font-semibold text-[#00929C] hover:text-[#007a82] border border-[#00929C]/30 rounded-lg px-3 py-1.5 hover:border-[#00929C]/60 transition-colors"
                  >
                    Request Service
                  </Link>
                </div>
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
