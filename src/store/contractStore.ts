import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ContractLineItem,
  ContractDiscount,
  ContractFinancing,
  Customer,
  Product,
  Show,
  Location,
  UnitType,
} from "@/types";
import { buildGraniteLineItem, isSpaWithDimensions } from "@/lib/granite";
import { buildConcreteLineItem } from "@/lib/concrete";
import type { MarketingFeedback } from "@/lib/marketing-feedback";
import type { Contract } from "@/types";

export interface ContractDraft {
  // Context
  show_id?: string;
  show?: Show;
  location_id?: string;
  location?: Location;

  // Customer
  customer?: Customer;

  // Line items
  line_items: ContractLineItem[];

  // Discounts
  discounts: ContractDiscount[];

  // Financing (multiple entries supported)
  financing: ContractFinancing[];

  // Payment splits (multiple allowed)
  deposit_splits: DepositSplit[];
  surcharge_enabled: boolean;
  surcharge_rate: number;

  // Tax (from Avalara). `tax_amount` is items-only — see doc_fee_tax_amount
  // below for the always-charged portion that survives a Tax Exempt toggle.
  tax_amount: number;
  tax_rate: number;
  /** Customer has a Texas tax exemption certificate on file */
  tax_exempt: boolean;

  // Audit-log provenance (migration 098). Captured by Step3Products.tsx
  // when /api/tax returns lookup-backed rates; flows through to /api/contracts
  // and /api/quotes via the ...draft spread on submit.
  tax_rate_source?: string | null;
  tax_rate_effective_date?: string | null;
  tax_rate_jurisdictions?: Array<{ name: string; type: string; rate: number }> | null;

  // Documentation fee — auto-added to every contract at $99 per Atlas's
  // legacy paper agreement. Sales rep can waive it (toggle on Step 5).
  // Doc-fee tax is ALWAYS charged even when tax_exempt is true: TX statute
  // requires the tax on the doc fee to be collected and that portion is
  // never refunded when the Rx certificate arrives. Persisting
  // doc_fee_tax_amount separately so the bookkeeping flow can surface
  // exactly which portion is non-refundable.
  doc_fee_amount: number;
  doc_fee_waived: boolean;
  doc_fee_tax_amount: number;

  // Computed totals
  subtotal: number;
  discount_total: number;
  surcharge_amount: number;
  total: number;
  deposit_amount: number; // sum of all deposit_splits amounts

  // Notes — internal: staff-only audit trail. external: printed on customer PDF/email.
  notes?: string;
  external_notes?: string;

  // Internal lead-attribution checklist captured in Step 5 (how they heard about
  // the show, what drew them to the booth, first-time visitor). Validated by
  // normalizeMarketingFeedback at /api/contracts. INTERNAL ONLY — never on the
  // customer PDF. Optional so drafts persisted before this field rehydrate clean.
  marketing_feedback?: MarketingFeedback;

  // Contingencies — hard-stop gates for delivery
  needs_permit?: boolean;
  needs_hoa?: boolean;
  permit_jurisdiction?: string;

  // Delivery diagrams (optional — set in Step 6 before signing)
  // Stored as an array to support multiple scenarios (e.g., Up Steps + Through Door).
  // Legacy single-object shape is tolerated on read by consumers.
  delivery_diagram?: Array<{
    scenario_id: number;
    label: string;
    fields: Record<string, string>;
  }>;

  // Sales-rep estimated delivery window — freeform text like "2-4 weeks",
  // "Mid-June". Customer-visible in portal + printed on contract PDF.
  // Set in Step 6 of the wizard; editable by admin/manager from the
  // contract detail page after creation.
  delivery_timeframe?: string;

  // Set after contract is created at sign step
  created_contract_id?: string;

  // Idempotency key generated client-side at first Step 7 submit. Persisted
  // alongside the rest of the draft so a retry (network blip, page reload,
  // iPad sleep) re-uses the same key — server then dedupes via the
  // `(sales_rep_id, idempotency_key)` partial unique index instead of
  // creating a duplicate contract row.
  idempotency_key?: string;

  // Wizard step the rep was on when last interacted. Persisted so a page
  // reload (iPad sleep, app backgrounded long enough for iOS to unload the
  // PWA, accidental navigation) brings them back to where they left off
  // instead of dumping them on Step 1 with their work apparently lost.
  wizard_step?: number;

