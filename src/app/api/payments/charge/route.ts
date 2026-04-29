import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCharge, createToken } from "@/lib/payments/intuit";
import { createQBODeposit } from "@/lib/qbo/client";
import { calculateTax } from "@/lib/avalara/client";
import { logAction } from "@/lib/audit";

// ── Simple in-process rate limiter ────────────────────────────────────────────
// NOTE: This is process-level only — on serverless (Vercel) each cold-start
// gets a fresh Map. It still stops accidental double-taps and rapid retry loops
// within the same warm process (the common case for a POS app).
const RATE_WINDOW_MS = 60_000; // 1 minute
const RATE_MAX = 15;            // 15 charges per IP per minute
const rateLimitMap = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (timestamps.length >= RATE_MAX) return true;
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return false;
}

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many payment attempts. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    contract_id,
    amount,
    surcharge_amount,
    method,
    // Pre-tokenized (legacy) path
    card_token,
    card_present_token,
    // Raw card fields for server-side tokenization — NEVER logged or persisted
    card_number,
    card_exp_month,
    card_exp_year,
    card_cvc,
    card_postal_code,
  } = await req.json();

  // Fetch contract
  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .select(`*, customer:customers(*), location:locations(qbo_deposit_account_id, qbo_department_id, qbo_deposit_income_item_id, qbo_deposit_liability_item_id, name, address, city, state, zip), show:shows(qbo_deposit_account_id, qbo_department_id, qbo_deposit_income_item_id, qbo_deposit_liability_item_id, name, address, city, state, zip)`)
    .eq("id", contract_id)
    .single();

  if (contractError || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const totalCharge = Number(amount) + Number(surcharge_amount ?? 0);
  // Only GreenSky/WF (deduct_from_balance !== false) offset the balance; Foundation carries
  const financedAtSale = Array.isArray(contract.financing)
    ? (contract.financing as { financed_amount?: number; deduct_from_balance?: boolean }[])
        .filter((f) => f.deduct_from_balance !== false)
        .reduce((sum, f) => sum + (f.financed_amount ?? 0), 0)
    : 0;

  // Create payment record (pending)
  const { data: payment } = await supabase
    .from("payments")
    .insert({
      contract_id,
      amount,
      surcharge_amount: surcharge_amount ?? 0,
      method,
      status: "processing",
    })
    .select()
    .single();

  // Build customer name for Intuit merchant portal
  const customerFullName = [contract.customer?.first_name, contract.customer?.last_name]
    .filter(Boolean).join(" ") || undefined;

  // QBO context: prefer show over location (show-based sales track to the expo)
  const show = (contract as any).show as { qbo_deposit_account_id?: string; qbo_department_id?: string; qbo_deposit_income_item_id?: string; qbo_deposit_liability_item_id?: string; name?: string } | null;
  const location = (contract as any).location as { qbo_deposit_account_id?: string; qbo_department_id?: string; qbo_deposit_income_item_id?: string; qbo_deposit_liability_item_id?: string; name?: string } | null;
  const qboContext = show ?? location;
  const locationName = show?.name ?? location?.name ?? undefined;

  // Build line items summary for QBO memo (e.g. "Hot Tub X (1), Steps (1)")
  const lineItems = (contract as any).line_items as { product_name?: string; quantity?: number }[] | null;
  const lineItemsSummary = lineItems?.length
    ? lineItems.map((i) => `${i.product_name ?? "Item"}${i.quantity && i.quantity > 1 ? ` (${i.quantity})` : ""}`).join(", ")
    : undefined;

  if (method === "credit_card" || method === "debit_card" || method === "financing") {
    // Tokenize raw card fields if no pre-existing token provided
    let resolvedToken = card_token ?? card_present_token;
    if (!resolvedToken && card_number) {
      try {
        resolvedToken = await createToken({
          number: String(card_number).replace(/[\s\-]/g, ""),
          expMonth: Number(card_exp_month),
          expYear: Number(card_exp_year),
          cvc: String(card_cvc),
          name: customerFullName,
          postalCode: card_postal_code ? String(card_postal_code) : undefined,
        });
      } catch (err) {
        await supabase
          .from("payments")
          .update({ status: "failed", error: String(err) } as Record<string, unknown>)
          .eq("id", payment!.id);
        return NextResponse.json({ error: "Card tokenization failed", details: String(err) }, { status: 402 });
      }
    }

    if (!resolvedToken) {
      await supabase.from("payments").update({ status: "failed" }).eq("id", payment!.id);
      return NextResponse.json({ error: "No card token available" }, { status: 400 });
    }

    // Charge via Intuit Payments
    let chargeResult;
    try {
      const chargeDescription = [
        `Deposit — ${contract.contract_number}`,
        customerFullName,
        locationName,
        lineItemsSummary,
      ].filter(Boolean).join(" — ").slice(0, 500);

      chargeResult = await createCharge({
        amount: totalCharge,
        card_token: resolvedToken,
        description: chargeDescription,
        customerName: customerFullName,
        capture: true,
        context: { mobile: true, isEcommerce: false },
      });
    } catch (err) {
      await supabase
        .from("payments")
        .update({ status: "failed", error: String(err) } as Record<string, unknown>)
        .eq("id", payment!.id);
      return NextResponse.json({ error: "Payment failed", details: String(err) }, { status: 402 });
    }

    if (chargeResult.status !== "CAPTURED") {
      await supabase
        .from("payments")
        .update({ status: "failed" })
        .eq("id", payment!.id);
      return NextResponse.json({ error: "Card declined" }, { status: 402 });
    }

    // Update payment to completed
    await supabase
      .from("payments")
      .update({
        status: "completed",
        intuit_charge_id: chargeResult.id,
        processed_at: new Date().toISOString(),
        card_brand: chargeResult.card?.brand ?? null,
        card_last4: chargeResult.card?.last4 ?? null,
      })
      .eq("id", payment!.id);

    // Update contract — accumulate deposit_paid
    const newDepositPaid = (contract.deposit_paid ?? 0) + Number(amount);
    const contractUpdate: Record<string, unknown> = {
      status: "deposit_collected",
      deposit_paid: newDepositPaid,
      balance_due: Math.max(0, contract.total - financedAtSale - newDepositPaid),
      intuit_payment_id: chargeResult.id,
    };

    // ── GreenSky / WF auto-mark funded ───────────────────────────────────────
    // When method === "financing" the salesperson is running the GreenSky-issued
    // (or WF-issued) virtual credit card on our terminal — Atlas is funded the
    // moment the card captures. Find the matching financing entry by amount and
    // mark it fully_funded so Robert doesn't have to click anything.
    if (method === "financing" && Array.isArray(contract.financing)) {
      const arr = [...(contract.financing as Array<Record<string, unknown>>)];
      const matchIdx = arr.findIndex((entry) => {
        if (entry.deduct_from_balance === false) return false; // skip Foundation
        const already = (entry.funding_status as string | undefined) ?? null;
        if (already === "fully_funded") return false; // skip already-funded
        const expected = Number(entry.financed_amount ?? 0);
        return Math.abs(expected - Number(amount)) < 0.01;
      });
      if (matchIdx >= 0) {
        arr[matchIdx] = {
          ...arr[matchIdx],
          funded_amount: Number(arr[matchIdx].financed_amount ?? amount),
          funded_at: new Date().toISOString(),
          funding_status: "fully_funded",
          intuit_charge_id: chargeResult.id,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        };
        contractUpdate.financing = arr;
      }
    }

    await supabase
      .from("contracts")
      .update(contractUpdate)
      .eq("id", contract_id);

    // Record tax transaction in Avalara for state filing & remittance (best-effort)
    if (process.env.AVALARA_ACCOUNT_ID && contract.tax_amount > 0) {
      try {
        const addr = show
          ? { line1: (contract as any).show?.address ?? "", city: (contract as any).show?.city ?? "", region: (contract as any).show?.state ?? "", postalCode: (contract as any).show?.zip ?? "", country: "US" }
          : { line1: (contract as any).location?.address ?? "", city: (contract as any).location?.city ?? "", region: (contract as any).location?.state ?? "", postalCode: (contract as any).location?.zip ?? "", country: "US" };
        if (addr.region) {
          await calculateTax({
            customerCode: contract.customer_id ?? "GUEST",
            date: new Date().toISOString().slice(0, 10),
            type: "SalesInvoice",
            commit: true,
            purchaseOrderNo: contract.contract_number,
            shipTo: addr,
            shipFrom: {
              line1: process.env.SHIP_FROM_ADDRESS ?? "123 Main St",
              city: process.env.SHIP_FROM_CITY ?? "Wichita",
              region: process.env.SHIP_FROM_STATE ?? "KS",
              postalCode: process.env.SHIP_FROM_ZIP ?? "67201",
              country: "US",
            },
            lines: [{ number: "1", amount: Number(amount), description: "Hot Tub / Spa", itemCode: "SPA" }],
          });
        }
      } catch (err) {
        console.error("Avalara transaction record failed (non-fatal):", err);
      }
    }

    // Create deposit invoice in QBO (best-effort)
    if (contract.customer?.qbo_customer_id) {
      try {
        const invoice = await createQBODeposit({
          qbo_customer_id: contract.customer.qbo_customer_id,
          deposit_amount: amount,
          contract_number: contract.contract_number,
          customer_name: customerFullName,
          location_name: locationName,
          line_items_summary: lineItemsSummary,
          deposit_account_id: qboContext?.qbo_deposit_account_id ?? undefined,
          department_id: qboContext?.qbo_department_id ?? undefined,
          qbo_deposit_income_item_id: qboContext?.qbo_deposit_income_item_id ?? undefined,
          qbo_deposit_liability_item_id: qboContext?.qbo_deposit_liability_item_id ?? undefined,
        });
        await supabase
          .from("contracts")
          .update({ qbo_deposit_invoice_id: invoice.Invoice?.Id })
          .eq("id", contract_id);
      } catch (err) {
        console.error("QBO deposit invoice failed (non-fatal):", err);
      }
    }

    // Fire-and-forget audit log
    logAction({
      userId: user.id,
      action: "payment.collected",
      entityType: "payment",
      entityId: payment!.id,
      metadata: {
        contract_id,
        amount,
        method,
        charge_id: chargeResult.id,
      },
      req,
    });

    return NextResponse.json({
      success: true,
      payment_id: payment!.id,
      charge_id: chargeResult.id,
      last4: chargeResult.card?.last4,
      brand: chargeResult.card?.brand,
      amount_charged: totalCharge,
    });
  }

  // ACH / Cash — record manually, no card processing
  await supabase
    .from("payments")
    .update({ status: "completed", processed_at: new Date().toISOString() })
    .eq("id", payment!.id);

  const newDepositPaidManual = (contract.deposit_paid ?? 0) + Number(amount);
  await supabase
    .from("contracts")
    .update({
      status: "deposit_collected",
      deposit_paid: newDepositPaidManual,
      balance_due: Math.max(0, contract.total - newDepositPaidManual),
    })
    .eq("id", contract_id);

  // Fire-and-forget audit log
  logAction({
    userId: user.id,
    action: "payment.collected",
    entityType: "payment",
    entityId: payment!.id,
    metadata: {
      contract_id,
      amount,
      method,
    },
    req,
  });

  return NextResponse.json({ success: true, payment_id: payment!.id, amount_charged: amount });
}
