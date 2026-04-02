export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AddInventoryUnitForm } from "@/components/inventory/AddInventoryUnitForm";

export default async function AddInventoryUnitPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "manager"].includes(profile?.role ?? "")) redirect("/inventory");

  const [{ data: products }, { data: locations }, { data: shows }] = await Promise.all([
    supabase.from("products").select("id, name, category, line, model_code").eq("active", true).order("category").order("name"),
    supabase.from("locations").select("id, name, city, state").eq("active", true).order("name"),
    supabase.from("shows").select("id, name, venue_name, start_date, end_date").eq("active", true).order("start_date"),
  ]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <Link href="/admin/inventory" className="p-2 rounded-lg hover:bg-white/10">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-bold">Add Inventory Unit</h1>
        </div>
      </header>
      <main className="px-4 py-6 max-w-2xl mx-auto pb-24">
        <AddInventoryUnitForm
          products={products ?? []}
          locations={locations ?? []}
          shows={shows ?? []}
        />
      </main>
    </div>
  );
}