  // Step 7 partial-sign state — persisted so a mid-signature reload
  // doesn't force the customer to redo everything. Captured incrementally
  // from local form state in Step7Sign on every change.
  signature_data_url?: string;
  signed_name?: string;
  electronic_consent?: boolean;
  initials_urls?: {
    sales_final?: string | null;
    // Legacy — retained for backward compatibility with persisted drafts
    // that were started before the merge into sales_final.
    cancellation_forfeit?: string | null;
    rx_30_day?: string | null;
    improper_base?: string | null;
    blem_acknowledgment?: string | null;
  };

  // Per blem-line "Show to Customer" gate completions. Keyed by
  // ContractLineItem.blem_line_id. Presence of a timestamp means the
  // customer tapped through every photo for that line at that moment.
  // Cleared automatically when the associated line is removed in
  // removeLineItem so a re-pick triggers a fresh review.
  blem_photos_viewed_at?: Record<string, string>;

  // Texas tax-exemption certificate captured at the show floor when the
  // rep flips tax_exempt to true in Step 5. Stored as a data URL because
  // the contract row doesn't exist yet — actual upload to Supabase Storage
  // happens in Step 7's handleSubmit AFTER the contract is created (using
  // the existing /api/portal/upload-cert endpoint with the new contract ID).
  // Cleared by resetDraft so a future contract on the same iPad starts clean.
  tax_exempt_cert_data_url?: string;
  tax_exempt_cert_filename?: string;
  tax_exempt_cert_mime?: string;

  // Doctor's prescription (Rx) staged for upload. The cert alone does NOT
  // zero the tax — only cert + Rx together qualify the customer for the
  // hydrotherapy exemption. Persists to customers.prescription_url +
  // customers.has_prescription via /api/customers/[id]/rx in Step 7.
  rx_data_url?: string;
  rx_filename?: string;
  rx_mime?: string;

  // Concrete pad estimate — toggled at Step 5 when the customer wants
  // concrete instead of crushed granite. No line item, no money collected.
  // Flag + notes carry to the contract row for back-office follow-up.
  // Optional so persisted drafts from prior versions rehydrate cleanly.
  concrete_estimate_pending?: boolean;
  concrete_estimate_notes?: string;

  // Set when this draft is an addon contract spawned from a parent (e.g. a
  // post-show concrete site-prep contract). Persisted on the saved row so the
  // parent's detail page can render a link to the child.
  parent_contract_id?: string;
}

export interface DepositSplit {
  amount: number;
  method: string;
  // Check-only fields
  check_number?: string;
  bank_name?: string;
  /** customer_files row id for the check photo captured at the show floor */
  check_photo_file_id?: string;
  /** Cached signed URL so the rep can preview it inline without a refetch */
  check_photo_signed_url?: string;
  // ACH-only fields (Plaid/Melio integration may replace manual entry later)
  ach_routing_number?: string;
  ach_account_number?: string;
  ach_account_holder_name?: string;
  ach_bank_name?: string;
}

interface InventoryUnitDetails {
  id: string;
  serial_number?: string | null;
  unit_type?: string | null;
  shell_color?: string | null;
  cabinet_color?: string | null;
  // Snapshot copies of blem evidence used when adding a blem unit. The
  // store doesn't fetch these from the DB — the caller (InventoryUnitPicker)
  // passes the values it already loaded so they freeze into the line item
  // at the moment of the customer's review.
  blem_description?: string | null;
  blem_photo_urls?: string[];
}

