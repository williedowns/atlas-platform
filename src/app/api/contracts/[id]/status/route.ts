import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";
import { createQBOFinalInvoice, applyDepositsToInvoice } from "@/lib/qbo/client";

const FORWARD_TRANSITIONS: Record<string, string> = {
  draft: "pending_signature",
  pending_signature: "signed",
  signed: "deposit_collected",
  deposit_collected: "in_production",
  in_production: "ready_for_delivery",
  ready_for_delivery: "delivered",
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const { status: newStatus } = await req.json();
  const isAdminOrManager = ["admin", "manager"].includes(profile?.role ?? "");

  const { data: contract } = await supabase
    .from("contracts")
    .select("status, sales_rep_id, customer_id, line_items, contract_number")
    .eq("id", id)
    .single();

  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Reps can only update their own contracts
  if (!isAdminOrManager && contract.sales_rep_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Validate transition
  const allowedNext = FORWARD_TRANSITIONS[contract.status];
  const isCancellation = newStatus === "cancelled";

  if (isCancellation && !isAdminOrManager) {
    return NextResponse.json({ error: "Only managers can cancel contracts" }, { status: 403 });
  }

  if (!isCancellation && newStatus !== allowedNext) {
    return NextResponse.json(
      { error: `Invalid transition: ${contract.status} → ${newStatus}` },
      { status: 400 }
    );
  }

  const { data: updated, error } = await supabase
    .from("contracts")
    .update({ status: newStatus })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── Delivery: equipment registration + QBO final invoice + Avalara commit ──
  if (newStatus === "delivered" && contract.customer_id) {
    const lineItems: any[] = Array.isArray(contract.line_items) ? contract.line_items : [];
    const products = lineItems.filter((i: any) => !i.waived && i.product_name);

    // Auto-create equipment registry entries
    if (products.length > 0) {
      await supabase.from("equipment").insert(
        products.map((item: any) => ({
          customer_id: contract.customer_id,
          contract_id: id,
          product_name: item.product_name,
          purchase_date: new Date().toISOString().slice(0, 10),
        }))
      );
    }

    // Fetch full contract with QBO-related fields for final invoice
    const { data: fullContract } = await supabase
      .from("contracts")
      .select(`
        *,
        customer:customers(qbo_customer_id, first_name, last_name),
        location:locations(name, qbo_department_id, qbo_deposit_account_id, address, city, state, zip),
        show:shows(name, qbo_department_id, qbo_deposit_account_id, address, city, state, zip)
      `)
      .eq("id", id)
      .single();

    // Create QBO final invoice at delivery (revenue recognition)
    if (fullContract?.customer?.qbo_customer_id) {
      try {
        const discounts = Array.isArray(fullContract.discounts) ? fullContract.discounts : [];
        const qboContext = fullContract.show ?? fullContract.location;
        const customerName = [fullContract.customer.first_name, fullContract.customer.last_name]
          .filter(Boolean).join(" ") || undefined;

        const invoice = await createQBOFinalInvoice({
          qbo_customer_id: fullContract.customer.qbo_customer_id,
          contract_number: fullContract.contract_number,
          line_items: products.map((item: any) => ({
            qbo_item_id: item.qbo_item_id,
            description: item.product_name ?? "Product",
            qty: item.quantity ?? 1,
            unit_price: item.sell_price ?? 0,
          })),
          discounts: discounts.map((d: any) => ({
            description: d.description ?? d.type ?? "Discount",
            amount: d.amount ?? 0,
          })),
          tax_amount: fullContract.tax_amount ?? 0,
          customer_name: customerName,
          location_name: qboContext?.name ?? undefined,
          department_id: qboContext?.qbo_department_id ?? undefined,
          deposit_account_id: qboContext?.qbo_deposit_account_id ?? undefined,
        });

        const finalInvoiceId = invoice?.Invoice?.Id;
        if (finalInvoiceId) {
          await supabase
            .from("contracts")
            .update({ qbo_final_invoice_id: finalInvoiceId })
            .eq("id", id);

          // Apply accumulated deposits as payment against the final invoice
          if (fullContract.deposit_paid > 0) {
            try {
              await applyDepositsToInvoice({
                qbo_customer_id: fullContract.customer.qbo_customer_id,
                invoice_id: finalInvoiceId,
                deposit_amount: fullContract.deposit_paid,
                deposit_account_id: qboContext?.qbo_deposit_account_id ?? undefined,
              });
            } catch (err) {
              console.error("QBO deposit application failed (non-fatal):", err);
            }
          }
        }
      } catch (err) {
        console.error("QBO final invoice creation failed (non-fatal):", err);
      }
    }

    // Commit tax transaction in Avalara at delivery (best-effort)
    if (process.env.AVALARA_ACCOUNT_ID && fullContract?.tax_amount > 0) {
      try {
        const { calculateTax: avalaraCalculateTax } = await import("@/lib/avalara/client");
        const addr = fullContract.show ?? fullContract.location;
        if (addr?.state) {
          await avalaraCalculateTax({
            customerCode: fullContract.customer_id ?? "GUEST",
            date: new Date().toISOString().slice(0, 10),
            type: "SalesInvoice",
            commit: true,
            purchaseOrderNo: fullContract.contract_number,
            shipTo: {
              line1: addr.address ?? "",
              city: addr.city ?? "",
              region: addr.state ?? "",
              postalCode: addr.zip ?? "",
              country: "US",
            },
            shipFrom: {
              line1: process.env.SHIP_FROM_ADDRESS ?? "123 Main St",
              city: process.env.SHIP_FROM_CITY ?? "Wichita",
              region: process.env.SHIP_FROM_STATE ?? "KS",
              postalCode: process.env.SHIP_FROM_ZIP ?? "67201",
              country: "US",
            },
            lines: products.map((item: any, i: number) => ({
              number: String(i + 1),
              amount: (item.sell_price ?? 0) * (item.quantity ?? 1),
              description: item.product_name ?? "Hot Tub / Spa",
              itemCode: "SPA",
            })),
          });
        }
      } catch (err) {
        console.error("Avalara tax commit at delivery failed (non-fatal):", err);
      }
    }
  }

  // Fire-and-forget audit log
  logAction({
    userId: user.id,
    action: "contract.status_changed",
    entityType: "contract",
    entityId: id,
    metadata: {
      from_status: contract.status,
      to_status: newStatus,
    },
    req,
  });

  return NextResponse.json(updated);
}
