// Zamp Sales Tax API Client
// Docs: https://developer.zamp.com/api

const ZAMP_BASE_URL = "https://api.zamp.com";

function getAuthHeader() {
  return `Bearer ${process.env.ZAMP_API_TOKEN}`;
}

async function zampFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${ZAMP_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Zamp API error ${res.status}: ${error}`);
  }

  return res.json();
}

export interface ZampAddress {
  line1: string;
  line2?: string | null;
  city: string;
  state: string;   // 2-letter abbreviation
  zip: string;
  country?: string; // defaults to "US"
}

export interface ZampLineItem {
  id: string;
  amount: number;
  quantity?: number;
  discount?: number;
  productName?: string;
  productSku?: string;
  // Hot tubs / spas = tangible personal property
  productTaxCode?: string;
}

export interface ZampTaxRequest {
  id: string;           // transaction/order ID
  transactedAt: string; // ISO 8601
  subtotal: number;
  total: number;
  discount?: number;
  shippingHandling?: number;
  isResale?: boolean;
  shipToAddress: ZampAddress;
  shipFromAddress: ZampAddress;
  lineItems: ZampLineItem[];
}

export interface ZampTaxResult {
  taxDue: number;
  taxes: {
    lineItemId: string;
    state: string;
    jurisdictionName: string;
    jurisdictionDivision: string;
    taxableAmount: number;
    nontaxableAmount: number;
    taxRate: number;
    taxDue: number;
  }[];
}

// Calculate tax (real-time, does NOT record for filing)
export async function calculateTax(params: ZampTaxRequest): Promise<ZampTaxResult> {
  return zampFetch("/calculations", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// Record a completed transaction (persists for state filing & remittance)
export async function recordTransaction(params: ZampTaxRequest): Promise<ZampTaxResult> {
  return zampFetch("/transactions", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// Record a refund transaction (negative amounts)
export async function recordRefund(params: {
  id: string;
  parentId: string;
  transactedAt: string;
  subtotal: number;     // negative
  total: number;        // negative
  shipToAddress: ZampAddress;
  lineItems: ZampLineItem[]; // positive amount, negative quantity
}): Promise<void> {
  await zampFetch("/transactions", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// Verify Zamp connection — runs a real $1 test calculation
export async function pingZamp(): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await calculateTax({
      id: `PING-${Date.now()}`,
      transactedAt: new Date().toISOString(),
      subtotal: 1,
      total: 1,
      shipToAddress: { line1: "120 SW 10th Ave", city: "Topeka", state: "KS", zip: "66612" },
      shipFromAddress: { line1: "123 Main St", city: "Wichita", state: "KS", zip: "67201" },
      lineItems: [{ id: "1", amount: 1, quantity: 1, productName: "Test Item", productTaxCode: "R_TPP" }],
    });
    return { ok: typeof result.taxDue === "number" };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
