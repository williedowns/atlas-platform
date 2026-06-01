import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import { renderContractPages, type ContractCcPayment } from "@/lib/contract-pdf-render";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: contract } = await supabase
    .from("contracts")
    .select("*, customer:customers(*), location:locations(*), show:shows(name, venue_name), sales_rep:profiles!contracts_sales_rep_id_fkey(full_name)")
    .eq("id", id)
    .single();

  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Completed CC charges — surfaced under "Deposit Paid" so the printed
  // agreement shows which card was actually run (e.g. "Visa ····4242").
  const { data: ccPaymentsData } = await supabase
    .from("payments")
    .select("amount, card_brand, card_last4")
    .eq("contract_id", id)
    .eq("status", "completed")
    .not("card_last4", "is", null)
    .order("created_at");
  const ccPayments: ContractCcPayment[] = ccPaymentsData ?? [];

  const isQuote = contract.status === "quote";
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  await renderContractPages(doc, contract, ccPayments);

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  const filename = isQuote
    ? `Quote-${contract.contract_number}.pdf`
    : `Contract-${contract.contract_number}.pdf`;

  return new Response(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      // `attachment` triggers a download instead of in-frame preview. The
      // iPad show-floor PWA runs in standalone mode, where opening a PDF
      // inline (even with target="_blank") replaces the app view with no
      // back button — leaving the rep stranded. Downloading routes the file
      // through iOS's Files / share sheet and keeps the contract page mounted.
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
