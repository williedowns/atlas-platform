import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  exportShowSalesWorkbook,
  type DealInput,
  type ShowConfigInput,
} from "@/lib/show-sales/xlsx-export";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/shows/[id]/spreadsheet
 *
 * Produces Lori's 9-tab show-sales XLSX for the requested show, populated
 * with contracts assigned to that show_id. Many columns will be empty until
 * the contracts schema is extended (see PRD, Section 5). Excel will
 * auto-recompute all formulas on open.
 *
 * Access: admin role (sales_admin role to be added per PRD).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  // Admin-only for now. Add 'sales_admin' once that role is created.
  if (profile?.role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await params;

  const { data: show, error: showErr } = await supabase
    .from("shows")
    .select("id, name, venue_name, city, state, start_date, end_date")
    .eq("id", id)
    .single();
  if (showErr || !show) {
    return new NextResponse("Show not found", { status: 404 });
  }

  // Pull contracts assigned to this show with linked customer + primary rep
  const { data: contracts } = await supabase
    .from("contracts")
    .select(
      "id, status, line_items, signed_at, created_at, " +
        "subtotal, tax_amount, tax_rate, total, deposit_amount, deposit_paid, " +
        "payment_method, financing, " +
        "customer:customers(first_name, last_name, address, city, state, zip), " +
        "sales_rep:profiles!sales_rep_id(full_name)"
    )
    .eq("show_id", id)
    .order("created_at");

  // Salesman roster — anyone who could sell at a show
  const { data: reps } = await supabase
    .from("profiles")
    .select("full_name")
    .in("role", ["sales_rep", "manager", "admin"])
    .not("full_name", "is", null)
    .order("full_name");

  const dayName = (d: Date) =>
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];

  // Map contract.status → Lori's spreadsheet Status field
  const statusMap: Record<string, string> = {
    draft: "Low Deposit",
    pending_signature: "Low Deposit",
    signed: "OK",
    deposit_collected: "OK",
    in_production: "OK",
    ready_for_delivery: "OK",
    delivered: "OK",
    cancelled: "Cancelled",
  };

  const deals: DealInput[] = (contracts ?? []).map((c) => {
    const baseDate = c.signed_at
      ? new Date(c.signed_at as string)
      : c.created_at
        ? new Date(c.created_at as string)
        : new Date(show.start_date);
    const customer = (c.customer as unknown as {
      first_name?: string;
      last_name?: string;
      address?: string;
      city?: string;
      state?: string;
      zip?: string;
    } | null) ?? null;
    const salesRep = (c.sales_rep as unknown as { full_name?: string } | null) ?? null;
    const lineItems = (c.line_items as Array<{
      product_code?: string;
      name?: string;
    }> | null) ?? [];
    const primary = lineItems[0];
    const financing = (c.financing as { type?: string; financed_amount?: number } | null) ?? null;

    return {
      day_of_week: dayName(baseDate),
      status: statusMap[c.status as string] ?? "OK",
      last_name: customer?.last_name,
      first_name: customer?.first_name,
      address: customer?.address,
      city: customer?.city,
      state: customer?.state,
      zip: customer?.zip,
      salesman_1: salesRep?.full_name,
      model: primary?.product_code ?? primary?.name ?? "",
      sale_price: c.total != null ? Number(c.total) : undefined,
      sales_tax_rate: c.tax_rate != null ? Number(c.tax_rate) : undefined,
      financed_amount:
        financing?.financed_amount != null ? Number(financing.financed_amount) : undefined,
      // Map deposit by payment method to its specific column
      cash_deposit:
        c.payment_method === "cash" && c.deposit_paid
          ? Number(c.deposit_paid)
          : undefined,
      check_deposit:
        c.payment_method === "ach" && c.deposit_paid
          ? Number(c.deposit_paid)
          : undefined,
      debit_deposit:
        c.payment_method === "debit_card" && c.deposit_paid
          ? Number(c.deposit_paid)
          : undefined,
      finance_deposit:
        c.payment_method === "financing" && c.deposit_paid
          ? Number(c.deposit_paid)
          : undefined,
      // Many fields blank until the contracts migration lands (PRD Section 5.1)
    };
  });

  const config: ShowConfigInput = {
    show_name: show.name as string,
    location:
      (show.venue_name as string) ||
      [show.city, show.state].filter(Boolean).join(", "),
    date_range: `${show.start_date} – ${show.end_date}`,
    date_of_last_day: new Date(show.end_date as string),
    salesman_roster: (reps ?? [])
      .map((r) => (r as { full_name: string }).full_name)
      .filter(Boolean),
  };

  const buf = await exportShowSalesWorkbook(config, deals);

  const safeName = (show.name as string).replace(/[^a-z0-9]+/gi, "_");
  const dateStr = (show.start_date as string).replace(/-/g, "");

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${dateStr}_${safeName}_sales.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