interface ContractStore {
  draft: ContractDraft;
  setShow: (show: Show, location: Location | null) => void;
  setCustomer: (customer: Customer) => void;
  addLineItem: (
    product: Product,
    price: number,
    waived?: boolean,
    shell_color?: string,
    cabinet_color?: string,
    fromPackage?: ContractLineItem["from_package"],
    // Manual-entry unit metadata: rep declared the unit type without
    // picking a specific inventory unit (e.g. selecting "New Factory
    // Build" with a pending serial). Mirrors the paper-form checkboxes.
    manualUnit?: { unit_type?: UnitType; serial_number?: string },
  ) => void;
  addLineItemWithUnit: (product: Product, price: number, unit: InventoryUnitDetails) => void;
  // Add one Crushed Granite Base line per spa in cart, length locked to each
  // spa's longest side. Skips any spa that already has a linked granite line
  // (idempotent — re-clickable safely after adding more spas). Returns the
  // count of granite lines added.
  addGraniteForSpas: (spas: Product[], price?: number) => number;
  // Add a blem line for a unit NOT in inventory (sale-time fallback).
  // Photos must already be uploaded to the blem-photos bucket — the caller
  // passes the public URLs and an optional unit identifier (e.g. user-typed
  // serial) so receiving can later reconcile to a real inventory row.
  addBlemLineWithoutUnit: (
    product: Product,
    price: number,
    blem: { description: string; photo_urls: string[]; shell_color?: string; cabinet_color?: string }
  ) => void;
  // Mark a blem line's Show-to-Customer photo-viewing gate complete.
  markBlemPhotosViewed: (blem_line_id: string, viewed_at: string) => void;
  // Convert an existing line item to a blem AS-IS sale by attaching a
  // damage description + photo URLs. Mints a new blem_line_id, flips
  // unit_type to 'blem', and stamps the Show-to-Customer gate timestamp.
  // Used when a stock/floor unit picked up new damage that wasn't
  // captured at the inventory-picker step.
  markLineItemAsBlem: (
    index: number,
    blem: { description: string; photo_urls: string[]; photos_viewed_at: string },
  ) => void;
  removeLineItem: (index: number) => void;
  updateLineItemSerial: (index: number, serial: string) => void;
  updateLineItemPrice: (index: number, price: number) => void;
  updateLineItemColors: (index: number, shell_color: string | undefined, cabinet_color: string | undefined) => void;
  addDiscount: (discount: ContractDiscount) => void;
  removeDiscount: (index: number) => void;
  addFinancing: (entry: ContractFinancing) => void;
  removeFinancing: (index: number) => void;
  setTax: (
    taxAmount: number,
    taxRate: number,
    audit?: {
      source: string | null;
      effective_date: string | null;
      jurisdictions: Array<{ name: string; type: string; rate: number }> | null;
    },
  ) => void;
  setTaxExempt: (exempt: boolean) => void;
  setDocFeeWaived: (waived: boolean) => void;
  setSurcharge: (enabled: boolean, rate: number) => void;
  addDepositSplit: (split: DepositSplit) => void;
  removeDepositSplit: (index: number) => void;
  setNotes: (notes: string) => void;
  setExternalNotes: (external_notes: string) => void;
  setMarketingFeedback: (marketing_feedback: MarketingFeedback) => void;
  setNeedsPermit: (needs_permit: boolean) => void;
  setNeedsHoa: (needs_hoa: boolean) => void;
  setPermitJurisdiction: (permit_jurisdiction: string) => void;
  setDeliveryDiagram: (diagram: ContractDraft["delivery_diagram"]) => void;
  setDeliveryTimeframe: (timeframe: string | undefined) => void;
  setCreatedContractId: (id: string) => void;
  setIdempotencyKey: (key: string) => void;
  setWizardStep: (step: number) => void;
  setSignatureDataUrl: (url: string | undefined) => void;
  setSignedName: (name: string) => void;
  setElectronicConsent: (consent: boolean) => void;
  setInitialUrl: (
    key:
      | "sales_final"
      | "cancellation_forfeit"
      | "rx_30_day"
      | "improper_base"
      | "blem_acknowledgment",
    url: string | null
  ) => void;
  setTaxExemptCert: (cert: { dataUrl: string; filename: string; mime: string } | null) => void;
  setRxFile: (rx: { dataUrl: string; filename: string; mime: string } | null) => void;
  setConcreteEstimatePending: (pending: boolean) => void;
  setConcreteEstimateNotes: (notes: string) => void;
  prefillForConcreteAddon: (parentContract: Contract) => void;
  computeTotals: () => void;
  resetDraft: () => void;
  hasDraftProgress: () => boolean;
}

