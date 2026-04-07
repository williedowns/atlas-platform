// Intuit Payments API Client
// Docs: https://developer.intuit.com/app/developer/qbpayments/docs/api/resources/all-entities/charges

const PAYMENTS_BASE_URL = "https://api.intuit.com/quickbooks/v4/payments";
const PAYMENTS_SANDBOX_URL = "https://sandbox.api.intuit.com/quickbooks/v4/payments";

function getBaseUrl() {
  return process.env.QBO_SANDBOX === "true" ? PAYMENTS_SANDBOX_URL : PAYMENTS_BASE_URL;
}

async function paymentsFetch(path: string, options: RequestInit = {}) {
  // Intuit Payments uses the same OAuth token as QBO accounting
  const { getQBOAccessToken } = await import("@/lib/qbo/client");
  const token = await getQBOAccessToken();

  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Request-Id": crypto.randomUUID(),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Intuit Payments error ${res.status}: ${error}`);
  }

  return res.json();
}

export interface ChargeParams {
  amount: number; // total including surcharge
  currency?: string;
  // Card token from client-side SDK (card reader or manual entry)
  card_token?: string;
  // Card present (reader)
  card_present_token?: string;
  description?: string;
  customerName?: string;  // shows in Intuit merchant portal transaction list
  capture?: boolean; // true = charge immediately
  context?: {
    mobile?: boolean;
    isEcommerce?: boolean;
  };
}

export interface ChargeResult {
  id: string;
  status: "CAPTURED" | "AUTHORIZED" | "DECLINED" | "VOIDED";
  amount: number;
  currency: string;
  created: string;
  authCode?: string;
  card?: {
    last4: string;
    brand: string;
    expMonth: number;
    expYear: number;
  };
}

// ── Tokenization ────────────────────────────────────────────────────────────

export interface TokenizeCardParams {
  number: string;   // raw PAN — stripped of spaces/dashes by caller
  expMonth: number;
  expYear: number;  // 4-digit
  cvc: string;
  name?: string;    // cardholder name — shows in Intuit merchant portal
  postalCode?: string;
}

export async function createToken(card: TokenizeCardParams): Promise<string> {
  const body = {
    card: {
      number: card.number,
      expMonth: String(card.expMonth).padStart(2, "0"),
      expYear: card.expYear,
      cvc: card.cvc,
      ...(card.name ? { name: card.name } : {}),
      ...(card.postalCode ? { address: { postalCode: card.postalCode } } : {}),
    },
  };
  const result = await paymentsFetch("/tokens", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!result.value) throw new Error("Intuit tokenization returned no token value");
  return result.value as string;
}

// ── eCheck (ACH) ─────────────────────────────────────────────────────────────

export interface ECheckParams {
  amount: number;
  routingNumber: string;
  accountNumber: string;
  accountType: "PERSONAL_CHECKING" | "PERSONAL_SAVINGS" | "BUSINESS_CHECKING";
  name: string;          // account holder name
  description?: string;
}

export interface ECheckResult {
  id: string;
  status: "PENDING" | "SUCCEEDED" | "DECLINED" | "VOIDED";
  amount: number;
  created: string;
}

export async function createECheck(params: ECheckParams): Promise<ECheckResult> {
  const body = {
    paymentMode: "WEB",
    amount: params.amount.toFixed(2),
    description: params.description,
    checkNumber: String(Math.floor(Math.random() * 9000) + 1000), // required placeholder
    bankAccountDetails: {
      bankAccountNumber: params.accountNumber,
      bankAccountType: params.accountType,
      routingNumber: params.routingNumber,
      name: params.name,
      phone: "5555555555", // placeholder — Intuit requires it
    },
  };
  return paymentsFetch("/echecks", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// Charge a card (card-present or card-not-present)
export async function createCharge(params: ChargeParams): Promise<ChargeResult> {
  const body: Record<string, unknown> = {
    amount: params.amount.toFixed(2),
    currency: params.currency ?? "USD",
    capture: params.capture ?? true,
    description: params.description,
    ...(params.customerName ? { customerName: params.customerName } : {}),
    context: {
      mobile: params.context?.mobile ?? true,
      isEcommerce: params.context?.isEcommerce ?? false,
    },
  };

  if (params.card_present_token) {
    body.card = { token: params.card_present_token };
  } else if (params.card_token) {
    body.token = params.card_token;
  }

  return paymentsFetch("/charges", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// Refund a charge
export async function refundCharge(chargeId: string, amount?: number) {
  return paymentsFetch(`/charges/${chargeId}/refunds`, {
    method: "POST",
    body: JSON.stringify(amount ? { amount: amount.toFixed(2) } : {}),
  });
}

// Get charge details
export async function getCharge(chargeId: string): Promise<ChargeResult> {
  return paymentsFetch(`/charges/${chargeId}`);
}

// Calculate surcharge
export function calculateSurcharge(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100;
}

// Total with surcharge
export function totalWithSurcharge(amount: number, rate: number): number {
  return Math.round((amount + calculateSurcharge(amount, rate)) * 100) / 100;
}
