export const dynamic = "force-dynamic";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CollectPaymentForm } from "@/components/contracts/CollectPaymentForm";
import Link from "next/link";

export default async function CollectPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: contract } = await supabase
    .from("contracts")
    .select(`*, customer:customers(first_name, last_name), location:locations(cc_surcharge_enabled, cc_surcharge_rate)`)
    .eq("id", id)
    .single();

  if (!contract) notFound();
  if ((contract.deposit_paid ?? 0) >= contract.total) redirect(`/contracts/${id}`);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <Link href={`/contracts/${id}`} className="p-2 rounded-lg hover:bg-white/10">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold">Collect Payment</h1>
            <p className="text-xs text-[#00929C]">{contract.contract_number}</p>
          </div>
        </div>
      </header>

      <main className="px-5 py-6 max-w-2xl mx-auto pb-24">
        <CollectPaymentForm
          contractId={id}
          contractNumber={contract.contract_number}
          customerName={`${contract.customer?.first_name ?? ""} ${contract.customer?.last_name ?? ""}`.trim()}
          total={contract.total}
          depositPaid={contract.deposit_paid ?? 0}
          balanceDue={Math.max(0, contract.total - (contract.deposit_paid ?? 0))}
          surchargeEnabled={contract.location?.cc_surcharge_enabled ?? false}
          surchargeRate={contract.location?.cc_surcharge_rate ?? 0.035}
        />
      </main>
    </div>
  );
}