const initialDraft: ContractDraft = {
  line_items: [],
  discounts: [],
  financing: [],
  deposit_splits: [],
  surcharge_enabled: false,
  surcharge_rate: 0.035,
  tax_amount: 0,
  tax_rate: 0,
  tax_exempt: false,
  doc_fee_amount: 99,
  doc_fee_waived: false,
  doc_fee_tax_amount: 0,
  subtotal: 0,
  discount_total: 0,
  surcharge_amount: 0,
  total: 0,
  deposit_amount: 0,
  concrete_estimate_pending: false,
  concrete_estimate_notes: "",
};

function computeTotalsFromDraft(draft: ContractDraft): Partial<ContractDraft> {
  const itemsSubtotal = draft.line_items.reduce(
    (sum, item) => sum + item.sell_price * item.quantity,
    0
  );
  // Doc fee participates in subtotal unless waived. /api/tax does NOT see it
  // (it's not a line item) — its tax is computed locally and stays separate
  // so we can persist + display the always-charged portion explicitly.
  const docFeeAmount = draft.doc_fee_waived ? 0 : (draft.doc_fee_amount ?? 0);
  const subtotal = itemsSubtotal + docFeeAmount;
  const discount_total = draft.discounts.reduce((sum, d) => sum + d.amount, 0);
  // Surcharge applies to the post-discount base (what the customer is actually charged),
  // not the original subtotal. Otherwise discounts don't reduce the surcharge.
  const surchargeBase = Math.max(0, subtotal - discount_total);
  const surcharge_amount = draft.surcharge_enabled
    ? Math.round(surchargeBase * draft.surcharge_rate * 100) / 100
    : 0;
  // Items tax — what /api/tax computed for the goods. Tax-exempt customers
  // zero this out, but the cert alone is not enough: the Rx must also be on
  // file. Cert + Rx = exempt; cert only = tax still applies (Atlas keeps the
  // cert on file alongside the contract for audit, and Lori can refund later
  // if the Rx arrives within 30 days).
  const rxOnFile = !!draft.customer?.has_prescription || !!draft.rx_data_url;
  const effectiveItemsTax = (draft.tax_exempt && rxOnFile) ? 0 : (draft.tax_amount ?? 0);
  // Doc-fee tax is collected on EVERY contract regardless of tax_exempt
  // and is the portion that is never refunded when the Rx arrives.
  const doc_fee_tax_amount = docFeeAmount > 0
    ? Math.round(docFeeAmount * (draft.tax_rate ?? 0) * 100) / 100
    : 0;
  const totalTax = effectiveItemsTax + doc_fee_tax_amount;
  // Surcharge is a per-payment fee charged at CC swipe, NOT a contract obligation.
  // If the balance is paid by check/ACH/financing, the customer never pays it.
  // Keep surcharge_amount in the return for Step 8 to display the live preview,
  // but exclude it from the contract's total/balance-due math.
  const total = Math.max(0, subtotal - discount_total + totalTax);
  const splitsArr = Array.isArray(draft.deposit_splits) ? draft.deposit_splits : [];
  const deposit_amount = splitsArr.reduce((sum, s) => sum + s.amount, 0);

  return { subtotal, discount_total, surcharge_amount, total, deposit_amount, doc_fee_tax_amount };
}

