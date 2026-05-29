import { NextResponse } from "next/server";
import { logAction } from "@/lib/audit";
import { requireAdminOrManager } from "@/lib/auth-guard";
import { archivePdfUrls } from "@/lib/contract-pdf";

interface AssignmentBody {
  show_id?: string | null;
  location_id?: string | null;
  sales_rep_id?: string;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guard = await requireAdminOrManager(id);
  if (guard instanceof NextResponse) return guard;
  const { user, supabase } = guard;

  const body = (await req.json().catch(() => ({}))) as AssignmentBody;

  const hasShow = Object.prototype.hasOwnProperty.call(body, "show_id");
  const hasLocation = Object.prototype.hasOwnProperty.call(body, "location_id");
  const hasSalesRep = Object.prototype.hasOwnProperty.call(body, "sales_rep_id");

  if (!hasShow && !hasLocation && !hasSalesRep) {
    return NextResponse.json(
      { error: "At least one of show_id, location_id, or sales_rep_id must be provided." },
      { status: 400 }
    );
  }

  if (hasShow && body.show_id !== null && typeof body.show_id !== "string") {
    return NextResponse.json({ error: "show_id must be a string or null" }, { status: 400 });
  }
  if (hasLocation) {
    if (typeof body.location_id !== "string" || body.location_id.length === 0) {
      return NextResponse.json(
        { error: "location_id is required and cannot be null" },
        { status: 400 }
      );
    }
  }
  if (hasSalesRep) {
    if (typeof body.sales_rep_id !== "string" || body.sales_rep_id.length === 0) {
      return NextResponse.json(
        { error: "sales_rep_id must be a non-empty string" },
        { status: 400 }
      );
    }
  }

  const { data: contract } = await supabase
    .from("contracts")
    .select("id, contract_number, show_id, location_id, sales_rep_id, contract_pdf_url, contract_pdf_archive_urls")
    .eq("id", id)
    .maybeSingle();
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  const [showCheck, locationCheck, repCheck] = await Promise.all([
    hasShow && body.show_id
      ? supabase.from("shows").select("id").eq("id", body.show_id).maybeSingle()
      : Promise.resolve({ data: { id: "skip" } as { id: string } | null }),
    hasLocation
      ? supabase.from("locations").select("id").eq("id", body.location_id as string).maybeSingle()
      : Promise.resolve({ data: { id: "skip" } as { id: string } | null }),
    hasSalesRep
      ? supabase.from("profiles").select("id").eq("id", body.sales_rep_id as string).maybeSingle()
      : Promise.resolve({ data: { id: "skip" } as { id: string } | null }),
  ]);
  if (!showCheck.data) {
    return NextResponse.json({ error: "show_id does not reference a valid show" }, { status: 400 });
  }
  if (!locationCheck.data) {
    return NextResponse.json({ error: "location_id does not reference a valid location" }, { status: 400 });
  }
  if (!repCheck.data) {
    return NextResponse.json({ error: "sales_rep_id does not reference a valid profile" }, { status: 400 });
  }

  const nextShowId = hasShow ? (body.show_id as string | null) : contract.show_id;
  const nextLocationId = hasLocation ? (body.location_id as string) : contract.location_id;
  const nextSalesRepId = hasSalesRep ? (body.sales_rep_id as string) : contract.sales_rep_id;

  const materialChange =
    nextShowId !== contract.show_id ||
    nextLocationId !== contract.location_id ||
    nextSalesRepId !== contract.sales_rep_id;

  const updatePayload: Record<string, unknown> = {};
  if (hasShow) updatePayload.show_id = body.show_id;
  if (hasLocation) updatePayload.location_id = body.location_id;
  if (hasSalesRep) updatePayload.sales_rep_id = body.sales_rep_id;

  let pdfArchived = false;
  if (materialChange) {
    Object.assign(updatePayload, archivePdfUrls(contract.contract_pdf_url, contract.contract_pdf_archive_urls));
    pdfArchived = !!contract.contract_pdf_url;
  }

  const { error: writeError } = await supabase
    .from("contracts")
    .update(updatePayload)
    .eq("id", id);

  if (writeError) return NextResponse.json({ error: writeError.message }, { status: 500 });

  logAction({
    userId: user.id,
    action: "contract.assignment_updated",
    entityType: "contract",
    entityId: id,
    metadata: {
      contract_number: contract.contract_number,
      before: {
        show_id: contract.show_id,
        location_id: contract.location_id,
        sales_rep_id: contract.sales_rep_id,
      },
      after: {
        show_id: nextShowId,
        location_id: nextLocationId,
        sales_rep_id: nextSalesRepId,
      },
      pdf_archived: pdfArchived,
    },
    req,
  });

  return NextResponse.json({ ok: true, pdf_archived: pdfArchived });
}
