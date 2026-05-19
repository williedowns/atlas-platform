/**
 * Map contract rows (joined with customer / sales_rep / payments) into the
 * INPUT-only DealInput shape that the show-sales XLSX template expects.
 *
 * The template's formulas compute every derived field (Step Cost, Spa Cost,
 * Sales Tax, Commission, Total Deposit, etc.) — so this mapper only writes
 * fields a salesperson would have typed into Lori's source workbook.
 *
 * Pure, side-effect free, no Supabase imports — testable in isolation.
 */

import type { DealInput, ShowConfigInput } from "./xlsx-export";

const WEEKDAY_ABBREV = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type MapperLineItem = {
  product_name?: string | null;
  model_code?: string | null;
  shell_color?: string | null;
  cabinet_color?: string | null;
  serial_number?: string | null;
};

export type MapperFinancing = {
  financed_amount?: number;
  plan_number?: string;
  financer_name?: string;
  type?: string;
};

export type MapperPayment = {
  method: string;
  card_brand?: string | null;
  amount: number;
  status: string;
};

export type MapperContract = {
  id: string;
  status: string;
  created_at: string;
  is_contingent?: boolean | null;
  notes?: string | null;
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  } | null;
  sales_rep?: { full_name?: string | null } | null;
  line_items?: MapperLineItem[] | null;
  financing?: MapperFinancing | MapperFinancing[] | { type?: string } | null;
  subtotal?: number | null;
  tax_rate?: number | null;
  payments?: MapperPayment[] | null;
  /**
   * Workbook-side annotations from public.show_deal_overrides.
   * When present, values here win over contract-derived defaults for the
   * same field (status, day_of_week, model add-ons, comments, etc.).
   */
  override?: DealOverride | null;
};

export type DealOverride = {
  status_override?: string | null;
  day_of_week?: string | null;
  salesman_2?: string | null;
  salesman_3?: string | null;
  salesman_4?: string | null;
  color?: string | null;
  color_cost?: number | null;
  cabinet?: string | null;
  cabinet_cost?: number | null;
  serial_number?: string | null;
  masterpur?: string | null;
  masterpur_cost?: number | null;
  floor_system?: string | null;
  floor_system_cost?: number | null;
  other_options_1?: string | null;
  other_options_1_cost?: number | null;
  other_options_2?: string | null;
  other_options_2_cost?: number | null;
  other_spa_costs?: number | null;
  step?: string | null;
  freight_cost?: number | null;
  delivery_cost?: number | null;
  crane_cost?: number | null;
  removal_cost?: number | null;
  cover_lift_type?: string | null;
  cover_lift_count?: number | null;
  override_reason?: string | null;
  commission_rate?: number | null;
  spiff_reason?: string | null;
  spiff_amount?: number | null;
  spiff_payable?: string | null;
  plan_number?: string | null;
  financing_cost?: number | null;
  approx_delivery_date?: string | null;
  marketing_feedback?: string | null;
  comments?: string | null;
};

export type ShowMeta = {
  name: string;
  venue_name: string;
  city: string;
  state: string;
  start_date: string;
  end_date: string;
};

/** Derive 3-letter weekday for a contract's deal date. */
function dayOfWeek(createdAt: string): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "";
  return WEEKDAY_ABBREV[d.getUTCDay()];
}

/** Map contract.status → template status column. */
function statusLabel(contract: MapperContract): string {
  if (contract.status === "cancelled") return "Cancelled";
  if (contract.is_contingent) return "Contingent";
  return "OK";
}

/** Normalize financing into an array — handles legacy single-object shape. */
function financingArray(f: MapperContract["financing"]): MapperFinancing[] {
  if (!f) return [];
  if (Array.isArray(f)) return f as MapperFinancing[];
  if (typeof f === "object" && (f as { type?: string }).type === "none") return [];
  return [f as MapperFinancing];
}

type DepositBuckets = Pick<
  DealInput,
  | "cash_deposit"
  | "check_deposit"
  | "debit_deposit"
  | "visa_deposit"
  | "mastercard_deposit"
  | "discover_deposit"
  | "amex_deposit"
  | "finance_deposit"
>;

/** Bucket completed payments into the template's deposit columns. */
export function bucketDeposits(payments: MapperPayment[] | null | undefined): DepositBuckets {
  const buckets: DepositBuckets = {};
  if (!payments) return buckets;

  for (const p of payments) {
    if (p.status !== "completed") continue;
    const amt = p.amount ?? 0;
    if (!amt) continue;

    const add = (key: keyof DepositBuckets) => {
      buckets[key] = (buckets[key] ?? 0) + amt;
    };

    switch (p.method) {
      case "cash":
        add("cash_deposit");
        break;
      case "ach":
        // ACH is closer to a bank-check than a debit card swipe
        add("check_deposit");
        break;
      case "debit_card":
        add("debit_deposit");
        break;
      case "financing":
        add("finance_deposit");
        break;
      case "credit_card": {
        const brand = (p.card_brand ?? "").toLowerCase().replace(/\s+/g, "");
        if (brand === "visa") add("visa_deposit");
        else if (brand === "mastercard") add("mastercard_deposit");
        else if (brand === "discover") add("discover_deposit");
        else if (brand === "americanexpress" || brand === "amex") add("amex_deposit");
        else add("visa_deposit"); // fallback for unrecognized brands
        break;
      }
      default:
        add("cash_deposit");
    }
  }

  return buckets;
}

