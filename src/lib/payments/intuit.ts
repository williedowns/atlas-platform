// Intuit Payments API Client
// Docs: https://developer.intuit.com/app/developer/qbpayments/docs/api/resources/all-entities/charges

const PAYMENTS_BASE_URL = "https://api.intuit.com/quickbooks/v4/payments";
const PAYMENTS_SANDBOX_URL = "https://sandbox.api.intuit.com/quickbooks/v4/payments";

function getBaseUrl() {
  return process.env.QBO_SANDBOX === "true" ? PAYMENTS_SANDBOX_URL : PAYMENTS_BASE_URL;
}

async function paymentsFetch(path: string, options: RequestInit = {}) {
  // Intuit Payments uses the same OAuth token as QBO
  const token = process.env.QBO_ACCESS_TOKEN;
  if (!token) throw new Error("QBO_ACCESS_TOKEN not configured");

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

// Charge a card (card-present or card-not-present)
export async function createCharge(params: ChargeParams): Promise<ChargeResult> {
  const body: Record<string, unknown> = {
    amount: params.amount.toFixed(2),
    currency: params.currency ?? "USD",
    capture: params.capture ?? true,
    description: params.description,
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
