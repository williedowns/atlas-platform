import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Period = "today" | "week" | "month" | "year" | "all";

function getPeriodRange(period: Period): { gte?: string; lte?: string } {
  const now = new Date();
  if (period === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { gte: start.toISOString(), lte: new Date(start.getTime() + 86400000).toISOString() };
  }
  if (period === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return { gte: start.toISOString(), lte: new Date(start.getTime() + 7 * 86400000).toISOString() };
  }
  if (period === "month") {
    return {
      gte: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      lte: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
    };
  }
  if (period === "year") {
    return {
      gte: new Date(now.getFullYear(), 0, 1).toISOString(),
      lte: new Date(now.getFullYear() + 1, 0, 1).toISOString(),
    };
  }
  return {};
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const period = (["today", "week", "month", "year", "all"].includes(searchParams.get("period") ?? "")
    ? searchParams.get("period")
    : "month") as Period;

  const range = getPeriodRange(period);

  let query = supabase
    .from("contracts")
    .select(`
      contract_number, total, status, created_at,
      customer:customers(first_name, last_name),
      sales_rep:profiles(full_name),
      show:shows(name),
      location:locations(name)
    `)
    .not("status", "in", '("cancelled","quote","draft")')
    .order("created_at", { ascending: false });

  if (range.gte) query = query.gte("created_at", range.gte);
  if (range.lte) query = query.lt("created_at", range.lte);

  const { data: rows } = await query;

  const headers = ["Contract #", "Date", "Customer", "Sales Rep", "Show/Location", "Amount", "Status"];
  const lines = [
    headers.join(","),
    ...(rows ?? []).map((c) => {
      const customer = (c.customer as any);
      const customerName = customer ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() : "";
      const repName = (c.sales_rep as any)?.full_name ?? "";
      const venue = (c.show as any)?.name ?? (c.location as any)?.name ?? "";
      const date = new Date(c.created_at).toLocaleDateString("en-US");
      const amount = Number(c.total ?? 0).toFixed(2);
      return [
        c.contract_number ?? "",
        date,
        `"${customerName.replace(/"/g, '""')}"`,
        `"${repName.replace(/"/g, '""')}"`,
        `"${venue.replace(/"/g, '""')}"`,
        amount,
        c.status ?? "",
      ].join(",");
    }),
  ];

  const now = new Date();
  const filename = `analytics-${period}-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}.csv`;

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
