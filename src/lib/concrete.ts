// ── Concrete Pad — addon contract site-prep line ─────────────────────────────
// Unlike Crushed Granite (auto-attached to every spa at the show), a Concrete
// Pad is only added via the post-show "Create Concrete Contract" addon flow.
// The salesperson does a site visit at the customer's house, opens the
// original contract, taps "Create Concrete Contract", and lands in the new
// contract wizard with the customer pre-filled and a single Concrete Pad
// line item ready for them to enter quantity + price.
//
// Concrete is NOT auto-added by addLineItem and is NOT in PRODUCT_LINES — the
// only path is the URL-param-driven prefill on /contracts/new.

import type { ContractLineItem } from "@/types";

export const CONCRETE_PRODUCT_ID = "b8e14da1-5084-43cd-9383-0d14ca92a33e";

export const CONCRETE_QBO_ITEM_ID = "270";

export function buildConcreteLineItem(): ContractLineItem {
  return {
    product_id: CONCRETE_PRODUCT_ID,
    product_name: "Concrete Pad",
    msrp: 0,
    sell_price: 0,
    quantity: 1,
  };
}
