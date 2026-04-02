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

  // Tax (from Avalara)
  tax_amount: number;
  tax_rate: number;
  /** Customer has a Texas tax exemption certificate on file */
  tax_exempt: boolean;

  // Computed totals
  subtotal: number;
  discount_total: number;
  surcharge_amount: number;
  total: number;
  deposit_amount: number; // sum of all deposit_splits amounts

  // Notes
  notes?: string;
}

export interface DepositSplit {
  amount: number;
  method: string;
  check_number?: string;
  bank_name?: string;
}

interface InventoryUnitDetails {
  id: string;
  serial_number?: string | null;
  unit_type?: string | null;
  shell_color?: string | null;
  cabinet_color?: string | null;
}

interface ContractStore {
  draft: ContractDraft;
  setShow: (show: Show, location: Location | null) => void;
  setCustomer: (customer: Customer) => void;
  addLineItem: (product: Product, price: number, waived?: boolean, shell_color?: string, cabinet_color?: string) => void;
  addLineItemWithUnit: (product: Product, price: number, unit: InventoryUnitDetails) => void;
  removeLineItem: (index: number) => void;
  updateLineItemSerial: (index: number, serial: string) => void;
  updateLineItemPrice: (index: number, price: number) => void;
  updateLineItemColors: (index: number, shell_color: string | undefined, cabinet_color: string | undefined) => void;
  addDiscount: (discount: ContractDiscount) => void;
  removeDiscount: (index: number) => void;
  addFinancing: (entry: ContractFinancing) => void;
  removeFinancing: (index: number) => void;
  setTax: (taxAmount: number, taxRate: number) => void;
  setTaxExempt: (exempt: boolean) => void;
  setSurcharge: (enabled: boolean, rate: number) => void;
  addDepositSplit: (split: DepositSplit) => void;
  removeDepositSplit: (index: number) => void;
  setNotes: (notes: string) => void;
  computeTotals: () => void;
  resetDraft: () => void;
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
  subtotal: 0,
  discount_total: 0,
  surcharge_amount: 0,
  total: 0,
  deposit_amount: 0,
};

function computeTotalsFromDraft(draft: ContractDraft): Partial<ContractDraft> {
  const subtotal = draft.line_items.reduce(
    (sum, item) => sum + item.sell_price * item.quantity,
    0
  );
  const discount_total = draft.discounts.reduce((sum, d) => sum + d.amount, 0);
  const financingArr = Array.isArray(draft.financing) ? draft.financing : [];
  const financed = financingArr.reduce((sum, f) => sum + (f.financed_amount ?? 0), 0);
  const taxable = Math.max(0, subtotal - discount_total - financed);
  const surcharge_amount = draft.surcharge_enabled
    ? Math.round(subtotal * draft.surcharge_rate * 100) / 100
    : 0;
  // Tax exempt zeroes out tax for this sale
  const effectiveTax = draft.tax_exempt ? 0 : (draft.tax_amount ?? 0);
  const total = Math.max(0, subtotal - discount_total + effectiveTax + surcharge_amount);
  const splitsArr = Array.isArray(draft.deposit_splits) ? draft.deposit_splits : [];
  const deposit_amount = splitsArr.reduce((sum, s) => sum + s.amount, 0);

  return { subtotal, discount_total, surcharge_amount, total, deposit_amount };
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
        set((state) => ({ draft: { ...state.draft, customer } })),

      addLineItem: (product, price, waived = false, shell_color?, cabinet_color?) => {
        set((state) => {
          const newDraft = {
            ...state.draft,
            line_items: [
              ...state.draft.line_items,
              {
                product_id: product.id,
                product_name: product.name,
                msrp: product.msrp,
                sell_price: waived ? 0 : price,
                quantity: 1,
                ...(waived ? { waived: true } : {}),
                ...(shell_color ? { shell_color } : {}),
                ...(cabinet_color ? { cabinet_color } : {}),
              },
            ],
          };
          return { draft: { ...newDraft, ...computeTotalsFromDraft(newDraft) } };
        });
      },

      addLineItemWithUnit: (product, price, unit) => {
        set((state) => {
          const newDraft = {
            ...state.draft,
            line_items: [
              ...state.draft.line_items,
              {
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
              },
            ],
          };
          return { draft: { ...newDraft, ...computeTotalsFromDraft(newDraft) } };
        });
      },

      removeLineItem: (index) => {
        set((state) => {
          const line_items = state.draft.line_items.filter((_, i) => i !== index);
          const newDraft = { ...state.draft, line_items };
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

      setTax: (tax_amount, tax_rate) => {
        set((state) => {
          const newDraft = { ...state.draft, tax_amount, tax_rate };
          return { draft: { ...newDraft, ...computeTotalsFromDraft(newDraft) } };
        });
      },

      setTaxExempt: (tax_exempt) => {
        set((state) => {
          const newDraft = { ...state.draft, tax_exempt };
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

      computeTotals: () =>
        set((state) => ({
          draft: { ...state.draft, ...computeTotalsFromDraft(state.draft) },
        })),

      resetDraft: () => set({ draft: initialDraft }),
    }),
    {
      name: "atlas-contract-draft-v4",
      partialize: (state) => ({ draft: state.draft }),
    }
  )
);
