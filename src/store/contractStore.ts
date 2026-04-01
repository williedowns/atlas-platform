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

  // Payment
  payment_method?: string;
  surcharge_enabled: boolean;
  surcharge_rate: number;

  // Tax (from Avalara)
  tax_amount: number;
  tax_rate: number;

  // Computed totals
  subtotal: number;
  discount_total: number;
  surcharge_amount: number;
  total: number;
  deposit_amount: number;

  // Notes
  notes?: string;
}

interface ContractStore {
  draft: ContractDraft;
  setShow: (show: Show, location: Location) => void;
  setCustomer: (customer: Customer) => void;
  addLineItem: (product: Product, price: number, waived?: boolean) => void;
  removeLineItem: (index: number) => void;
  updateLineItemSerial: (index: number, serial: string) => void;
  addDiscount: (discount: ContractDiscount) => void;
  removeDiscount: (index: number) => void;
  addFinancing: (entry: ContractFinancing) => void;
  removeFinancing: (index: number) => void;
  setTax: (taxAmount: number, taxRate: number) => void;
  setSurcharge: (enabled: boolean, rate: number) => void;
  setDepositAmount: (amount: number) => void;
  setPaymentMethod: (method: string) => void;
  setNotes: (notes: string) => void;
  computeTotals: () => void;
  resetDraft: () => void;
}

const initialDraft: ContractDraft = {
  line_items: [],
  discounts: [],
  financing: [],
  surcharge_enabled: false,
  surcharge_rate: 0.035,
  tax_amount: 0,
  tax_rate: 0,
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
  const total = Math.max(0, subtotal - discount_total + draft.tax_amount + surcharge_amount);
  const deposit_amount = draft.deposit_amount > 0
    ? draft.deposit_amount
    : Math.ceil(total * 0.3 * 100) / 100;

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
            show_id: show.id,
            show,
            location_id: location.id,
            location,
            surcharge_enabled: location.cc_surcharge_enabled,
            surcharge_rate: location.cc_surcharge_rate,
          },
        })),

      setCustomer: (customer) =>
        set((state) => ({ draft: { ...state.draft, customer } })),

      addLineItem: (product, price, waived = false) => {
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

      setSurcharge: (surcharge_enabled, surcharge_rate) => {
        set((state) => {
          const newDraft = { ...state.draft, surcharge_enabled, surcharge_rate };
          return { draft: { ...newDraft, ...computeTotalsFromDraft(newDraft) } };
        });
      },

      setDepositAmount: (deposit_amount) =>
        set((state) => ({ draft: { ...state.draft, deposit_amount } })),

      setPaymentMethod: (payment_method) =>
        set((state) => ({ draft: { ...state.draft, payment_method } })),

      setNotes: (notes) =>
        set((state) => ({ draft: { ...state.draft, notes } })),

      computeTotals: () =>
        set((state) => ({
          draft: { ...state.draft, ...computeTotalsFromDraft(state.draft) },
        })),

      resetDraft: () => set({ draft: initialDraft }),
    }),
    {
      name: "atlas-contract-draft-v2",
      partialize: (state) => ({ draft: state.draft }),
    }
  )
);
