import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!["admin", "manager", "bookkeeper"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get("dateFrom") ?? new Date().toISOString().split("T")[0];
  const dateTo = searchParams.get("dateTo") ?? new Date().toISOString().split("T")[0];
  const search = (searchParams.get("search") ?? "").toLowerCase().trim();

  // Fetch card/debit payments with full contract + customer + location data
  const { data: payments, error } = await supabase
    .from("payments")
    .select(`
      id, amount, method, card_brand, card_last4, processed_at, status,
      contract:contracts(
        id, contract_number, total, deposit_paid,
        line_items,
        customer:customers(first_name, last_name),
        show:shows(name),
        location:locations(name)
      )
    `)
    .in("method", ["credit_card", "debit_card"])
    .eq("status", "completed")
    .gte("processed_at", `${dateFrom}T00:00:00`)
    .lte("processed_at", `${dateTo}T23:59:59`)
    .order("processed_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Flatten and search-filter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows = (payments ?? []).map((p: any) => {
    const contract = Array.isArray(p.contract) ? p.contract[0] : p.contract;
    const customer = Array.isArray(contract?.customer) ? contract.customer[0] : contract?.customer;
    const show = Array.isArray(contract?.show) ? contract.show[0] : contract?.show;
    const location = Array.isArray(contract?.location) ? contract.location[0] : contract?.location;
    const lineItems = Array.isArray(contract?.line_items) ? contract.line_items : [];
    const productSummary = lineItems
      .map((li: { product_name: string; quantity?: number }) =>
        li.quantity && li.quantity > 1 ? `${li.product_name} (x${li.quantity})` : li.product_name
      )
      .join(", ");
    const salesLocation = show?.name ?? location?.name ?? "—";
    const isFullPayment = contract
      ? Math.abs((contract.deposit_paid ?? 0) - contract.total) < 0.01
      : false;

    return {
      payment_id: p.id,
      date: p.processed_at,
      customer_name: customer ? `${customer.first_name} ${customer.last_name}` : "—",
      product_size: productSummary || "—",
      sales_location: salesLocation,
      payment_type: isFullPayment ? "Paid in Full" : "Down Payment",
      amount: p.amount,
      card_type: p.card_brand ?? (p.method === "debit_card" ? "Debit" : "Credit"),
      card_last4: p.card_last4 ?? null,
      contract_number: contract?.contract_number ?? "—",
    };
  });

  // Apply search filter across key fields
  if (search) {
    rows = rows.filter((r) =>
      r.customer_name.toLowerCase().includes(search) ||
      r.contract_number.toLowerCase().includes(search) ||
      r.sales_location.toLowerCase().includes(search) ||
      r.product_size.toLowerCase().includes(search) ||
      (r.card_type ?? "").toLowerCase().includes(search)
    );
  }

  const total = rows.reduce((sum, r) => sum + r.amount, 0);

  return NextResponse.json({ rows, total, count: rows.length, dateFrom, dateTo });
}
