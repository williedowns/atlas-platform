/**
 * Server-side loader that joins contracts + show_deal_overrides into the
 * WorkbookDeal[] shape consumed by the workbook page and GET API.
 *
 * RLS gates row visibility; this loader only handles shaping.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { EMPTY_OVERRIDE, type WorkbookDeal, type WorkbookDealOverride } from "./workbook-deal";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export async function loadWorkbookDeals(
  supabase: SupabaseClient,
  showId: string,
): Promise<WorkbookDeal[]> {
  const { data: contracts } = await supabase
    .from("contracts")
    .select(`
      id, contract_number, status, created_at, subtotal, tax_rate, line_items, financing, deposit_paid,
      customer:customers(first_name, last_name, address, city, state, zip),
      sales_rep:profiles!sales_rep_id(full_name),
      override:show_deal_overrides(*)
    `)
    .eq("show_id", showId)
    .order("created_at", { ascending: true });

  return (contracts ?? []).map((c) => shapeDeal(c as Record<string, unknown>));
}

function shapeDeal(raw: Record<string, unknown>): WorkbookDeal {
  const customer = (raw.customer as Record<string, string | null> | null) ?? {};
  const salesRep = raw.sales_rep as { full_name?: string | null } | null;
  const lineItems = (raw.line_items as Array<Record<string, string | null>> | null) ?? [];
  const li = lineItems[0] ?? {};

  const financing = raw.financing;
  const financingArr = Array.isArray(financing)
    ? (financing as Array<{ financed_amount?: number }>)
    : financing && typeof financing === "object" && (financing as { type?: string }).type !== "none"
      ? [financing as { financed_amount?: number }]
      : [];
  const financedTotal = financingArr.reduce((s, f) => s + (f.financed_amount ?? 0), 0);

  // contracts.deposit_paid is the canonical running total — kept in sync by
  // every payment flow (charge, record-manual, echeck) and populated directly
  // by historical-data backfills. Source of truth across the rest of the app.
  const depositsTotal = (raw.deposit_paid as number | null) ?? 0;

  const createdAt = raw.created_at as string;
  const dow = WEEKDAY[new Date(createdAt).getUTCDay()] ?? "";

  const overrideRaw = raw.override;
  const overrideRow = Array.isArray(overrideRaw)
    ? (overrideRaw[0] as Record<string, unknown> | undefined)
    : (overrideRaw as Record<string, unknown> | undefined);
  const override: WorkbookDealOverride = { ...EMPTY_OVERRIDE };
  if (overrideRow) {
    for (const k of Object.keys(EMPTY_OVERRIDE) as Array<keyof WorkbookDealOverride>) {
      const v = overrideRow[k];
      if (v !== undefined) (override as Record<string, unknown>)[k] = v;
    }
  }

  return {
    auto: {
      contract_id: raw.id as string,
      contract_number: raw.contract_number as string,
      created_at: createdAt,
      contract_status: raw.status as string,
      customer_first_name: customer.first_name ?? null,
      customer_last_name: customer.last_name ?? null,
      customer_address: customer.address ?? null,
      customer_city: customer.city ?? null,
      customer_state: customer.state ?? null,
      customer_zip: customer.zip ?? null,
      sales_rep_name: salesRep?.full_name ?? null,
      model: li.model_code ?? li.product_name ?? "",
      default_day_of_week: dow,
      sale_price: (raw.subtotal as number) ?? 0,
      sales_tax_rate: (raw.tax_rate as number) ?? 0,
      deposits_total: depositsTotal,
      financed_amount: financedTotal,
    },
    override,
  };
}
