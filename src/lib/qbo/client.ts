// QuickBooks Online REST API Client
// Docs: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities

const QBO_BASE_URL = "https://quickbooks.api.intuit.com/v3/company";
const SANDBOX_BASE_URL = "https://sandbox-quickbooks.api.intuit.com/v3/company";

function getBaseUrl() {
  return process.env.QBO_SANDBOX === "true" ? SANDBOX_BASE_URL : QBO_BASE_URL;
}

export async function getQBOAccessToken(): Promise<string> {
  // Token is refreshed server-side and stored in DB/env
  // For now return from env; in production use token refresh flow
  const token = process.env.QBO_ACCESS_TOKEN;
  if (!token) throw new Error("QBO_ACCESS_TOKEN not configured");
  return token;
}

async function qboFetch(path: string, options: RequestInit = {}) {
  const token = await getQBOAccessToken();
  const realmId = process.env.QBO_REALM_ID;
  const baseUrl = getBaseUrl();

  const res = await fetch(`${baseUrl}/${realmId}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`QBO API error ${res.status}: ${error}`);
  }

  return res.json();
}

// ─── Items (Products) ────────────────────────────────────────────────────────

export async function syncProducts() {
  const data = await qboFetch(
    "/query?query=select%20*%20from%20Item%20where%20Type%20%3D%20%27Inventory%27%20MAXRESULTS%20200"
  );
  return data.QueryResponse?.Item ?? [];
}

export interface QBOItem {
  Id: string;
  Name: string;
  Sku?: string;
  Description?: string;
  UnitPrice: number;
  Active: boolean;
  Type: string;
}

// ─── Customers ───────────────────────────────────────────────────────────────

export async function createQBOCustomer(customer: {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}) {
  return qboFetch("/customer", {
    method: "POST",
    body: JSON.stringify({
      GivenName: customer.first_name,
      FamilyName: customer.last_name,
      PrimaryEmailAddr: { Address: customer.email },
      PrimaryPhone: { FreeFormNumber: customer.phone },
      BillAddr: {
        Line1: customer.address,
        City: customer.city,
        CountrySubDivisionCode: customer.state,
        PostalCode: customer.zip,
        Country: "US",
      },
    }),
  });
}

// ─── Estimates (Contracts) ───────────────────────────────────────────────────

export async function createQBOEstimate(params: {
  qbo_customer_id: string;
  line_items: { qbo_item_id: string; description: string; qty: number; unit_price: number }[];
  discounts: { description: string; amount: number }[];
  tax_amount: number;
  contract_number: string;
}) {
  const lines = [
    ...params.line_items.map((item, i) => ({
      LineNum: i + 1,
      Amount: item.unit_price * item.qty,
      DetailType: "SalesItemLineDetail",
      SalesItemLineDetail: {
        ItemRef: { value: item.qbo_item_id },
        Qty: item.qty,
        UnitPrice: item.unit_price,
      },
    })),
    ...params.discounts.map((d, i) => ({
      LineNum: params.line_items.length + i + 1,
      Amount: -Math.abs(d.amount),
      Description: d.description,
      DetailType: "SalesItemLineDetail",
      SalesItemLineDetail: {
        ItemRef: { value: "DISCOUNT" }, // Set up a Discount item in QBO
        UnitPrice: -Math.abs(d.amount),
        Qty: 1,
      },
    })),
  ];

  return qboFetch("/estimate", {
    method: "POST",
    body: JSON.stringify({
      DocNumber: params.contract_number,
      CustomerRef: { value: params.qbo_customer_id },
      Line: lines,
      TxnTax: {
        TotalTax: params.tax_amount,
      },
    }),
  });
}

// ─── Invoices (Deposits) ─────────────────────────────────────────────────────

export async function createQBODepositInvoice(params: {
  qbo_customer_id: string;
  deposit_amount: number;
  contract_number: string;
  class_id?: string; // For location tracking
}) {
  return qboFetch("/invoice", {
    method: "POST",
    body: JSON.stringify({
      DocNumber: `DEP-${params.contract_number}`,
      CustomerRef: { value: params.qbo_customer_id },
      Line: [
        {
          Amount: params.deposit_amount,
          DetailType: "SalesItemLineDetail",
          SalesItemLineDetail: {
            ItemRef: { value: process.env.QBO_DEPOSIT_ITEM_ID },
            UnitPrice: params.deposit_amount,
            Qty: 1,
          },
        },
      ],
      // Posts to Customer Deposits liability account
      DepositToAccountRef: {
        value: process.env.QBO_CUSTOMER_DEPOSITS_ACCOUNT_ID,
      },
      ClassRef: params.class_id ? { value: params.class_id } : undefined,
    }),
  });
}

// ─── OAuth Token Refresh ─────────────────────────────────────────────────────

export async function refreshQBOToken(refreshToken: string) {
  const credentials = Buffer.from(
    `${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  return res.json();
}
