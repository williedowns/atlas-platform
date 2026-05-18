import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  // Service-role client for payments status updates — the payments table has
  // an INSERT policy but no UPDATE policy, so flips like processing→completed
  // and processing→failed are silently denied under user RLS. The server
  // owns those state transitions, not the user, so admin client is correct.
  const adminSupabase = createAdminClient();
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
    // Card-on-file (COF) — opt-in at deposit, then reused for the balance
    save_card_for_balance,   // boolean — customer authorized future reuse
    consent_amount,          // number — balance shown on consent disclosure
    use_saved_card,          // boolean — charge against contract.saved_card_token
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
    // Saved-card (card-on-file) path — bill the card the customer authorized
    // at deposit time. Skips tokenization. Rejects expired or missing cards.
    let savedCardId: string | null = null;
    if (use_saved_card) {
      const sct = (contract as { saved_card_token?: string | null }).saved_card_token;
      const expMonth = (contract as { saved_card_exp_month?: number | null }).saved_card_exp_month;
      const expYear = (contract as { saved_card_exp_year?: number | null }).saved_card_exp_year;
      if (!sct) {
        await adminSupabase.from("payments").update({ status: "failed" }).eq("id", payment!.id);
        return NextResponse.json({ error: "No saved card on file for this contract" }, { status: 400 });
      }
      // Card-expiry check — Intuit will decline anyway, but failing fast here
      // gives a cleaner error and avoids a network round-trip.
      if (expMonth && expYear) {
        const now = new Date();
        const lastValidMonth = new Date(expYear, expMonth, 0); // 0th day of next month = last day of expiry month
        if (lastValidMonth.getTime() < now.getTime()) {
          await adminSupabase.from("payments").update({ status: "failed" }).eq("id", payment!.id);
          return NextResponse.json({ error: "Saved card has expired. Collect a new card." }, { status: 400 });
        }
      }
      savedCardId = sct;
    }

    // Tokenize raw card fields if no pre-existing token provided (and not using saved card)
    let resolvedToken = card_token ?? card_present_token;
    if (!savedCardId && !resolvedToken && card_number) {
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
        await adminSupabase
          .from("payments")
          .update({ status: "failed" })
          .eq("id", payment!.id);
        return NextResponse.json({ error: "Card tokenization failed", details: String(err) }, { status: 402 });
      }
    }

    if (!savedCardId && !resolvedToken) {
      await adminSupabase.from("payments").update({ status: "failed" }).eq("id", payment!.id);
      return NextResponse.json({ error: "No card token available" }, { status: 400 });
    }

    // Charge via Intuit Payments
    let chargeResult;
    try {
      const chargeDescription = [
        savedCardId ? `Balance — ${contract.contract_number}` : `Deposit — ${contract.contract_number}`,
        customerFullName,
        locationName,
        lineItemsSummary,
      ].filter(Boolean).join(" — ").slice(0, 500);

      chargeResult = await createCharge({
        amount: totalCharge,
        ...(savedCardId ? { saved_card_id: savedCardId } : { card_token: resolvedToken }),
        description: chargeDescription,
        customerName: customerFullName,
        capture: true,
        context: { mobile: true, isEcommerce: false },
      });
    } catch (err) {
      await adminSupabase
        .from("payments")
        .update({ status: "failed" })
        .eq("id", payment!.id);
      return NextResponse.json({ error: "Payment failed", details: String(err) }, { status: 402 });
    }

    if (chargeResult.status !== "CAPTURED") {
      await adminSupabase
        .from("payments")
        .update({ status: "failed" })
        .eq("id", payment!.id);
      return NextResponse.json({ error: "Card declined" }, { status: 402 });
    }

    // Update payment to completed.
    // Intuit returns the brand at `card.cardType` and the masked PAN at
    // `card.number` ("xxxxxxxxxxxx8553"). There is no `card.brand` or
    // `card.last4` field — earlier versions of this code read those and
    // got undefined, which is why historical rows have NULL card details.
    const cardBrand = chargeResult.card?.cardType ?? null;
    const maskedNumber = chargeResult.card?.number ?? null;
    const cardLast4 = maskedNumber ? maskedNumber.slice(-4) : null;
    if (!cardBrand || !cardLast4) {
      // Guard against future shape changes — log card-object keys (NOT
      // values) so we can diagnose without leaking sensitive fields.
      console.warn("[charge] missing card brand/last4 on captured charge", {
        payment_id: payment!.id,
        intuit_charge_id: chargeResult.id,
        card_keys: chargeResult.card ? Object.keys(chargeResult.card) : null,
        has_card_object: !!chargeResult.card,
      });
    }
    await adminSupabase
      .from("payments")
      .update({
        status: "completed",
        intuit_charge_id: chargeResult.id,
        processed_at: new Date().toISOString(),
        card_brand: cardBrand,
        card_last4: cardLast4,
      })
      .eq("id", payment!.id);

    // Update contract — accumulate deposit_paid
    // NOTE: GreenSky/Wells Fargo/etc financing draws are NOT credit-card swipes
    // through Intuit — they're ACH draws executed in each lender's portal.
    // The financing entry's funded_amount is updated separately via the
    // "Log draw" UI on FinancingDetailsCard (PATCH /api/contracts/[id]/financing/[idx]).
    const newDepositPaid = (contract.deposit_paid ?? 0) + Number(amount);

    // Card-on-file persistence. Two cases write to saved_card_*:
    //   1. Deposit charge with save_card_for_balance=true and customer consent
    //      — store the reusable card.id + consent audit trail.
    //   2. Saved-card balance charge — refresh brand/last4/expiry from the
    //      latest response so the UI stays current and the next charge sees
    //      up-to-date expiry data.
    const cofUpdate: Record<string, unknown> = {};
    if (save_card_for_balance && !savedCardId && chargeResult.card?.id) {
      cofUpdate.saved_card_token = chargeResult.card.id;
      cofUpdate.saved_card_brand = cardBrand;
      cofUpdate.saved_card_last4 = cardLast4;
      cofUpdate.saved_card_exp_month = chargeResult.card.expMonth ? Number(chargeResult.card.expMonth) : null;
      cofUpdate.saved_card_exp_year = chargeResult.card.expYear ? Number(chargeResult.card.expYear) : null;
      cofUpdate.saved_card_consent_at = new Date().toISOString();
      cofUpdate.saved_card_consent_ip = ip;
      cofUpdate.saved_card_consent_amount = typeof consent_amount === "number" ? consent_amount : null;
    } else if (savedCardId && chargeResult.card?.id) {
      // Refresh denormalized fields after a successful saved-card charge.
      cofUpdate.saved_card_brand = cardBrand ?? (contract as { saved_card_brand?: string }).saved_card_brand;
      cofUpdate.saved_card_last4 = cardLast4 ?? (contract as { saved_card_last4?: string }).saved_card_last4;
      if (chargeResult.card.expMonth) cofUpdate.saved_card_exp_month = Number(chargeResult.card.expMonth);
      if (chargeResult.card.expYear) cofUpdate.saved_card_exp_year = Number(chargeResult.card.expYear);
    }

    await supabase
      .from("contracts")
      .update({
        // Saved-card charges are for the BALANCE, not deposit — so don't flip
        // status to deposit_collected. The status should already be past that.
        ...(savedCardId ? {} : { status: "deposit_collected" }),
        deposit_paid: newDepositPaid,
        balance_due: Math.max(0, contract.total - financedAtSale - newDepositPaid),
        intuit_payment_id: chargeResult.id,
        ...cofUpdate,
      })
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
      action: savedCardId ? "payment.charged_with_saved_card" : "payment.collected",
      entityType: "payment",
      entityId: payment!.id,
      metadata: {
        contract_id,
        amount,
        method,
        charge_id: chargeResult.id,
        ...(savedCardId ? { saved_card_id: savedCardId } : {}),
      },
      req,
    });

    // Separate audit event when the customer authorized COF reuse on this
    // deposit — gives chargeback-dispute investigators a clean "consent
    // captured at <ts> from <ip>" entry to point at.
    if (save_card_for_balance && !savedCardId && chargeResult.card?.id) {
      logAction({
        userId: user.id,
        action: "payment.card_saved",
        entityType: "contract",
        entityId: contract_id,
        metadata: {
          payment_id: payment!.id,
          charge_id: chargeResult.id,
          card_brand: cardBrand,
          card_last4: cardLast4,
          consent_amount: consent_amount ?? null,
          consent_ip: ip,
        },
        req,
      });
    }

    return NextResponse.json({
      success: true,
      payment_id: payment!.id,
      charge_id: chargeResult.id,
      last4: cardLast4,
      brand: cardBrand,
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