/** Coerce nullable override value to undefined (DealInput is undefined-only). */
function ov<T>(v: T | null | undefined): T | undefined {
  return v ?? undefined;
}

/** Convert one contract row to a DealInput. */
export function contractToDeal(contract: MapperContract): DealInput {
  const customer = contract.customer ?? {};
  const lineItem = (contract.line_items ?? [])[0] ?? {};
  const financing = financingArray(contract.financing);
  const totalFinanced = financing.reduce((sum, f) => sum + (f.financed_amount ?? 0), 0);
  const firstFinancing = financing[0];
  const o = contract.override ?? {};

  return {
    day_of_week: ov(o.day_of_week) ?? dayOfWeek(contract.created_at),
    status: ov(o.status_override) ?? statusLabel(contract),
    last_name: customer.last_name ?? undefined,
    first_name: customer.first_name ?? undefined,
    address: customer.address ?? undefined,
    city: customer.city ?? undefined,
    state: customer.state ?? undefined,
    zip: customer.zip ?? undefined,

    salesman_1: contract.sales_rep?.full_name ?? undefined,
    salesman_2: ov(o.salesman_2),
    salesman_3: ov(o.salesman_3),
    salesman_4: ov(o.salesman_4),

    model: lineItem.model_code ?? lineItem.product_name ?? "",
    color: ov(o.color) ?? lineItem.shell_color ?? undefined,
    color_cost: ov(o.color_cost),
    cabinet: ov(o.cabinet) ?? lineItem.cabinet_color ?? undefined,
    cabinet_cost: ov(o.cabinet_cost),
    serial_number: ov(o.serial_number) ?? lineItem.serial_number ?? undefined,
    masterpur: ov(o.masterpur),
    masterpur_cost: ov(o.masterpur_cost),
    floor_system: ov(o.floor_system),
    floor_system_cost: ov(o.floor_system_cost),
    other_options_1: ov(o.other_options_1),
    other_options_1_cost: ov(o.other_options_1_cost),
    other_options_2: ov(o.other_options_2),
    other_options_2_cost: ov(o.other_options_2_cost),
    other_spa_costs: ov(o.other_spa_costs),
    step: ov(o.step),
    freight_cost: ov(o.freight_cost),
    delivery_cost: ov(o.delivery_cost),
    crane_cost: ov(o.crane_cost),
    removal_cost: ov(o.removal_cost),
    cover_lift_type: ov(o.cover_lift_type),
    cover_lift_count: ov(o.cover_lift_count),

    sale_price: contract.subtotal ?? undefined,
    sales_tax_rate: contract.tax_rate ?? undefined,
    override_reason: ov(o.override_reason),
    commission_rate: ov(o.commission_rate),
    spiff_reason: ov(o.spiff_reason),
    spiff_amount: ov(o.spiff_amount),
    spiff_payable: ov(o.spiff_payable),

    financed_amount: totalFinanced > 0 ? totalFinanced : undefined,
    plan_number: ov(o.plan_number) ?? firstFinancing?.plan_number,
    financing_cost: ov(o.financing_cost),
    approx_delivery_date: ov(o.approx_delivery_date),

    ...bucketDeposits(contract.payments),

    marketing_feedback: ov(o.marketing_feedback),
    comments: ov(o.comments) ?? contract.notes ?? undefined,
  };
}

/** Build the Variables-tab payload from show + assigned reps. */
export function buildShowConfig(
  show: ShowMeta,
  salesmanRoster: string[],
): ShowConfigInput {
  const start = new Date(show.start_date + "T00:00:00");
  const end = new Date(show.end_date + "T00:00:00");
  const sameYear = start.getFullYear() === end.getFullYear();

  // Format like "5/15-5/17/26" — matches Lori's convention
  const yy = String(end.getFullYear()).slice(-2);
  const startPart = `${start.getMonth() + 1}/${start.getDate()}`;
  const endPart = `${end.getMonth() + 1}/${end.getDate()}/${yy}`;
  const date_range = sameYear && start.getTime() !== end.getTime()
    ? `${startPart}-${endPart}`
    : start.getTime() === end.getTime()
      ? `${startPart}/${yy}`
      : `${startPart}/${String(start.getFullYear()).slice(-2)}-${endPart}`;

  return {
    show_name: show.name,
    location: `${show.venue_name} - ${show.city}, ${show.state}`,
    date_range,
    date_of_last_day: end,
    salesman_roster: salesmanRoster.slice(0, 20),
  };
}
