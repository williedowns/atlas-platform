import { NextResponse } from "next/server";
import { logAction } from "@/lib/audit";
import { requireAdminOrManager } from "@/lib/auth-guard";
import { archivePdfUrls } from "@/lib/contract-pdf";

interface NotesBody {
  notes?: string | null;
  external_notes?: string | null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guard = await requireAdminOrManager();
  if (guard instanceof NextResponse) return guard;
  const { user, supabase } = guard;

  const body = (await req.json().catch(() => ({}))) as NotesBody;

  const { data: contract } = await supabase
    .from("contracts")
    .select("id, contract_number, notes, external_notes, contract_pdf_url, contract_pdf_archive_urls")
    .eq("id", id)
    .maybeSingle();
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  const update: { notes?: string | null; external_notes?: string | null; contract_pdf_url?: null; contract_pdf_archive_urls?: string[] } = {};

  if (body.notes !== undefined) {
    update.notes = body.notes === null ? null : String(body.notes);
  }
  if (body.external_notes !== undefined) {
    update.external_notes = body.external_notes === null ? null : String(body.external_notes);
  }

  const materialChange =
    update.external_notes !== undefined &&
    (update.external_notes ?? null) !== (contract.external_notes ?? null);

  if (materialChange) {
    Object.assign(update, archivePdfUrls(contract.contract_pdf_url, contract.contract_pdf_archive_urls));
  }

  const { error: updateError } = await supabase
    .from("contracts")
    .update(update)
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const before = {
    notes: contract.notes ?? null,
    external_notes: contract.external_notes ?? null,
  };
  const after = {
    notes: update.notes !== undefined ? update.notes : contract.notes ?? null,
    external_notes:
      update.external_notes !== undefined ? update.external_notes : contract.external_notes ?? null,
  };

  logAction({
    userId: user.id,
    action: "contract.notes_updated",
    entityType: "contract",
    entityId: id,
    metadata: {
      contract_number: contract.contract_number,
      before,
      after,
      pdf_archived: materialChange,
    },
    req,
  });

  return NextResponse.json({ ok: true, pdf_archived: materialChange });
}
