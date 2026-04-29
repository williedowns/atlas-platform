// ─── User & Auth ────────────────────────────────────────────────────────────

export type UserRole = "admin" | "manager" | "sales_rep" | "bookkeeper" | "field_crew" | "customer";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  assigned_location_id?: string;
  created_at: string;
}

// ─── Locations ───────────────────────────────────────────────────────────────

export type LocationType = "store" | "show";

export interface Location {
  id: string;
  name: string;
  type: LocationType;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone?: string;
  cc_surcharge_enabled: boolean;
  cc_surcharge_rate: number; // e.g. 0.035 = 3.5%
  floor_price_enabled: boolean;
  active: boolean;
  created_at: string;
}

// ─── Shows / Events ──────────────────────────────────────────────────────────

export interface Show {
  id: string;
  name: string;
  location_id: string;
  location?: Location;
  venue_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  start_date: string;
  end_date: string;
  assigned_rep_ids: string[];
  active: boolean;
  created_at: string;
}

// ─── Products ─────────────────────────────────────────────────────────────────

// ─── Products (extended) ──────────────────────────────────────────────────────

export interface Product {
  id: string;
  qbo_item_id: string;
  name: string;
  sku: string;
  category: string;
  line?: string;       // "Clarity", "H2X", "Twilight Series", etc.
  model_code?: string; // "C Bal 7", "X T19D", etc.
  has_serial?: boolean;
  msrp: number;
  floor_price?: number;
  description?: string;
  photo_url?: string;
  active: boolean;
  synced_at: string;
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export type InventoryStatus =
  | "on_order"
  | "in_factory"
  | "in_transit"
  | "at_location"
  | "at_show"
  | "allocated"
  | "delivered";

export type UnitType =
  | "stock"
  | "factory_build"
  | "floor_model"
  | "blem"
  | "wet_model";

export interface InventoryUnit {
  id: string;
  serial_number?: string | null;
  order_number?: string | null; // W-prefix factory order number
  product_id?: string | null;
  product?: Product;
  location_id?: string | null;
  location?: Location;
  show_id?: string | null;
  show?: Show;
  status: InventoryStatus;
  unit_type: UnitType;
  shell_color?: string | null;
  cabinet_color?: string | null;
  wrap_status?: "WR" | "UN" | null;
  sub_location?: string | null;
  received_date?: string | null;
  msrp_override?: number | null;
  contract_id?: string | null;
  delivery_work_order_id?: string | null;
  notes?: string | null;
  model_code?: string | null;        // raw model code from spreadsheet
  delivery_team?: "atlas" | "fierce" | "houston_aaron" | null;
  customer_name?: string | null;     // legacy: sold units not yet in contracts
  fin_balance?: string | null;       // legacy: remaining finance balance
  created_at: string;
  updated_at: string;
}

export interface InventoryTransfer {
  id: string;
  unit_id: string;
  from_location_id?: string | null;
  to_location_id?: string | null;
  from_show_id?: string | null;
  to_show_id?: string | null;
  transferred_by?: string | null;
  notes?: string | null;
  created_at: string;
}

// ─── Customers ────────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  cascade_crm_id?: string;
  qbo_customer_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  has_prescription: boolean;
  prescription_url?: string;
  created_at: string;
}

// ─── Contracts ────────────────────────────────────────────────────────────────

export type ContractStatus =
  | "draft"
  | "pending_signature"
  | "signed"
  | "deposit_collected"
  | "in_production"
  | "ready_for_delivery"
  | "delivered"
  | "cancelled";

export type PaymentMethod = "credit_card" | "debit_card" | "ach" | "cash" | "financing";

export type DiscountType =
  | "factory_rebate"
  | "floor_model"
  | "military"
  | "financing_discount"
  | "show_special"
  | "manager_override"
  | "other";

export interface ContractDiscount {
  type: DiscountType;
  label: string;
  amount: number; // always positive, applied as negative line
  requires_approval: boolean;
  approved_by?: string;
}

export type FinancingType = "third_party" | "in_house" | "none";

export interface ContractFinancing {
  type: FinancingType;
  financer_name?: string;
  plan_number?: string;
  plan_description?: string;
  approval_number?: string;
  financed_amount: number;
  /** true = deducted from balance at POS (GreenSky, Wells Fargo); false = carries to balance (Foundation) */
  deduct_from_balance?: boolean;

  // ── Foundation Finance specifics (manual fields per Robert Kennedy 2026-04-28) ──
  /** Tier 1–5; affects rate and fee structure */
  foundation_tier?: 1 | 2 | 3 | 4 | 5;
  /** Approved percentage (e.g. 92, 95, 100). Affects fee — 2.5% up to $250 max on the discount portion */
  foundation_approved_pct?: number;
  /** Salesperson-elected buy-down rate (optional). Reduces customer rate for a fee. */
  foundation_buydown_rate?: number;
  /** ACH info collected at sale to skip Robert chasing the customer post-show */
  foundation_ach_routing?: string;
  foundation_ach_account?: string;
  foundation_ach_bank?: string;
  /** True if salesperson opted to waive ACH (cost up to $250 from commission) */
  foundation_ach_waived?: boolean;

