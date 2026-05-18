/**
 * Shape of a single deal as rendered in the live workbook UI.
 * Combines contract-derived (read-only) fields and override fields the user edits.
 */

export type WorkbookDealAuto = {
  contract_id: string;
  contract_number: string;
  created_at: string;
  contract_status: string;            // raw contracts.status — distinct from workbook 'status'
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_address: string | null;
  customer_city: string | null;
  customer_state: string | null;
  customer_zip: string | null;
  sales_rep_name: string | null;
  /** Primary model display string — model_code or product_name from the first line item */
  model: string;
  /** Auto-derived 3-letter weekday from created_at — shown if no day_of_week override set */
  default_day_of_week: string;
  /** Pre-tax sale price = contracts.subtotal */
  sale_price: number;
  sales_tax_rate: number;
  /** Total of completed payment rows */
  deposits_total: number;
  /** Sum of financed_amount across financing[] entries */
  financed_amount: number;
};

/**
 * Editable workbook fields — corresponds 1:1 with show_deal_overrides columns.
 * Null means "not set yet — fall back to the auto value (if any)".
 */
export type WorkbookDealOverride = {
  status_override: string | null;
  day_of_week: string | null;
  salesman_2: string | null;
  salesman_3: string | null;
  salesman_4: string | null;
  color: string | null;
  color_cost: number | null;
  cabinet: string | null;
  cabinet_cost: number | null;
  serial_number: string | null;
  masterpur: string | null;
  masterpur_cost: number | null;
  floor_system: string | null;
  floor_system_cost: number | null;
  other_options_1: string | null;
  other_options_1_cost: number | null;
  other_options_2: string | null;
  other_options_2_cost: number | null;
  other_spa_costs: number | null;
  step: string | null;
  freight_cost: number | null;
  delivery_cost: number | null;
  crane_cost: number | null;
  removal_cost: number | null;
  cover_lift_type: string | null;
  cover_lift_count: number | null;
  override_reason: string | null;
  commission_rate: number | null;
  spiff_reason: string | null;
  spiff_amount: number | null;
  spiff_payable: string | null;
  plan_number: string | null;
  financing_cost: number | null;
  approx_delivery_date: string | null;
  marketing_feedback: string | null;
  comments: string | null;
};

export type WorkbookDeal = {
  auto: WorkbookDealAuto;
  override: WorkbookDealOverride;
};

export const EMPTY_OVERRIDE: WorkbookDealOverride = {
  status_override: null,
  day_of_week: null,
  salesman_2: null,
  salesman_3: null,
  salesman_4: null,
  color: null,
  color_cost: null,
  cabinet: null,
  cabinet_cost: null,
  serial_number: null,
  masterpur: null,
  masterpur_cost: null,
  floor_system: null,
  floor_system_cost: null,
  other_options_1: null,
  other_options_1_cost: null,
  other_options_2: null,
  other_options_2_cost: null,
  other_spa_costs: null,
  step: null,
  freight_cost: null,
  delivery_cost: null,
  crane_cost: null,
  removal_cost: null,
  cover_lift_type: null,
  cover_lift_count: null,
  override_reason: null,
  commission_rate: null,
  spiff_reason: null,
  spiff_amount: null,
  spiff_payable: null,
  plan_number: null,
  financing_cost: null,
  approx_delivery_date: null,
  marketing_feedback: null,
  comments: null,
};

/** Allowed columns the PATCH endpoint will accept. Guards against arbitrary writes. */
export const OVERRIDE_FIELDS: ReadonlyArray<keyof WorkbookDealOverride> = [
  "status_override", "day_of_week",
  "salesman_2", "salesman_3", "salesman_4",
  "color", "color_cost", "cabinet", "cabinet_cost", "serial_number",
  "masterpur", "masterpur_cost", "floor_system", "floor_system_cost",
  "other_options_1", "other_options_1_cost",
  "other_options_2", "other_options_2_cost",
  "other_spa_costs",
  "step",
  "freight_cost", "delivery_cost", "crane_cost", "removal_cost",
  "cover_lift_type", "cover_lift_count",
  "override_reason", "commission_rate",
  "spiff_reason", "spiff_amount", "spiff_payable",
  "plan_number", "financing_cost",
  "approx_delivery_date", "marketing_feedback", "comments",
] as const;

/** Numeric override columns — server coerces incoming strings to numbers. */
export const NUMERIC_OVERRIDE_FIELDS: ReadonlyArray<keyof WorkbookDealOverride> = [
  "color_cost", "cabinet_cost", "masterpur_cost", "floor_system_cost",
  "other_options_1_cost", "other_options_2_cost", "other_spa_costs",
  "freight_cost", "delivery_cost", "crane_cost", "removal_cost",
  "cover_lift_count",
  "commission_rate", "spiff_amount", "financing_cost",
] as const;
