import { NextResponse } from "next/server";
import { logAction } from "@/lib/audit";
import { requireAdminOrManager } from "@/lib/auth-guard";
import { archivePdfUrls } from "@/lib/contract-pdf";

interface CustomerInfoBody {
  first_name?: string;
  last_name?: string;
  co_buyer_first_name?: string;
  co_buyer_last_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guard = await requireAdminOrManager(id);
  if (guard instanceof NextResponse) return guard;
  const { user, supabase } = guard;

  const body = (await req.json().catch(() => ({}))) as CustomerInfoBody;

  const { data: contract } = await supabase
    .from("contracts")
    .select("id, contract_number, customer_id, contract_pdf_url, contract_pdf_archive_urls")
    .eq("id", id)
    .maybeSingle();
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  const { data: currentCustomer } = await supabase
    .from("customers")
    .select("id, first_name, last_name, co_buyer_first_name, co_buyer_last_name, email, phone, address, city, state, zip")
    .eq("id", contract.customer_id)
    .maybeSingle();
  if (!currentCustomer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const update: Record<string, string | null> = {};

  if (body.first_name !== undefined) {
    const v = String(body.first_name).trim();
    if (v.length === 0) {
      return NextResponse.json({ error: "first_name cannot be empty" }, { status: 400 });
    }
    update.first_name = v;
  }
  if (body.last_name !== undefined) {
    const v = String(body.last_name).trim();
    if (v.length === 0) {
      return NextResponse.json({ error: "last_name cannot be empty" }, { status: 400 });
    }
    update.last_name = v;
  }
  if (body.co_buyer_first_name !== undefined) {
    const v = String(body.co_buyer_first_name).trim();
    update.co_buyer_first_name = v.length === 0 ? null : v;
  }
  if (body.co_buyer_last_name !== undefined) {
    const v = String(body.co_buyer_last_name).trim();
    update.co_buyer_last_name = v.length === 0 ? null : v;
  }
  if (body.email !== undefined) {
    const v = String(body.email).trim();
    if (v.length > 0 && !EMAIL_RE.test(v)) {
      return NextResponse.json({ error: "email is not a valid email address" }, { status: 400 });
    }
    update.email = v;
  }
  if (body.phone !== undefined) {
    const v = String(body.phone).trim();
    if (v.length === 0) {
      return NextResponse.json({ error: "phone cannot be empty" }, { status: 400 });
    }
    update.phone = v;
  }
  if (body.address !== undefined) update.address = String(body.address).trim();
  if (body.city !== undefined) update.city = String(body.city).trim();
  if (body.state !== undefined) update.state = String(body.state).trim();
  if (body.zip !== undefined) update.zip = String(body.zip).trim();

  const materialChange =
    (update.first_name !== undefined && update.first_name !== (currentCustomer.first_name ?? "")) ||
    (update.last_name !== undefined && update.last_name !== (currentCustomer.last_name ?? "")) ||
    (update.co_buyer_first_name !== undefined && (update.co_buyer_first_name ?? "") !== (currentCustomer.co_buyer_first_name ?? "")) ||
    (update.co_buyer_last_name !== undefined && (update.co_buyer_last_name ?? "") !== (currentCustomer.co_buyer_last_name ?? "")) ||
    (update.address !== undefined && update.address !== (currentCustomer.address ?? "")) ||
    (update.city !== undefined && update.city !== (currentCustomer.city ?? "")) ||
    (update.state !== undefined && update.state !== (currentCustomer.state ?? "")) ||
    (update.zip !== undefined && update.zip !== (currentCustomer.zip ?? ""));

  if (materialChange) {
    const { error: contractError } = await supabase
      .from("contracts")
      .update(archivePdfUrls(contract.contract_pdf_url, contract.contract_pdf_archive_urls))
      .eq("id", id);

    if (contractError) {
      return NextResponse.json({ error: contractError.message }, { status: 500 });
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from("customers")
    .update(update)
    .eq("id", contract.customer_id)
    .select("id, first_name, last_name, co_buyer_first_name, co_buyer_last_name, email, phone, address, city, state, zip")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const before = {
    first_name: currentCustomer.first_name,
    last_name: currentCustomer.last_name,
    co_buyer_first_name: currentCustomer.co_buyer_first_name,
    co_buyer_last_name: currentCustomer.co_buyer_last_name,
    email: currentCustomer.email,
    phone: currentCustomer.phone,
    address: currentCustomer.address,
    city: currentCustomer.city,
    state: currentCustomer.state,
    zip: currentCustomer.zip,
  };
  const after = {
    first_name: updated?.first_name ?? currentCustomer.first_name,
    last_name: updated?.last_name ?? currentCustomer.last_name,
    co_buyer_first_name: updated ? updated.co_buyer_first_name : currentCustomer.co_buyer_first_name,
    co_buyer_last_name: updated ? updated.co_buyer_last_name : currentCustomer.co_buyer_last_name,
    email: updated?.email ?? currentCustomer.email,
    phone: updated?.phone ?? currentCustomer.phone,
    address: updated?.address ?? currentCustomer.address,
    city: updated?.city ?? currentCustomer.city,
    state: updated?.state ?? currentCustomer.state,
    zip: updated?.zip ?? currentCustomer.zip,
  };

  logAction({
    userId: user.id,
    action: "contract.customer_info_updated",
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

  return NextResponse.json({ customer: updated, pdf_archived: materialChange });
}
