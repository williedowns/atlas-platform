export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ContractsList } from "@/components/contracts/ContractsList";
import BottomNav from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/button";

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const initialFilter = (params.filter as any) ?? "all";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "field_crew") redirect("/field");

  const isAdmin = ["admin", "manager", "bookkeeper"].includes(profile?.role ?? "");

  let query = supabase
    .from("contracts")
    .select(`
      id, contract_number, status, is_contingent,
      total, subtotal, discount_total, tax_amount, deposit_paid, balance_due,
      payment_method, notes, line_items, created_at,
      customer:customers(first_name, last_name, phone, email, address, city, state, zip),
      show:shows(name),
      location:locations(name)
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (!isAdmin) {
    query = query.eq("sales_rep_id", user.id);
  }

  const { data: contracts } = await query;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <h1 className="text-lg font-bold">Contracts</h1>
      </header>

      <main className="pb-28">
        <ContractsList contracts={(contracts ?? []) as any[]} initialFilter={initialFilter} />
      </main>

      {/* FAB */}
      <div className="fixed bottom-20 right-4 z-10">
        <Link href="/contracts/new">
          <Button variant="accent" size="xl" className="rounded-full w-16 h-16 text-2xl shadow-xl">
            +
          </Button>
        </Link>
      </div>

      <BottomNav role={profile?.role} />
    </div>
  );
}
