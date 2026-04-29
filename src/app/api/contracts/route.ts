import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateContractNumber } from "@/lib/utils";
import { createQBOEstimate, createQBOCustomer } from "@/lib/qbo/client";
import { logAction } from "@/lib/audit";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    customer,
    show_id,
    location_id,
    line_items,
    discounts,
    financing,
    subtotal,
    discount_total,
    tax_amount,
    tax_rate,
    tax_exempt,
    surcharge_amount,
    surcharge_rate,
    surcharge_enabled,
    total,
    deposit_amount,
    payment_method,
    notes,
    external_notes,
    needs_permit,
    needs_hoa,
    permit_jurisdiction,
    customer_signature_url,
    signed_name,
    electronic_consent,
    consent_timestamp,
    delivery_diagram,
  } = body;

  // Capture legal metadata for signature defensibility
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? req.headers.get('x-real-ip') ?? 'unknown';
  const userAgent = req.headers.get('user-agent') ?? 'unknown';

  // Ensure customer exists in DB
  let customerId = customer.id;
  if (!customerId) {
    const { data: newCustomer, error: custError } = await supabase
      .from("customers")
      .insert({
        first_name: customer.first_name,
        last_name: customer.last_name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        zip: customer.zip,
      })
      .select()
      .single();
    if (custError) return NextResponse.json({ error: custError.message }, { status: 500 });
    customerId = newCustomer.id;
  }

  const contractNumber = generateContractNumber();
  const financingArr = Array.isArray(financing) ? financing : [];
  // Only GreenSky/WF (deduct_from_balance !== false) reduce balance at POS; Foundation carries to balance
  const financedAtSale = financingArr
    .filter((f: { deduct_from_balance?: boolean }) => f.deduct_from_balance !== false)
    .reduce((sum: number, f: { financed_amount?: number }) => sum + (f.financed_amount ?? 0), 0);
  const balanceDue = Math.max(0, total - financedAtSale - deposit_amount);

  // Create contract in DB
  const { data: contract, error } = await supabase
    .from("contracts")
    .insert({
      contract_number: contractNumber,
      status: "signed",
      customer_id: customerId,
      sales_rep_id: user.id,
      show_id: (show_id && !show_id.startsWith("store-")) ? show_id : null,
      location_id: location_id ?? null,
      line_items,
      discounts,
      financing,
      subtotal,
      discount_total,
      tax_amount,
      tax_rate,
      tax_exempt: !!tax_exempt,
      surcharge_amount: surcharge_enabled ? surcharge_amount : 0,
      surcharge_rate: surcharge_enabled ? surcharge_rate : 0,
      total,
      deposit_amount,
      deposit_paid: 0,
      balance_due: balanceDue,
      payment_method,
      customer_signature_url,
      signed_at: new Date().toISOString(),
      notes,
      external_notes: external_notes ?? null,
      needs_permit: !!needs_permit,
      needs_hoa: !!needs_hoa,
      permit_jurisdiction: permit_jurisdiction ?? null,
      permit_status: needs_permit ? "pending" : null,
      hoa_status: needs_hoa ? "pending" : null,
      delivery_diagram: delivery_diagram ?? null,
      signature_metadata: {
        ip_address: ip,
        user_agent: userAgent,
        electronic_consent: electronic_consent ?? false,
        consent_timestamp: consent_timestamp ?? null,
        signed_name: signed_name ?? null,
      },
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire-and-forget audit log
  logAction({
    userId: user.id,
    action: "contract.created",
    entityType: "contract",
    entityId: contract.id,
    metadata: {
      contract_number: contract.contract_number,
      total: contract.total,
      customer_id: contract.customer_id,
      status: contract.status,
    },
    req,
  });

  // Allocate inventory units if serial numbers provided
  for (const item of line_items) {
    if (item.serial_number) {
      await supabase
        .from("inventory_units")
        .update({ status: "allocated", contract_id: contract.id })
        .eq("serial_number", item.serial_number);
    }
  }

  // Sync to QBO (best-effort, don't fail contract creation)
  try {
    let qboCustomerId = customer.qbo_customer_id;
    if (!qboCustomerId) {
      const qboCustomer = await createQBOCustomer({
        first_name: customer.first_name,
        last_name: customer.last_name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address ?? "",
        city: customer.city ?? "",
        state: customer.state ?? "",
        zip: customer.zip ?? "",
      });
      qboCustomerId = qboCustomer.Customer?.Id;
      if (qboCustomerId) {
        await supabase
          .from("customers")
          .update({ qbo_customer_id: qboCustomerId })
          .eq("id", customerId);
      }
    }

    if (qboCustomerId) {
      const qboEstimate = await createQBOEstimate({
        qbo_customer_id: qboCustomerId,
        line_items: line_items.map((item: { qbo_item_id?: string; product_name: string; quantity: number; sell_price: number }) => ({
          qbo_item_id: item.qbo_item_id ?? "SPA",
          description: item.product_name,
          qty: item.quantity,
          unit_price: item.sell_price,
        })),
        discounts: discounts.map((d: { label: string; amount: number }) => ({
          description: d.label,
          amount: d.amount,
        })),
        tax_amount,
        contract_number: contractNumber,
      });

      await supabase
        .from("contracts")
        .update({ qbo_estimate_id: qboEstimate.Estimate?.Id })
        .eq("id", contract.id);
    }
  } catch (qboError) {
    console.error("QBO sync failed (non-fatal):", qboError);
    // Contract still created — QBO sync can be retried
  }

  // Send confirmation email (best-effort)
  try {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/contracts/${contract.id}/email`, {
      method: "POST",
    });
  } catch {
    console.error("Email send failed (non-fatal)");
  }

  return NextResponse.json({ contract_id: contract.id, contract_number: contractNumber }, { status: 201 });
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin" || profile?.role === "manager" || profile?.role === "bookkeeper";

  let query = supabase
    .from("contracts")
    .select(`*, customer:customers(*), show:shows(name), location:locations(name)`)
    .order("created_at", { ascending: false });

  if (!isAdmin) {
    query = query.eq("sales_rep_id", user.id);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
