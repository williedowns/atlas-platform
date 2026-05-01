import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";

// Step 8 auto-recovery: when the iPad lost the contract ID after Step 7
// (network blip, state loss, iPad sleep) but the contract was actually saved,
// this endpoint finds it by (sales_rep_id + customer_email + total) within
// the last 2 hours so the rep can collect the deposit instead of restarting.
//
// Match constraints are intentionally tight to avoid wrong-contract recovery:
//   - sales_rep_id: same rep
//   - customer email: case-insensitive exact match
//   - total: exact dollar match
//   - created_at: within last `within_minutes` (default 120)
//
// Returns { contract_id: null } when no match — never throws on miss.

const DEFAULT_WINDOW_MINUTES = 120;

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const customerEmail = url.searchParams.get("customer_email")?.trim().toLowerCase();
  const totalRaw = url.searchParams.get("total");
  const withinMinutesRaw = url.searchParams.get("within_minutes");

  if (!customerEmail || !totalRaw) {
    return NextResponse.json(
      { error: "customer_email and total are required" },
      { status: 400 }
    );
  }

  const total = Number(totalRaw);
  if (!Number.isFinite(total)) {
    return NextResponse.json({ error: "total must be a number" }, { status: 400 });
  }

  const withinMinutes = withinMinutesRaw ? Number(withinMinutesRaw) : DEFAULT_WINDOW_MINUTES;
  const cutoffIso = new Date(Date.now() - withinMinutes * 60_000).toISOString();

  // Two-step lookup so we can use a server-side ilike on the joined customer
  // email. Filter by rep + recent first (uses contracts_rep_recent_idx), then
  // narrow client-side by email + total.
  const { data: candidates, error } = await supabase
    .from("contracts")
    .select("id, contract_number, total, created_at, customer:customers(email)")
    .eq("sales_rep_id", user.id)
    .gte("created_at", cutoffIso)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const match = (candidates ?? []).find((c) => {
    const customerRel = c.customer as { email?: string | null } | { email?: string | null }[] | null;
    const email = Array.isArray(customerRel)
      ? customerRel[0]?.email
      : customerRel?.email;
    const emailMatches = !!email && email.trim().toLowerCase() === customerEmail;
    const totalMatches = Number(c.total) === total;
    return emailMatches && totalMatches;
  });

  if (!match) {
    return NextResponse.json({ contract_id: null });
  }

  logAction({
    userId: user.id,
    action: "contract.recovered_by_lookup",
    entityType: "contract",
    entityId: match.id,
    metadata: {
      contract_number: match.contract_number,
      lookup_window_minutes: withinMinutes,
      matched_total: total,
    },
    req,
  });

  return NextResponse.json({
    contract_id: match.id,
    contract_number: match.contract_number,
  });
}
