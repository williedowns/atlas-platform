import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";
import {
  CHECK_DEFINITIONS,
  computeAutoCheck,
  hasCardPayments,
  isCashDeal,
  isReadyForBookkeeper,
  normalizeFinancing,
  type CheckStatus,
  type ContractSlim,
  type PaymentSlim,
} from "@/lib/verification/checks";

export const dynamic = "force-dynamic";

// Roles that may read or write verification checks. Sales reps are excluded
// — this is a bookkeeper/manager-facing reconciliation surface.
const ALLOWED_ROLES = new Set(["admin", "manager", "bookkeeper"]);

interface SavedCheckRow {
  id: string;
  contract_id: string;
  check_key: string;
  status: CheckStatus;
  notes: string | null;
  verified_by: string | null;
  verified_at: string | null;
}

/**
 * GET /api/shows/[id]/verification
 *
 * Returns the per-contract verification checklist for every non-quote
 * contract on the show. Auto-derived checks are computed inline; manual
 * checks are pulled from `contract_verification_checks`. The response
 * also includes a `summary` block used by the show page badge.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: showId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!ALLOWED_ROLES.has(profile?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 1. Pull every non-quote contract on the show.
  const { data: rawContracts } = await supabase
    .from("contracts")
    .select(
      "id, contract_number, status, deposit_amount, deposit_paid, signed_at, contract_pdf_url, financing, total, created_at, customer:customers(first_name, last_name)",
    )
    .eq("show_id", showId)
    .neq("status", "quote")
    .neq("status", "draft")
    .order("created_at", { ascending: false });

  const contracts = rawContracts ?? [];
  const contractIds = contracts.map((c) => c.id);

  // 2. Pull payments + saved verification rows in one batch.
  const [paymentsResp, savedResp] = await Promise.all([
    contractIds.length === 0
      ? Promise.resolve({ data: [] })
      : supabase
          .from("payments")
          .select("id, contract_id, status, amount, method, intuit_charge_id")
          .in("contract_id", contractIds),
    contractIds.length === 0
      ? Promise.resolve({ data: [] })
      : supabase
          .from("contract_verification_checks")
          .select("id, contract_id, check_key, status, notes, verified_by, verified_at")
          .in("contract_id", contractIds),
  ]);

  const allPayments = (paymentsResp.data ?? []) as PaymentSlim[];
  const savedChecks = (savedResp.data ?? []) as SavedCheckRow[];

  const paymentsByContract = new Map<string, PaymentSlim[]>();
  for (const p of allPayments) {
    const list = paymentsByContract.get(p.contract_id) ?? [];
    list.push(p);
    paymentsByContract.set(p.contract_id, list);
  }

  const savedByKey = new Map<string, SavedCheckRow>();
  for (const row of savedChecks) {
    savedByKey.set(`${row.contract_id}::${row.check_key}`, row);
  }

  // 3. Build per-contract response.
  const responseContracts = contracts.map((c) => {
    const contractSlim: ContractSlim = {
      id: c.id,
      deposit_amount: c.deposit_amount,
      deposit_paid: c.deposit_paid,
      signed_at: c.signed_at,
      contract_pdf_url: c.contract_pdf_url,
      financing: c.financing,
    };
    const payments = paymentsByContract.get(c.id) ?? [];
    const cashDeal = isCashDeal(contractSlim);
    const hasCards = hasCardPayments(payments);

    const checks = CHECK_DEFINITIONS.map((def) => {
      const saved = savedByKey.get(`${c.id}::${def.key}`);

      if (def.kind === "auto") {
        const computed = computeAutoCheck(def.key, contractSlim, payments);
        // If the manager overrode an auto check (status discrepancy or na),
        // surface their override but include the computed value for context.
        if (saved && (saved.status === "discrepancy" || saved.status === "na")) {
          return {
            key: def.key,
            label: def.label,
            kind: def.kind,
            description: def.description,
            status: saved.status,
            notes: saved.notes,
            verified_by: saved.verified_by,
            verified_at: saved.verified_at,
            auto_computed_status: computed.status,
            auto_reason: computed.reason,
          };
        }
        return {
          key: def.key,
          label: def.label,
          kind: def.kind,
          description: def.description,
          status: computed.status,
          notes: saved?.notes ?? null,
          verified_by: saved?.verified_by ?? null,
          verified_at: saved?.verified_at ?? null,
          auto_computed_status: computed.status,
          auto_reason: computed.reason,
        };
      }

      // Manual check — N/A defaults for irrelevant lender / card checks.
      let defaultStatus: CheckStatus = "pending";
      if (
        (def.key === "financing_portal_approved" || def.key === "financing_amount_matches") &&
        cashDeal
      ) {
        defaultStatus = "na";
      }
      if (def.key === "intuit_charge_settled" && !hasCards) {
        defaultStatus = "na";
      }

      if (saved) {
        return {
          key: def.key,
          label: def.label,
          kind: def.kind,
          description: def.description,
          status: saved.status === "pending" ? defaultStatus : saved.status,
          notes: saved.notes,
          verified_by: saved.verified_by,
          verified_at: saved.verified_at,
          auto_computed_status: null,
          auto_reason: null,
        };
      }
      return {
        key: def.key,
        label: def.label,
        kind: def.kind,
        description: def.description,
        status: defaultStatus,
        notes: null,
        verified_by: null,
        verified_at: null,
        auto_computed_status: null,
        auto_reason: null,
      };
    });

    const customer = Array.isArray(c.customer) ? c.customer[0] : c.customer;

    // Surface financing entries (with original JSONB index!) so the dashboard
    // can render inline approval-number entry against the right index when
    // calling PATCH /api/contracts/[id]/financing/[idx].
    const rawFinancing = Array.isArray(c.financing) ? c.financing : [];
    const financingEntries = normalizeFinancing(c.financing).map((entry, normalizedIdx) => {
      // Map back to the original array index when raw was an array; for
      // legacy single-object form the idx is 0.
      const idx = Array.isArray(rawFinancing) && rawFinancing.length > 0 ? normalizedIdx : 0;
      return {
        idx,
        type: entry.type ?? null,
        financed_amount: Number(entry.financed_amount ?? 0),
        approval_number: entry.approval_number?.trim() ? entry.approval_number : null,
        missing_approval:
          Number(entry.financed_amount ?? 0) > 0 &&
          (!entry.approval_number || !entry.approval_number.trim()),
      };
    });

    return {
      id: c.id,
      contract_number: c.contract_number,
      customer_name:
        customer ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() : "",
      total: Number(c.total ?? 0),
      created_at: c.created_at,
      day_key: c.created_at ? c.created_at.split("T")[0] : null,
      is_cash_deal: cashDeal,
      has_card_payments: hasCards,
      financing_entries: financingEntries,
      payments: payments.map((p) => ({
        id: p.id,
        method: p.method,
        status: p.status,
        amount: Number(p.amount ?? 0),
        intuit_charge_id: p.intuit_charge_id,
      })),
      checks,
    };
  });

  const summary = isReadyForBookkeeper(
    responseContracts.map((c) => ({
      contract_id: c.id,
      all_checks: c.checks.map((ch) => ({ key: ch.key, status: ch.status })),
    })),
  );

  return NextResponse.json({
    ok: true,
    show_id: showId,
    contracts: responseContracts,
    summary,
  });
}

/**
 * POST /api/shows/[id]/verification
 *
 * Body: { contract_id, check_key, status: 'pending'|'verified'|'discrepancy'|'na', notes?: string }
 *
 * Upserts the verification row and writes an audit log entry. Caller must be
 * admin/manager/bookkeeper and the contract must belong to this show.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: showId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!ALLOWED_ROLES.has(profile?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { contract_id?: string; check_key?: string; status?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { contract_id, check_key, status, notes } = body;
  if (!contract_id || !check_key || !status) {
    return NextResponse.json(
      { error: "Missing contract_id, check_key, or status" },
      { status: 400 },
    );
  }
  if (!["pending", "verified", "discrepancy", "na"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (!CHECK_DEFINITIONS.some((d) => d.key === check_key)) {
    return NextResponse.json({ error: "Unknown check_key" }, { status: 400 });
  }

  // Verify contract belongs to this show.
  const { data: contract, error: cErr } = await supabase
    .from("contracts")
    .select("id, show_id, contract_number")
    .eq("id", contract_id)
    .single();
  if (cErr || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }
  if (contract.show_id !== showId) {
    return NextResponse.json({ error: "Contract not on this show" }, { status: 400 });
  }

  // Read prior row for audit metadata.
  const { data: prior } = await supabase
    .from("contract_verification_checks")
    .select("id, status, notes")
    .eq("contract_id", contract_id)
    .eq("check_key", check_key)
    .maybeSingle();

  const verified_by = status === "verified" || status === "discrepancy" ? user.id : null;
  const verified_at = verified_by ? new Date().toISOString() : null;
  const cleanedNotes = typeof notes === "string" ? notes.trim() : null;

  const { data: row, error: upErr } = await supabase
    .from("contract_verification_checks")
    .upsert(
      {
        contract_id,
        check_key,
        status,
        notes: cleanedNotes,
        verified_by,
        verified_at,
      },
      { onConflict: "contract_id,check_key" },
    )
    .select("id, contract_id, check_key, status, notes, verified_by, verified_at")
    .single();

  if (upErr || !row) {
    return NextResponse.json({ error: upErr?.message ?? "Upsert failed" }, { status: 500 });
  }

  // Audit log — fire-and-forget; never blocks success path.
  await logAction({
    userId: user.id,
    action: "verification.check_updated",
    entityType: "contract",
    entityId: contract_id,
    metadata: {
      check_key,
      prior_status: prior?.status ?? null,
      new_status: status,
      contract_number: contract.contract_number,
      show_id: showId,
      notes_changed: (prior?.notes ?? null) !== cleanedNotes,
    },
    req,
  });

  return NextResponse.json({ ok: true, row });
}
