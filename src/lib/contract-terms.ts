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
      "All spas and swim spas require a flat, solid surface beneath them, consisting of either a crushed granite base or a concrete slab. A four-inch (4\") reinforced concrete slab is the recommended foundation for hot tubs, and a six-inch (6\") reinforced concrete slab is the recommended foundation for swim spas. A reinforced deck is an acceptable alternative foundation for hot tubs but is not recommended for swim spas. Grass, dirt, loose gravel, sand, and other unprepared surfaces are not acceptable. Atlas Spas & Swim Spas is not responsible for damage to the unit, surrounding property, or persons resulting from installation on an inadequate base.",
    ],
  },
  {
    heading: "Electrical & Utilities",
    clauses: [
      "240-volt equipment requires a dedicated 50-amp 240V breaker unless otherwise noted. All spas and swim spas must be installed by a certified, licensed electrician. Atlas Spas & Swim Spas does not provide electrician services.",
      "Swim spas may require multiple unique power connections. Detailed power requirements and specifications for the specific model purchased are published in the complimentary owner's manual, which is available free of charge online.",
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
      "Acceptable forms of payment are cashier's check, money order, personal check, ACH bank transfer, cash, credit card, and approved financing. The remaining balance is due at the time the spa or swim spa is scheduled to leave the factory. Make checks payable to: Atlas Spas & Swim Spas.",
    ],
  },
  {
    heading: "Sales Tax & Prescription Refunds",
    clauses: [
      "Sales tax is charged at the time of sale. Texas customers may receive a refund of the items portion of sales tax when Atlas Spas & Swim Spas receives a valid prescription within 30 days of the sale. The documentation fee tax is required by state statute and is not eligible for refund under any circumstance.",
    ],
  },
];

export type AckKey =
  | "sales_final"
  | "cancellation_forfeit" // legacy — retained for backward read compatibility on contracts signed before the merge
  | "rx_30_day"
  | "improper_base"
  | "blem_acknowledgment";

export interface AcknowledgmentClause {
  /** Storage key on signature_metadata.acknowledgments */
  key: AckKey;
  /** Short label shown on the checkbox itself */
  label: string;
  /** Full legal text customer is acknowledging */
  text: string;
}

export const REQUIRED_ACKNOWLEDGMENTS: AcknowledgmentClause[] = [
  {
    key: "sales_final",
    label: "All Sales Final — No Refunds",
    text: "I understand that all sales are final and no refunds will be issued. I further understand that any agreement cancelled by me will forfeit any and all deposits paid.",
  },
  {
    key: "improper_base",
    label: "Improper Base Voids Warranty",
    text: "I understand that installation of the spa or swim spa on an improper or inadequate base voids all warranties provided by Atlas Spas & Swim Spas and the manufacturer. It is my responsibility to ensure the unit is installed on an approved foundation as set forth in the Site Preparation & Delivery terms above.",
  },
  {
    key: "rx_30_day",
    label: "Texas Sales and Use Tax Exemption Certification — 30 Day Deadline",
    text: "If I am claiming a Texas sales and use tax exemption, I understand that a prescription signed by a licensed health care professional for the purchaser for hydrotherapy must be received by Atlas Spas & Swim Spas within thirty (30) days of the date of purchase. No refunds of sales tax will be issued after this thirty (30) day deadline under any circumstances.",
  },
];

// Surfaced ONLY when at least one line item has unit_type='blem'. Captured
// alongside the three required acknowledgments in Step7Sign / RemoteSignForm
// when applicable. The Show-to-Customer tap-through gate on each blem line
// must be satisfied before the initial pad enables.
export const BLEM_ACKNOWLEDGMENT: AcknowledgmentClause = {
  key: "blem_acknowledgment",
  label: "Blem Acceptance — Sold As-Is",
  text: "I have seen the photos and description of the blemishes on this unit and accept the product as-is with these existing imperfections.",
};

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
  // Legacy — retained so PDFs regenerated from pre-merge contracts still
  // parse cleanly. New contracts merge the cancellation language into
  // sales_final and do not collect a separate cancellation initial.
  cancellation_forfeit?: boolean;
  cancellation_forfeit_initials_url?: string;
  rx_30_day?: boolean;
  rx_30_day_initials_url?: string;
  improper_base?: boolean;
  improper_base_initials_url?: string;
  // Conditional clause — only present when contract includes blem line item(s).
  blem_acknowledgment?: boolean;
  blem_acknowledgment_initials_url?: string;
  // Timestamps proving the Show-to-Customer photo-viewing gate fired for
  // each blem line item the customer reviewed. Keyed by blem_line_id.
  blem_photos_viewed_at?: Record<string, string>;
  acknowledged_at?: string;
}
