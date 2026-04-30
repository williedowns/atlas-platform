/**
 * Atlas Spas & Swim Spas — Sales Agreement Terms & Conditions.
 *
 * Source of truth carried forward from the legacy paper Sales Agreement.
 * Used by the Step 7 sign UI and the generated contract / quote PDFs so
 * both surfaces show the exact same legal language. Any change here
 * propagates to both.
 *
 * Original paper agreement structure preserved (same clauses, same
 * intent) with cleaner sentence structure for readability. Three
 * customer-initials acknowledgments — All Sales Final, Cancellation
 * Forfeits Deposits, and the TX Rx 30-day deadline — are surfaced as
 * dedicated clauses to keep the legal trail explicit.
 */

export interface TermSection {
  heading: string;
  clauses: string[];
}

export const TERMS_AND_CONDITIONS: TermSection[] = [
  {
    heading: "Site Preparation & Delivery",
    clauses: [
      "Customer is responsible for ensuring the delivery path is flat, level, and clear of obstructions before delivery. Atlas Spas & Swim Spas does not remove doors, windows, walls, railings, or perform construction work of any kind. Damage resulting from inadequate access is the customer's responsibility.",
      "Customer is responsible for confirming compliance with all local building codes, including any structural requirements for deck installations.",
      "All spas and swim spas require a flat, solid surface beneath them. A 4\" reinforced concrete slab is recommended.",
    ],
  },
  {
    heading: "Electrical & Utilities",
    clauses: [
      "240-volt equipment requires a dedicated 50-amp 240V breaker unless otherwise noted. All spas and swim spas must be installed by a certified, licensed electrician. Atlas Spas & Swim Spas does not provide electrician services.",
      "Swim spas may require multiple unique power connections. Refer to the published power requirements and specifications for the specific model purchased.",
    ],
  },
  {
    heading: "Water Chemistry & Service",
    clauses: [
      "Customer is responsible for maintaining proper water chemistry. Atlas Spas & Swim Spas is not responsible for damage caused by improper water chemistry.",
      "Service and trip charges are not covered under warranty.",
    ],
  },
  {
    heading: "Permits, Zoning & HOA",
    clauses: [
      "Atlas Spas & Swim Spas is not responsible for obtaining building permits, ensuring zoning compliance, or interpreting HOA covenants. The customer is responsible for contacting their local code enforcement office and HOA before purchase and delivery.",
    ],
  },
  {
    heading: "Payment Terms",
    clauses: [
      "Acceptable forms of payment are cashier's check, money order, credit card, and approved financing. The remaining balance is due at the time the spa or swim spa is scheduled to leave the factory. Make checks payable to: Atlas Spas & Swim Spas.",
    ],
  },
  {
    heading: "Sales Tax & Prescription Refunds",
    clauses: [
      "Sales tax is charged at the time of sale. Texas customers may receive a refund of the items portion of sales tax when Atlas Spas & Swim Spas receives a valid prescription within 30 days of the sale. The documentation fee tax is required by state statute and is not eligible for refund under any circumstance.",
    ],
  },
];

export interface AcknowledgmentClause {
  /** Storage key on signature_metadata.acknowledgments */
  key: "sales_final" | "cancellation_forfeit" | "rx_30_day";
  /** Short label shown on the checkbox itself */
  label: string;
  /** Full legal text customer is acknowledging */
  text: string;
}

export const REQUIRED_ACKNOWLEDGMENTS: AcknowledgmentClause[] = [
  {
    key: "sales_final",
    label: "All Sales Final — No Refunds",
    text: "I understand that all sales are final and no refunds will be issued.",
  },
  {
    key: "cancellation_forfeit",
    label: "Cancellation Forfeits Deposits",
    text: "I understand that any agreement cancelled by me will forfeit any and all deposits paid.",
  },
  {
    key: "rx_30_day",
    label: "Texas Prescription — 30-Day Deadline",
    text: "If I am claiming a Texas sales-tax exemption based on a prescription, I understand that the prescription must be received by Atlas Spas & Swim Spas within 30 days from the date of sale. No refunds will be issued after 30 days. No exceptions.",
  },
];

/**
 * Shape persisted under contracts.signature_metadata.acknowledgments.
 *
 * Each boolean flag mirrors the legacy paper contract's "Customer Initials
 * ___" line: true means the customer drew their initials inside the
 * dedicated pad on Step 7. The companion `*_initials_url` field is the
 * captured PNG (data URL or signed Supabase Storage URL — same fallback
 * pattern as the main customer_signature_url) so the generated PDF can
 * embed the actual ink, not a typed approximation.
 */
export interface AcknowledgmentsRecord {
  sales_final?: boolean;
  sales_final_initials_url?: string;
  cancellation_forfeit?: boolean;
  cancellation_forfeit_initials_url?: string;
  rx_30_day?: boolean;
  rx_30_day_initials_url?: string;
  acknowledged_at?: string;
}