  /** In-House Financing — ACH info collected at sale; emailed to Robert Kennedy */
  inhouse_ach_routing?: string;
  inhouse_ach_account?: string;
  inhouse_ach_bank?: string;
  inhouse_ach_holder_name?: string;
  /** In-House lifecycle stage — Robert / managers update this as the loan moves through DocuSign / repayment */
  inhouse_app_status?: "application_sent" | "docusign_sent" | "cleared_for_delivery" | "in_repayment" | "paid_off" | "failed";
  inhouse_app_sent_at?: string;
  inhouse_docusign_signed_at?: string;
  inhouse_app_notes?: string;
  /** Wells Fargo: charge mode at point of sale */
  wf_charge_mode?: "charge_now" | "authorize_future";
  /** Wells Fargo: scheduled date for the future charge (when wf_charge_mode = authorize_future) */
  wf_future_charge_date?: string;
  /** Primary borrower on the loan. If unset, defaults to the spa contract customer.
   * Stored only when different from the contract customer (to avoid duplication).
   * Available on every financing entry — relevant for ALL financing types. */
  primary_buyer_first_name?: string;
  primary_buyer_last_name?: string;
  primary_buyer_email?: string;
  primary_buyer_phone?: string;

  /** Secondary / co-buyer (optional). Foundation requires a unique email for the
   * second signer; other lenders accept it as informational. */
  secondary_buyer_email?: string;
  secondary_buyer_first_name?: string;
  secondary_buyer_last_name?: string;
  secondary_buyer_phone?: string;

  // ── Lyon Financial specifics (4-stage funding per 2026-04-28 letter) ──
  /** Project type drives the stage template Lyon uses */
  lyon_project_type?: "fiberglass_pool" | "vinyl_liner_pool" | "materials_only" | "metal_building" | "metal_building_prefab";
  /** Funding flavor — Lyon-direct ACH/wire vs LightStream funds the customer */
  lyon_funding_flavor?: "lyon_direct" | "lightstream_via_customer";
  /** Stage-by-stage progress; 2-4 stages depending on project type */
  lyon_stages?: LyonStage[];
}

export interface LyonStage {
  stage_num: number;
  label: string;
  percent: number;
  expected_amount: number;
  photo_url?: string;
  /** Status of the customer's e-initial on the photo via Lyon portal */
  customer_initial_status?: "not_sent" | "pending" | "accepted" | "declined";
  status: "not_started" | "photo_uploaded" | "submitted_to_lyon" | "funded" | "skipped";
  funded_amount?: number;
  funded_at?: string;
  notes?: string;
}

export interface FinancingProvider {
  id: string;
  name: string;
  active: boolean;
}

export interface FinancingPlan {
  id: string;
  provider_id: string;
  provider_name?: string;
  plan_number: string;
  description: string;
  dealer_fee_rate?: number;
  term_months?: number;
  active: boolean;
}

export interface ContractLineItem {
  product_id: string;
  product_name: string;
  // Physical unit identification (when linked to inventory)
  inventory_unit_id?: string;
  serial_number?: string;
  unit_type?: UnitType;      // stock, floor_model, blem, etc.
  shell_color?: string;
  cabinet_color?: string;
  line?: string;             // product line for display on contract
  model_code?: string;
  msrp: number;
  sell_price: number; // floor or negotiated price; 0 if waived
  quantity: number;
  waived?: boolean; // included free as sales incentive
}

export interface Contract {
  id: string;
  contract_number: string;
  status: ContractStatus;

  // Parties
  customer_id: string;
  customer?: Customer;
  sales_rep_id: string;
  sales_rep?: User;

  // Context
  show_id?: string;
  show?: Show;
  location_id: string;
  location?: Location;

  // Line items
  line_items: ContractLineItem[];
  discounts: ContractDiscount[];
  financing: ContractFinancing;

  // Financials
  subtotal: number;
  discount_total: number;
  tax_amount: number;
  tax_rate: number;
  surcharge_amount: number;
  surcharge_rate: number;
  total: number;
  deposit_amount: number;
  deposit_paid: number;
  balance_due: number;

  // Payment
  payment_method?: PaymentMethod;
  intuit_payment_id?: string;

  // QBO
  qbo_estimate_id?: string;
  qbo_deposit_invoice_id?: string;
  qbo_final_invoice_id?: string;

  // Signatures
  customer_signature_url?: string;
  signed_at?: string;
  contract_pdf_url?: string;

  // Notes
  notes?: string;

  created_at: string;
  updated_at: string;
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export type PaymentStatus = "pending" | "processing" | "completed" | "failed" | "refunded";

export interface Payment {
  id: string;
  contract_id: string;
  amount: number;
  surcharge_amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  intuit_charge_id?: string;
  receipt_url?: string;
  processed_at?: string;
  created_at: string;
}

// ─── Tax (Avalara) ────────────────────────────────────────────────────────────

export interface TaxCalculation {
  total_tax: number;
  tax_rate: number;
  jurisdiction: string;
  lines: {
    line_number: number;
    tax_amount: number;
    rate: number;
  }[];
}

// ─── Delivery ─────────────────────────────────────────────────────────────────

export type WorkOrderStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

export interface DeliveryWorkOrder {
  id: string;
  contract_id: string;
  contract?: Contract;
  assigned_crew_ids: string[];
  scheduled_date: string;
  status: WorkOrderStatus;
  checklist_items: ChecklistItem[];
  customer_signature_url?: string;
  completed_at?: string;
  notes?: string;
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  completed_at?: string;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface LocationStats {
  location_id: string;
  location_name: string;
  location_type: LocationType;
  contracts_today: number;
  revenue_today: number;
  deposits_today: number;
  units_sold_today: number;
  top_rep?: string;
}

export interface DashboardData {
  date: string;
  locations: LocationStats[];
  total_contracts: number;
  total_revenue: number;
  total_deposits: number;
  pending_signatures: number;
  inventory_alerts: number;
}
