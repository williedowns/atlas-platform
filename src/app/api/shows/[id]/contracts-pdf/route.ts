import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import { renderContractPages, type ContractCcPayment } from "@/lib/contract-pdf-render";

export const dynamic = "force-dynamic";
// Bundling a full show's worth of contracts (each with embedded signature /
// blem images fetched over the network) is heavier than a single contract, so
// allow more headroom than the default serverless budget.
export const maxDuration = 60;

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
  // the contracts this user is allowed to see.
  const { data: contractsRaw } = await supabase
    .from("contracts")
    .select("*, customer:customers(*), location:locations(*), show:shows(name, venue_name), sales_rep:profiles!contracts_sales_rep_id_fkey(full_name)")
    .eq("show_id", id)
    .order("created_at", { ascending: true });

  // Purchase-agreements packet: include only executed agreements. Exclude
  // quotes, unfinished drafts, and voided (cancelled) contracts — the same
  // trio the show page treats as "not a real contract." Dropping every quote
  // also makes the converted-quote dedup unnecessary (no duplicate can remain).
  const NON_AGREEMENT_STATUSES = new Set(["quote", "draft", "cancelled"]);
  const contracts = (contractsRaw ?? []).filter(
    (c) => !NON_AGREEMENT_STATUSES.has(c.status)
  );

  if (contracts.length === 0) {
    return NextResponse.json({ error: "No purchase agreements for this show" }, { status: 404 });
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
