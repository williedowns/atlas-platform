import XlsxPopulate from "xlsx-populate";
import path from "path";

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "src/lib/show-sales/show-sales-template.xlsx"
);

/**
 * Input shape for a single deal row in the Sales tab.
 * Many fields are optional because the template's formulas compute them
 * from raw inputs (e.g. Total Cost is a VLOOKUP, Sales Tax = Sale Price × Rate).
 * Only INPUT fields (those Lori or her show managers type directly) are listed.
 */
export type DealInput = {
  day_of_week: string;        // 'Fri', 'Sat', 'Sun'
  status: string;             // 'OK', 'Cancelled', 'Low Deposit', 'Contingent', 'Financing Pending'
  last_name?: string;
  first_name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;

  salesman_1?: string;
  salesman_2?: string;
  salesman_3?: string;
  salesman_4?: string;

  model: string;
  color?: string;
  color_cost?: number;
  cabinet?: string;
  cabinet_cost?: number;
  serial_number?: string;
  masterpur?: string;          // 'YES'/'NO'
  masterpur_cost?: number;
  floor_system?: string;       // 'YES'/'NO'
  floor_system_cost?: number;
  other_options_1?: string;
  other_options_1_cost?: number;
  other_options_2?: string;
  other_options_2_cost?: number;
  other_spa_costs?: number;
  step?: string;               // 'YES'/'NO'
  freight_cost?: number;
  delivery_cost?: number;
  crane_cost?: number;
  removal_cost?: number;
  cover_lift_type?: string;
  cover_lift_count?: number;

  sale_price?: number;
  delivery_cost_charged?: number;
  cancelled_deal_sale_amount?: number;
  sales_tax_rate?: number;     // 0.0825 etc.
  override_reason?: string;
  commission_rate?: number;    // 0.07 etc.
  spiff_reason?: string;
  spiff_amount?: number;
  spiff_payable?: string;      // 'YES'/'NO'

  cash_deposit?: number;
  check_deposit?: number;
  debit_deposit?: number;
  visa_deposit?: number;
  mastercard_deposit?: number;
  discover_deposit?: number;
  amex_deposit?: number;
  finance_deposit?: number;

  financed_amount?: number;
  plan_number?: string;
  financing_cost?: number;
  approx_delivery_date?: string;
  marketing_feedback?: string;
  comments?: string;
};

/**
 * Show-level config that populates the Variables tab.
 */
export type ShowConfigInput = {
  show_name: string;
  location: string;
  date_range: string;          // '5/15-5/17/26'
  date_of_last_day: Date;
  salesman_roster: string[];   // up to 20 names; pads with empty strings
};

const SALES_FIRST_DATA_ROW = 4;

/**
 * Build the show-sales XLSX workbook by loading the template (which carries
 * all of Lori's formulas, charts, formatting, and frozen panes) and injecting
 * deal data into the Sales tab plus show config into the Variables tab.
 *
 * The formulas in the template handle: Step Cost / Spa Cost / Chem Kit /
 * Lifter Costs / Total Cost / Sales Tax / Commission Amount / per-salesman
 * commission splits / Total Deposit / Contingent Sales / per-spa option pricing.
 * We only write the raw INPUT fields.
 */
export async function exportShowSalesWorkbook(
  show: ShowConfigInput,
  deals: DealInput[]
): Promise<Buffer> {
  const workbook = await XlsxPopulate.fromFileAsync(TEMPLATE_PATH);

  // === Sales tab ===
  const sales = workbook.sheet("Sales");
  if (!sales) throw new Error("Template missing Sales sheet");

  deals.forEach((deal, i) => {
    const row = SALES_FIRST_DATA_ROW + i;
    const set = (col: string, v: unknown) => {
      if (v !== undefined && v !== null && v !== "") sales.cell(`${col}${row}`).value(v as never);
    };

    set("A", deal.day_of_week);
    set("B", deal.status);
    set("C", i + 1);
    set("D", deal.last_name);
    set("E", deal.first_name);
    set("F", deal.address);
    set("G", deal.city);
    set("H", deal.state);
    set("I", deal.zip);

    set("J", deal.salesman_1);
    set("K", deal.salesman_2);
    set("L", deal.salesman_3);
    set("M", deal.salesman_4);

    set("N", deal.model);
    set("O", deal.color);
    set("P", deal.color_cost);
    set("Q", deal.cabinet);
    set("R", deal.cabinet_cost);
    set("S", deal.serial_number);
    set("T", deal.masterpur);
    set("U", deal.masterpur_cost);
    set("V", deal.floor_system);
    set("W", deal.floor_system_cost);
    set("X", deal.other_options_1);
    set("Y", deal.other_options_1_cost);
    set("Z", deal.other_options_2);
    set("AA", deal.other_options_2_cost);
    set("AB", deal.other_spa_costs);
    set("AC", deal.step);
    // AD Step Cost — FORMULA, don't overwrite
    // AE Spa Cost — FORMULA
    // AF Chem Kit — FORMULA
    set("AG", deal.freight_cost);
    set("AH", deal.delivery_cost);
    set("AI", deal.crane_cost);
    set("AJ", deal.removal_cost);
    set("AK", deal.cover_lift_type);
    set("AL", deal.cover_lift_count);
    // AM Lifter Costs — FORMULA
    // AN Total Cost — FORMULA
    set("AO", deal.sale_price);
    set("AP", deal.delivery_cost_charged);
    set("AQ", deal.cancelled_deal_sale_amount);
    set("AR", deal.sales_tax_rate);
    // AS Sales Tax — FORMULA
    set("AT", deal.override_reason);
    set("AU", deal.commission_rate);
    // AV Comm Amount — FORMULA
    set("AW", deal.spiff_reason);
    set("AX", deal.spiff_amount);
    set("AY", deal.spiff_payable);
    // AZ Spiff Paid Out @ Show — FORMULA
    // BA Spiff amount paid on check — FORMULA
    // BB-BU per-salesman commission splits — ALL FORMULA
    set("BV", deal.cash_deposit);
    set("BW", deal.check_deposit);
    set("BX", deal.debit_deposit);
    set("BY", deal.visa_deposit);
    set("BZ", deal.mastercard_deposit);
    set("CA", deal.discover_deposit);
    set("CB", deal.amex_deposit);
    set("CC", deal.finance_deposit);
    // CD Total Deposit — FORMULA
    set("CE", deal.financed_amount);
    set("CF", deal.plan_number);
    set("CG", deal.financing_cost);
    set("CH", deal.approx_delivery_date);
    set("CI", deal.marketing_feedback);
    set("CJ", deal.comments);
    // CL-CO Contingent fields — FORMULAS
    // CP-DI Spa option pricing columns — FORMULAS referencing Spas tab
  });

  // === Variables tab ===
  // Column B has static labels ("Show Name", "Location", "Date", "Date of Last Day").
  // Column C carries the actual values per show.
  const variables = workbook.sheet("Variables");
  if (variables) {
    variables.cell("C2").value(show.show_name);
    variables.cell("C3").value(show.location);
    variables.cell("C4").value(show.date_range);
    variables.cell("C5").value(show.date_of_last_day);

    // Salesman roster occupies column A rows 2-21 (up to 20 names)
    for (let i = 0; i < 20; i++) {
      const name = show.salesman_roster[i] ?? "";
      variables.cell(`A${i + 2}`).value(name);
    }
  }

  const buf = await workbook.outputAsync();
  return Buffer.isBuffer(buf) ? buf : Buffer.from(buf as ArrayBuffer);
}
