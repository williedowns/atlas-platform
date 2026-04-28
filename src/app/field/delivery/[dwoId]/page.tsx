export const dynamic = "force-dynamic";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import DeliveryCompletion from "@/components/field/DeliveryCompletion";

export default async function FieldDeliveryPage({
  params,
}: {
  params: Promise<{ dwoId: string }>;
}) {
  const { dwoId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (profile?.role !== "field_crew" && profile?.role !== "admin" && profile?.role !== "manager") {
    redirect("/dashboard");
  }

  const { data: dwo } = await supabase
    .from("delivery_work_orders")
    .select(`
      id, scheduled_date, scheduled_window, delivery_address, special_instructions, status, completed_at,
      contract:contracts(
        id, contract_number, balance_due, total, line_items, customer_id,
        customer:customers(first_name, last_name, address, city, state, zip, phone),
        location:locations(name)
      )
    `)
    .eq("id", dwoId)
    .single();

  if (!dwo) notFound();
  const contract = Array.isArray(dwo.contract) ? dwo.contract[0] : dwo.contract;
  if (!contract) notFound();
  const customer = Array.isArray(contract.customer) ? contract.customer[0] : contract.customer;

  const customerName = customer ? `${customer.first_name} ${customer.last_name}` : "Customer";
  const address = dwo.delivery_address ?? [customer?.address, customer?.city, customer?.state, customer?.zip].filter(Boolean).join(", ");
  const items = Array.isArray(contract.line_items) ? contract.line_items : [];

  return (
    <AppShell role={profile?.role} userName={profile?.full_name}>
      <AppHeader title="Delivery" subtitle={`#${contract.contract_number}`} backHref="/field" />

      <main className="max-w-md mx-auto px-4 py-5 space-y-5">
        {/* Address + nav */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
          <p className="text-xs uppercase tracking-wide text-slate-500">Delivery Address</p>
          <p className="text-sm font-medium text-slate-900">{address || "Address on file"}</p>
          {customer?.phone && <p className="text-xs text-slate-500">{customer.phone}</p>}
          {dwo.scheduled_window && (
            <p className="text-xs text-slate-500">Window: {dwo.scheduled_window}</p>
          )}
          {dwo.special_instructions && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 mt-1">
              <span className="font-semibold">Instructions:</span> {dwo.special_instructions}
            </p>
          )}
          {address && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs font-semibold text-[#00929C] mt-1"
            >
              Open in Maps →
            </a>
          )}
        </div>

        {/* Items being delivered */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Items</p>
          <ul className="space-y-1.5 text-sm">
            {items.map((it: any, i: number) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="text-slate-700">{it.product_name}</span>
                {it.serial_number && <span className="text-xs text-slate-400 font-mono">{it.serial_number}</span>}
              </li>
            ))}
          </ul>
        </div>

        {dwo.status === "completed" ? (
          <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 text-center">
            <p className="text-emerald-800 font-bold">Delivered</p>
            <p className="text-xs text-emerald-700 mt-1">Completed {dwo.completed_at ? new Date(dwo.completed_at).toLocaleString() : ""}</p>
            <Link href={`/contracts/${contract.id}`} className="inline-block mt-3 text-sm font-semibold text-[#00929C]">
              View contract →
            </Link>
          </div>
        ) : (
          <DeliveryCompletion
            dwoId={dwo.id}
            contractId={contract.id}
            customerId={contract.customer_id ?? null}
            contractNumber={contract.contract_number}
            customerName={customerName}
            balanceDue={contract.balance_due ?? 0}
          />
        )}
      </main>
    </AppShell>
  );
}
