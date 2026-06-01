import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import { renderContractPages, type ContractCcPayment } from "@/lib/contract-pdf-render";

export const dynamic = "force-dynamic";
// Bundling a full show's worth of contracts (each with embedded signature /
// blem images fetched over the network) is heavier than a single contract, so
// allow more headroom than the default serverless budget.
export const maxDuration = 60;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function customerNameKey(c: any): string {
  const cust = Array.isArray(c.customer) ? c.customer[0] : c.customer;
  const first = (cust?.first_name ?? "").trim().toLowerCase();
  const last = (cust?.last_name ?? "").trim().toLowerCase();
  return `${first}|${last}`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: show } = await supabase
    .from("shows")
    .select("name")
    .eq("id", id)
    .single();

  // Same select shape as /api/contracts/[id]/pdf so the shared renderer has
  // every field it needs. The user-scoped client means RLS returns exactly
  // the contracts this user is allowed to see — identical to the on-screen
  // "Contracts (N)" list on the show page.
  const { data: contractsRaw } = await supabase
    .from("contracts")
    .select("*, customer:customers(*), location:locations(*), show:shows(name, venue_name), sales_rep:profiles!contracts_sales_rep_id_fkey(full_name)")
    .eq("show_id", id)
    .order("created_at", { ascending: true });

  // Mirror the show page's converted-quote dedup: hide quotes whose customer
  // already has a non-quote contract on this show (matched by customer_id OR
  // name, since rebuild-from-scratch makes a new customer row with same name).
  const convertedCustomerIds = new Set<string>();
  const convertedNameKeys = new Set<string>();
  for (const r of contractsRaw ?? []) {
    if (r.status === "quote" || r.status === "draft" || r.status === "cancelled") continue;
    if (r.customer_id) convertedCustomerIds.add(r.customer_id);
    const key = customerNameKey(r);
    if (key !== "|") convertedNameKeys.add(key);
  }
  const contracts = (contractsRaw ?? []).filter((c) => {
    if (c.status !== "quote") return true;
    if (c.customer_id && convertedCustomerIds.has(c.customer_id)) return false;
    const key = customerNameKey(c);
    if (key !== "|" && convertedNameKeys.has(key)) return false;
    return true;
  });

  if (contracts.length === 0) {
    return NextResponse.json({ error: "No contracts for this show" }, { status: 404 });
  }

  // Batch the CC-card detail for every contract in one query, then group —
  // avoids N round-trips while keeping per-contract created_at ordering.
  const ids = contracts.map((c) => c.id);
  const { data: payRows } = await supabase
    .from("payments")
    .select("contract_id, amount, card_brand, card_last4")
    .in("contract_id", ids)
    .eq("status", "completed")
    .not("card_last4", "is", null)
    .order("created_at");
  const ccByContract = new Map<string, ContractCcPayment[]>();
  for (const p of payRows ?? []) {
    const arr = ccByContract.get(p.contract_id) ?? [];
    arr.push({ amount: p.amount, card_brand: p.card_brand, card_last4: p.card_last4 });
    ccByContract.set(p.contract_id, arr);
  }

  // One doc, each contract on its own fresh page (renderer footers each
  // contract's pages independently — "Page 1 of N" resets per contract).
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  for (let i = 0; i < contracts.length; i++) {
    if (i > 0) doc.addPage();
    await renderContractPages(doc, contracts[i], ccByContract.get(contracts[i].id) ?? []);
  }

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  const safeName = (show?.name ?? "Show")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "Show";
  const filename = `Contracts-${safeName}.pdf`;

  return new Response(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      // Match the single-contract route: force download (iOS PWA share sheet
      // is handled client-side by PdfDownloadButton) instead of inline view.
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