export const useContractStore = create<ContractStore>()(
  persist(
    (set, get) => ({
      draft: initialDraft,

      setShow: (show, location) =>
        set((state) => ({
          draft: {
            ...state.draft,
            // "store-{uuid}" is a synthetic ID used for display only — don't persist as FK
            show_id: show.id.startsWith("store-") ? undefined : show.id,
            show,
            // Only use a real location ID (one that exists in the locations table)
            location_id: location?.id ?? undefined,
            location: location ?? undefined,
            surcharge_enabled: location?.cc_surcharge_enabled ?? false,
            surcharge_rate: location?.cc_surcharge_rate ?? 0.035,
          },
        })),

      setCustomer: (customer) =>
        set((state) => {
          const newDraft = { ...state.draft, customer };
          // Changing the customer can flip the rx-on-file gate (their
          // has_prescription column), so totals must recompute.
          return { draft: { ...newDraft, ...computeTotalsFromDraft(newDraft) } };
        }),

      addLineItem: (product, price, waived = false, shell_color?, cabinet_color?, fromPackage?, manualUnit?) => {
        set((state) => {
          const spaLine: ContractLineItem = {
            product_id: product.id,
            product_name: product.name,
            msrp: product.msrp,
            sell_price: waived ? 0 : price,
            quantity: 1,
            ...(waived ? { waived: true } : {}),
            ...(shell_color ? { shell_color } : {}),
            ...(cabinet_color ? { cabinet_color } : {}),
            ...(fromPackage ? { from_package: fromPackage } : {}),
            // Manual unit metadata — present when the rep declared unit_type
            // via the picker's "Add Without Selecting a Unit" sheet instead
            // of picking a specific inventory row. Serial may be blank for
            // Factory Build; PDF render handles that case explicitly.
            ...(manualUnit?.unit_type ? { unit_type: manualUnit.unit_type } : {}),
            ...(manualUnit?.serial_number ? { serial_number: manualUnit.serial_number } : {}),
          };
          const nextLineItems = [...state.draft.line_items, spaLine];
          const newDraft = { ...state.draft, line_items: nextLineItems };
          return { draft: { ...newDraft, ...computeTotalsFromDraft(newDraft) } };
        });
      },

      addLineItemWithUnit: (product, price, unit) => {
        set((state) => {
          const isBlem = unit.unit_type === "blem";
          const blem_line_id = isBlem
            ? (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `blem-${Date.now()}-${Math.random().toString(36).slice(2)}`)
            : undefined;
          const spaLine: ContractLineItem = {
            product_id: product.id,
            product_name: product.name,
            msrp: product.msrp,
            sell_price: price,
            quantity: 1,
            inventory_unit_id: unit.id,
            serial_number: unit.serial_number ?? undefined,
            unit_type: (unit.unit_type ?? undefined) as UnitType | undefined,
            shell_color: unit.shell_color ?? undefined,
            cabinet_color: unit.cabinet_color ?? undefined,
            ...(isBlem
              ? {
                  blem_line_id,
                  blem_description: unit.blem_description ?? undefined,
                  blem_photo_urls: unit.blem_photo_urls ?? [],
                }
              : {}),
          };
          const nextLineItems = [...state.draft.line_items, spaLine];
          const newDraft = { ...state.draft, line_items: nextLineItems };
          return { draft: { ...newDraft, ...computeTotalsFromDraft(newDraft) } };
        });
      },

      // Sale-time blem path: the salesperson is selling a unit that
      // isn't in inventory (e.g. a floor model with new damage, or an
      // off-spec unit). Photos are already uploaded to blem-photos by
      // the picker before calling this.
      addBlemLineWithoutUnit: (product, price, blem) => {
        set((state) => {
          const blem_line_id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `blem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const spaLine: ContractLineItem = {
            product_id: product.id,
            product_name: product.name,
            msrp: product.msrp,
            sell_price: price,
            quantity: 1,
            unit_type: "blem" as UnitType,
            shell_color: blem.shell_color ?? undefined,
            cabinet_color: blem.cabinet_color ?? undefined,
            blem_line_id,
            blem_description: blem.description,
            blem_photo_urls: blem.photo_urls,
          };
          const nextLineItems = [...state.draft.line_items, spaLine];
          const newDraft = { ...state.draft, line_items: nextLineItems };
          return { draft: { ...newDraft, ...computeTotalsFromDraft(newDraft) } };
        });
      },

      addGraniteForSpas: (spas, price) => {
        let added = 0;
        set((state) => {
          const linkedSpaIds = new Set(
            state.draft.line_items
              .map((li) => li.linked_spa_product_id)
              .filter((id): id is string => !!id)
          );
          const newGraniteLines = spas
            .filter((s) => isSpaWithDimensions(s) && !linkedSpaIds.has(s.id))
            .map((s) => buildGraniteLineItem(s, price));
          added = newGraniteLines.length;
          if (added === 0) return state;
          const nextLineItems = [...state.draft.line_items, ...newGraniteLines];
          const newDraft = { ...state.draft, line_items: nextLineItems };
          return { draft: { ...newDraft, ...computeTotalsFromDraft(newDraft) } };
        });
        return added;
      },

      markBlemPhotosViewed: (blem_line_id, viewed_at) =>
        set((state) => ({
          draft: {
            ...state.draft,
            blem_photos_viewed_at: {
              ...(state.draft.blem_photos_viewed_at ?? {}),
              [blem_line_id]: viewed_at,
            },
          },
        })),

      markLineItemAsBlem: (index, blem) =>
        set((state) => {
          const existing = state.draft.line_items[index];
          if (!existing) return state;
          // Reuse the existing blem_line_id if one was already minted (defensive
          // — markLineItemAsBlem could in theory be called twice on the same
          // row if a rep wants to re-shoot photos); otherwise mint a fresh one.
          const blem_line_id =
            existing.blem_line_id
              ?? (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `blem-${Date.now()}-${Math.random().toString(36).slice(2)}`);
          const nextItem: ContractLineItem = {
            ...existing,
            unit_type: "blem" as UnitType,
            blem_line_id,
            blem_description: blem.description,
            blem_photo_urls: blem.photo_urls,
          };
          const line_items = state.draft.line_items.map((li, i) => (i === index ? nextItem : li));
          const newDraft = {
            ...state.draft,
            line_items,
            blem_photos_viewed_at: {
              ...(state.draft.blem_photos_viewed_at ?? {}),
              [blem_line_id]: blem.photos_viewed_at,
            },
          };
          return { draft: { ...newDraft, ...computeTotalsFromDraft(newDraft) } };
        }),

      removeLineItem: (index) => {
        set((state) => {
          const removed = state.draft.line_items[index];
          // If removing a spa, cascade-remove the FIRST granite line linked to it.
          // Removed-spa index comes BEFORE its granite line in the array (granite
          // is appended right after the spa in addLineItem), so we look up the
          // granite index in the ORIGINAL array, then filter both out together
          // in a single atomic update.
          let graniteIndex = -1;
          if (removed && !removed.linked_spa_product_id) {
            graniteIndex = state.draft.line_items.findIndex(
              (li) => li.linked_spa_product_id === removed.product_id
            );
          }
          const line_items = state.draft.line_items.filter(
            (_, i) => i !== index && i !== graniteIndex
          );
          // Clear the photo-viewed gate timestamp for any removed blem
          // line so a re-pick forces a fresh customer review. If no blem
          // lines remain at all, also clear the blem_acknowledgment initial
          // pad — otherwise the previous initials would persist and submit
          // alongside a contract that no longer has any blem line items.
          const nextViewed = { ...(state.draft.blem_photos_viewed_at ?? {}) };
          if (removed?.blem_line_id) delete nextViewed[removed.blem_line_id];
          const anyBlemRemains = line_items.some((li) => li.unit_type === "blem");
          const nextInitialsUrls = anyBlemRemains
            ? state.draft.initials_urls
            : { ...(state.draft.initials_urls ?? {}), blem_acknowledgment: null };
          const newDraft = {
            ...state.draft,
            line_items,
            blem_photos_viewed_at: nextViewed,
            initials_urls: nextInitialsUrls,
          };
          return { draft: { ...newDraft, ...computeTotalsFromDraft(newDraft) } };
        });
      },

      updateLineItemSerial: (index, serial_number) => {
        set((state) => {
          const line_items = state.draft.line_items.map((item, i) =>
            i === index ? { ...item, serial_number } : item
          );
          return { draft: { ...state.draft, line_items } };
        });
      },

      updateLineItemPrice: (index, price) => {
        set((state) => {
          const line_items = state.draft.line_items.map((item, i) =>
            i === index ? { ...item, sell_price: price, waived: false } : item
          );
          const newDraft = { ...state.draft, line_items };
          return { draft: { ...newDraft, ...computeTotalsFromDraft(newDraft) } };
        });
      },

      updateLineItemColors: (index, shell_color, cabinet_color) => {
        set((state) => {
          const line_items = state.draft.line_items.map((item, i) =>
            i === index ? { ...item, shell_color, cabinet_color } : item
          );
          return { draft: { ...state.draft, line_items } };
        });
      },

      addDiscount: (discount) => {
        set((state) => {
          const newDraft = {
            ...state.draft,
            discounts: [...state.draft.discounts, discount],
          };
          return { draft: { ...newDraft, ...computeTotalsFromDraft(newDraft) } };
        });
      },

      removeDiscount: (index) => {
        set((state) => {
          const discounts = state.draft.discounts.filter((_, i) => i !== index);
          const newDraft = { ...state.draft, discounts };
          return { draft: { ...newDraft, ...computeTotalsFromDraft(newDraft) } };
        });
      },

      addFinancing: (entry) => {
        set((state) => {
          const newDraft = { ...state.draft, financing: [...state.draft.financing, entry] };
          return { draft: { ...newDraft, ...computeTotalsFromDraft(newDraft) } };
        });
      },

      removeFinancing: (index) => {
        set((state) => {
          const financing = state.draft.financing.filter((_, i) => i !== index);
          const newDraft = { ...state.draft, financing };
          return { draft: { ...newDraft, ...computeTotalsFromDraft(newDraft) } };
        });
      },

      setTax: (tax_amount, tax_rate, audit) => {
        set((state) => {
          const newDraft = {
            ...state.draft,
            tax_amount,
            tax_rate,
            // Only overwrite the audit fields when a fresh lookup result was
            // provided. Re-renders that just recompute amounts (e.g. line-item
            // edits triggering /api/tax with no audit data attached) leave the
            // existing source/jurisdictions intact.
            ...(audit !== undefined
              ? {
                  tax_rate_source: audit.source,
                  tax_rate_effective_date: audit.effective_date,
                  tax_rate_jurisdictions: audit.jurisdictions,
                }
              : {}),
          };
          return { draft: { ...newDraft, ...computeTotalsFromDraft(newDraft) } };
        });
      },

      setTaxExempt: (tax_exempt) => {
        set((state) => {
          const newDraft = { ...state.draft, tax_exempt };
          return { draft: { ...newDraft, ...computeTotalsFromDraft(newDraft) } };
        });
      },

      setDocFeeWaived: (doc_fee_waived) => {
        set((state) => {
          const newDraft = { ...state.draft, doc_fee_waived };
          return { draft: { ...newDraft, ...computeTotalsFromDraft(newDraft) } };
        });
      },

      setSurcharge: (surcharge_enabled, surcharge_rate) => {
        set((state) => {
          const newDraft = { ...state.draft, surcharge_enabled, surcharge_rate };
          return { draft: { ...newDraft, ...computeTotalsFromDraft(newDraft) } };
        });
      },

      addDepositSplit: (split) =>
        set((state) => {
          const newDraft = {
            ...state.draft,
            deposit_splits: [...(Array.isArray(state.draft.deposit_splits) ? state.draft.deposit_splits : []), split],
          };
          return { draft: { ...newDraft, ...computeTotalsFromDraft(newDraft) } };
        }),

      removeDepositSplit: (index) =>
        set((state) => {
          const deposit_splits = (Array.isArray(state.draft.deposit_splits) ? state.draft.deposit_splits : []).filter((_, i) => i !== index);
          const newDraft = { ...state.draft, deposit_splits };
          return { draft: { ...newDraft, ...computeTotalsFromDraft(newDraft) } };
        }),

      setNotes: (notes) =>
        set((state) => ({ draft: { ...state.draft, notes } })),

      setExternalNotes: (external_notes) =>
        set((state) => ({ draft: { ...state.draft, external_notes } })),

      setMarketingFeedback: (marketing_feedback) =>
        set((state) => ({ draft: { ...state.draft, marketing_feedback } })),

      setNeedsPermit: (needs_permit) =>
        set((state) => ({ draft: { ...state.draft, needs_permit } })),

      setNeedsHoa: (needs_hoa) =>
        set((state) => ({ draft: { ...state.draft, needs_hoa } })),

      setPermitJurisdiction: (permit_jurisdiction) =>
        set((state) => ({ draft: { ...state.draft, permit_jurisdiction } })),

      setDeliveryDiagram: (delivery_diagram) =>
        set((state) => ({ draft: { ...state.draft, delivery_diagram } })),

      setDeliveryTimeframe: (delivery_timeframe) =>
        set((state) => ({ draft: { ...state.draft, delivery_timeframe } })),

      setCreatedContractId: (id) =>
        set((state) => ({ draft: { ...state.draft, created_contract_id: id } })),

      setIdempotencyKey: (key) =>
        set((state) => ({ draft: { ...state.draft, idempotency_key: key } })),

      setWizardStep: (wizard_step) =>
        set((state) => ({ draft: { ...state.draft, wizard_step } })),

      setSignatureDataUrl: (signature_data_url) =>
        set((state) => ({ draft: { ...state.draft, signature_data_url } })),

      setSignedName: (signed_name) =>
        set((state) => ({ draft: { ...state.draft, signed_name } })),

      setElectronicConsent: (electronic_consent) =>
        set((state) => ({ draft: { ...state.draft, electronic_consent } })),

      setInitialUrl: (key, url) =>
        set((state) => ({
          draft: {
            ...state.draft,
            initials_urls: {
              ...(state.draft.initials_urls ?? {}),
              [key]: url,
            },
          },
        })),

      setTaxExemptCert: (cert) =>
        set((state) => ({
          draft: {
            ...state.draft,
            tax_exempt_cert_data_url: cert?.dataUrl,
            tax_exempt_cert_filename: cert?.filename,
            tax_exempt_cert_mime: cert?.mime,
          },
        })),

      setRxFile: (rx) =>
        set((state) => {
          const next = {
            ...state.draft,
            rx_data_url: rx?.dataUrl,
            rx_filename: rx?.filename,
            rx_mime: rx?.mime,
          };
          // Staging an Rx flips the effective-exempt gate, so totals need to
          // re-compute immediately to reflect the now-zeroed items tax.
          return { draft: { ...next, ...computeTotalsFromDraft(next) } };
        }),

      setConcreteEstimatePending: (concrete_estimate_pending) =>
        set((state) => ({ draft: { ...state.draft, concrete_estimate_pending } })),

      setConcreteEstimateNotes: (concrete_estimate_notes) =>
        set((state) => ({ draft: { ...state.draft, concrete_estimate_notes } })),

      // Site-visit addon flow: rep opens the parent (spa) contract, taps
      // "Create Concrete Contract", lands here. Pre-fills customer + a single
      // editable Concrete Pad line item, and inherits the parent's show so
      // the contract history stays attributed to the original venue.
      prefillForConcreteAddon: (parentContract) => {
        set((state) => {
          const concreteLine = buildConcreteLineItem();
          const newDraft: ContractDraft = {
            ...state.draft,
            customer: parentContract.customer ?? state.draft.customer,
            show_id: parentContract.show_id ?? undefined,
            show: parentContract.show ?? undefined,
            location_id: parentContract.location_id ?? undefined,
            location: parentContract.location ?? undefined,
            line_items: [concreteLine],
            parent_contract_id: parentContract.id,
          };
          return { draft: { ...newDraft, ...computeTotalsFromDraft(newDraft) } };
        });
      },

      computeTotals: () =>
        set((state) => ({
          draft: { ...state.draft, ...computeTotalsFromDraft(state.draft) },
        })),

      resetDraft: () => set({ draft: initialDraft }),

      // True if the draft has any sales-rep work to lose: customer locked in,
      // any line items selected, deposit / financing started, or signing in
      // progress. Used by /contracts/new to decide whether to auto-resume vs
      // show a Resume / Start Over prompt instead of silently wiping work.
      hasDraftProgress: () => {
        const d = get().draft;
        return Boolean(
          d.customer ||
            (d.line_items && d.line_items.length > 0) ||
            (d.deposit_splits && d.deposit_splits.length > 0) ||
            (d.financing && d.financing.length > 0) ||
            d.signature_data_url ||
            d.signed_name
        );
      },
    }),
    {
      name: "atlas-contract-draft-v6",
      partialize: (state) => ({ draft: state.draft }),
      // Crushed granite used to auto-attach itself to every spa via
      // addLineItem / addLineItemWithUnit / addBlemLineWithoutUnit. Reps
      // asked for it to be opt-in (2026-05-23), but any draft persisted
      // before the change still carries those auto-added granite lines.
      // Strip them on rehydration so the picker starts clean — the rep
      // can still add granite explicitly from the options panel. Future
      // version bumps would extend this migration chain in place.
      version: 1,
      migrate: (persistedState, fromVersion) => {
        const s = persistedState as { draft?: { line_items?: Array<{ linked_spa_product_id?: string }> } };
        if (fromVersion < 1 && s?.draft?.line_items) {
          s.draft.line_items = s.draft.line_items.filter(
            (li) => !li.linked_spa_product_id
          );
        }
        return s;
      },
    }
  )
);
