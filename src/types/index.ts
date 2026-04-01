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

export interface Product {
  id: string;
  qbo_item_id: string;
  name: string;
  sku: string;
  category: string;
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
  | "at_location"
  | "allocated"
  | "sold"
  | "delivered";

export interface InventoryUnit {
  id: string;
  serial_number: string;
  product_id: string;
  product?: Product;
  location_id?: string;
  location?: Location;
  status: InventoryStatus;
  contract_id?: string;
  delivery_work_order_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
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
  serial_number?: string;
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
