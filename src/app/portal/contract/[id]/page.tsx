export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import CertUpload from "./CertUpload";

const STATUS_STEPS = [
  { key: "pending_signature", label: "Contract Signed", desc: "Your purchase agreement has been signed." },
  { key: "deposit_collected", label: "Order Confirmed", desc: "Your deposit has been received and your order is confirmed." },
  { key: "in_production", label: "In Production", desc: "Your spa is being built to your specifications." },
  { key: "ready_for_delivery", label: "Ready for Delivery", desc: "Your spa is ready! We'll be in touch to schedule delivery." },
  { key: "delivered", label: "Delivered", desc: "Your spa has been delivered and installed. Enjoy!" },
];

const STATUS_ORDER: Record<string, number> = {
  pending_signature: 0, signed: 0, deposit_collected: 1,
  in_production: 2, ready_for_delivery: 3, delivered: 4,
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default async function PortalContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  // Check if the viewer is a staff member (admin/manager/sales_rep/bookkeeper/field_crew)
  const { data: staffProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isStaff = !!staffProfile?.role;

  let contract;
  if (isStaff) {
    // Staff preview — fetch by ID only, no customer ownership check
    const { data } = await supabase
      .from("contracts")
      .select(`
        id, contract_number, status, total, subtotal, tax_amount,
        deposit_paid, balance_due, payment_method, created_at,
        line_items, contract_pdf_url,
        tax_exempt_cert_received, tax_exempt_cert_received_at,
        customer:customers(first_name, last_name, email, phone),
        show:shows(name),
        location:locations(name, address, city, state, zip)
      `)
      .eq("id", id)
      .single();
    contract = data;
  } else {
    // Customer — verify they own this contract
    const { data: customer } = await supabase
      .from("customers").select("id").eq("email", user.email ?? "").maybeSingle();

    const { data } = await supabase
      .from("contracts")
      .select(`
        id, contract_number, status, total, subtotal, tax_amount,
        deposit_paid, balance_due, payment_method, created_at,
        line_items, contract_pdf_url,
        tax_exempt_cert_received, tax_exempt_cert_received_at,
        customer:customers(first_name, last_name, email, phone),
        show:shows(name),
        location:locations(name, address, city, state, zip)
      `)
      .eq("id", id)
      .eq("customer_id", customer?.id ?? "00000000-0000-0000-0000-000000000000")
      .single();
    contract = data;
  }

  if (!contract) redirect("/portal/dashboard");

  const c = contract as any;
  const items: any[] = Array.isArray(c.line_items) ? c.line_items : [];
  const step = STATUS_ORDER[c.status] ?? 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Link href="/portal/dashboard" className="text-white/60 hover:text-white">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <p className="font-bold">{c.contract_number}</p>
            <p className="text-white/60 text-xs">{formatDate(c.created_at)}</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 max-w-2xl mx-auto space-y-4">

        {/* Order Status Timeline */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-bold text-slate-900 mb-4">Order Status</h2>
          <div className="space-y-3">
            {STATUS_STEPS.map((s, i) => {
              const done = i <= step;
              const current = i === step;
              return (
                <div key={s.key} className={`flex gap-3 ${done ? "" : "opacity-40"}`}>
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${done ? "bg-[#00929C]" : "bg-slate-200"}`}>
                      {done ? (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      ) : (
                        <span className="text-xs font-bold text-slate-400">{i + 1}</span>
                      )}
                    </div>
                    {i < STATUS_STEPS.length - 1 && <div className={`w-0.5 h-full min-h-[16px] mt-1 ${done && i < step ? "bg-[#00929C]" : "bg-slate-200"}`} />}
                  </div>
                  <div className="pb-3">
                    <p className={`font-semibold text-sm ${current ? "text-[#00929C]" : done ? "text-slate-900" : "text-slate-400"}`}>{s.label}</p>
                    {current && <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Products */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-bold text-slate-900 mb-3">Your Purchase</h2>
          <div className="space-y-2">
            {items.map((item: any, i: number) => (
              <div key={i} className="flex justify-between items-center">
                <div>
                  <p className={`text-sm font-medium ${item.waived ? "text-slate-400" : "text-slate-900"}`}>{item.product_name}</p>
                  {(item.shell_color || item.cabinet_color) && (
                    <p className="text-xs text-slate-400">{[item.shell_color, item.cabinet_color && `${item.cabinet_color} cabinet`].filter(Boolean).join(" · ")}</p>
                  )}
                </div>
                <p className={`text-sm font-semibold ${item.waived ? "text-emerald-600" : "text-slate-900"}`}>
                  {item.waived ? "FREE" : formatCurrency(item.sell_price * item.quantity)}
                </p>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 mt-3 pt-3 space-y-1">
            <div className="flex justify-between text-sm"><span className="text-slate-500">Subtotal</span><span>{formatCurrency(c.subtotal)}</span></div>
            {c.tax_amount > 0 && <div className="flex justify-between text-sm"><span className="text-slate-500">Tax</span><span>{formatCurrency(c.tax_amount)}</span></div>}
            <div className="flex justify-between font-bold text-[#00929C] text-base border-t border-slate-100 pt-2 mt-1"><span>Total</span><span>{formatCurrency(c.total)}</span></div>
            <div className="flex justify-between text-sm text-emerald-600"><span>Deposit Paid</span><span>-{formatCurrency(c.deposit_paid)}</span></div>
            {c.balance_due > 0 && <div className="flex justify-between text-sm font-semibold text-amber-600"><span>Balance Due at Delivery</span><span>{formatCurrency(c.balance_due)}</span></div>}
          </div>
        </div>

        {/* PDF Download */}
        {c.contract_pdf_url && (
          <a href={c.contract_pdf_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-4 hover:border-[#00929C]/40 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              </div>
              <div><p className="font-semibold text-slate-900">Signed Contract PDF</p><p className="text-xs text-slate-400">Tap to view or download</p></div>
            </div>
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          </a>
        )}

        {/* TX Tax Exemption Cert Upload */}
        <CertUpload
          contractId={c.id}
          certReceived={!!c.tax_exempt_cert_received}
          certReceivedAt={c.tax_exempt_cert_received_at}
        />

      </main>
    </div>
  );
}
