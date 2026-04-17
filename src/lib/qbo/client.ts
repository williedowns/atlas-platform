// QuickBooks Online REST API Client
// Docs: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities

const QBO_BASE_URL = "https://quickbooks.api.intuit.com/v3/company";
const SANDBOX_BASE_URL = "https://sandbox-quickbooks.api.intuit.com/v3/company";

function getBaseUrl() {
  return process.env.QBO_SANDBOX === "true" ? SANDBOX_BASE_URL : QBO_BASE_URL;
}

export async function getQBOAccessToken(): Promise<string> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("qbo_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("id", 1)
    .single();

  if (!row) throw new Error("QuickBooks is not connected. Go to Admin to connect QuickBooks.");

  // Refresh if expired (with 5-minute buffer)
  const expiresAt = new Date(row.expires_at).getTime();
  if (Date.now() > expiresAt - 5 * 60 * 1000) {
    const refreshed = await refreshQBOToken(row.refresh_token);
    if (!refreshed.access_token) throw new Error("QBO token refresh failed — reconnect QuickBooks in Admin.");

    await supabase.from("qbo_tokens").update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? row.refresh_token,
      expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", 1);

    return refreshed.access_token;
  }

  return row.access_token;
}

export async function getQBORealmId(): Promise<string> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: row } = await supabase.from("qbo_tokens").select("realm_id").eq("id", 1).single();
  if (!row?.realm_id) throw new Error("QuickBooks not connected");
  return row.realm_id;
}

async function qboFetch(path: string, options: RequestInit = {}) {
  const token = await getQBOAccessToken();
  const realmId = await getQBORealmId();
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
  // Fetch all active items regardless of type (Inventory, NonInventory, Service)
  const data = await qboFetch(
    "/query?query=select%20*%20from%20Item%20where%20Active%20%3D%20true%20MAXRESULTS%20500"
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

// ─── Deposits (SalesReceipt → Income or Liability Account) ─────────────────
// SalesReceipt is the correct QBO entity for received cash.
//
// CONFIG FLAG: env var QBO_DEPOSIT_MODE controls where deposits post.
//   "income"    (DEFAULT) — deposits post to an Income account via the income item.
//                            Matches Lori's current workflow. SAFE for Atlas go-live.
//   "liability" — deposits post to Customer Deposits liability via the liability item.
//                 Target accrual workflow; requires Ian/Lori sign-off before enabling.
//
// Item resolution priority (highest to lowest):
//   1. Per-location/per-show item ID passed in params (qbo_deposit_income_item_id
//      or qbo_deposit_liability_item_id depending on mode)
//   2. Global env var (QBO_DEPOSIT_INCOME_ITEM_ID or QBO_DEPOSIT_LIABILITY_ITEM_ID)
//   3. Legacy env var QBO_DEPOSIT_ITEM_ID (backwards compat)

export type QBODepositMode = "income" | "liability";

export function getQBODepositMode(): QBODepositMode {
  const raw = (process.env.QBO_DEPOSIT_MODE ?? "").toLowerCase().trim();
  return raw === "liability" ? "liability" : "income";
}

export async function createQBODeposit(params: {
  qbo_customer_id: string;
  deposit_amount: number;
  contract_number: string;
  customer_name?: string;
  location_name?: string;
  line_items_summary?: string;
  class_id?: string;
  department_id?: string;
  deposit_account_id?: string;
  // Per-location/per-show item overrides — selected by QBO_DEPOSIT_MODE
  qbo_deposit_income_item_id?: string;
  qbo_deposit_liability_item_id?: string;
}) {
  const mode = getQBODepositMode();

  const depositItemId =
    mode === "income"
      ? (params.qbo_deposit_income_item_id
          ?? process.env.QBO_DEPOSIT_INCOME_ITEM_ID
          ?? process.env.QBO_DEPOSIT_ITEM_ID)
      : (params.qbo_deposit_liability_item_id
          ?? process.env.QBO_DEPOSIT_LIABILITY_ITEM_ID
          ?? process.env.QBO_DEPOSIT_ITEM_ID);

  if (!depositItemId) {
    throw new Error(
      `QBO deposit item not configured for mode="${mode}". ` +
      `Set ${mode === "income" ? "QBO_DEPOSIT_INCOME_ITEM_ID" : "QBO_DEPOSIT_LIABILITY_ITEM_ID"} ` +
      `env var or add the item ID to the location/show record.`
    );
  }

  const depositAccountId =
    params.deposit_account_id ?? process.env.QBO_CUSTOMER_DEPOSITS_ACCOUNT_ID;

  return qboFetch("/salesreceipt", {
    method: "POST",
    body: JSON.stringify({
      DocNumber: `DEP-${params.contract_number}`,
      CustomerRef: { value: params.qbo_customer_id },
      CustomerMemo: {
        value: [
          `Deposit — Contract ${params.contract_number}`,
          params.customer_name,
          params.location_name,
          params.line_items_summary,
        ].filter(Boolean).join(" — ").slice(0, 1000),
      },
      Line: [
        {
          Amount: params.deposit_amount,
          DetailType: "SalesItemLineDetail",
          SalesItemLineDetail: {
            ItemRef: { value: depositItemId },
            UnitPrice: params.deposit_amount,
            Qty: 1,
          },
        },
      ],
      DepositToAccountRef: depositAccountId ? { value: depositAccountId } : undefined,
      DepartmentRef: params.department_id ? { value: params.department_id } : undefined,
      ClassRef: params.class_id ? { value: params.class_id } : undefined,
    }),
  });
}

// Backwards-compatible alias — existing callers use this name
export const createQBODepositInvoice = createQBODeposit;

// ─── Final Invoice (Revenue Recognition at Delivery) ────────────────────────

export async function createQBOFinalInvoice(params: {
  qbo_customer_id: string;
  contract_number: string;
  line_items: { qbo_item_id?: string; description: string; qty: number; unit_price: number }[];
  discounts: { description: string; amount: number }[];
  tax_amount: number;
  customer_name?: string;
  location_name?: string;
  department_id?: string;
  deposit_account_id?: string;
}) {
  const lines: any[] = [];

  // Product line items — use QBO Item ID if available, otherwise generic service item
  const fallbackItemId = process.env.QBO_DEFAULT_SALES_ITEM_ID;
  params.line_items.forEach((item, i) => {
    const itemRef = item.qbo_item_id || fallbackItemId;
    if (!itemRef) return; // skip if no item mapping available
    lines.push({
      LineNum: i + 1,
      Amount: item.unit_price * item.qty,
      Description: item.description,
      DetailType: "SalesItemLineDetail",
      SalesItemLineDetail: {
        ItemRef: { value: itemRef },
        Qty: item.qty,
        UnitPrice: item.unit_price,
      },
    });
  });

  // Discount line items
  params.discounts.forEach((d, i) => {
    lines.push({
      LineNum: lines.length + 1,
      Amount: Math.abs(d.amount),
      Description: d.description,
      DetailType: "DiscountLineDetail",
      DiscountLineDetail: {
        PercentBased: false,
        DiscountPercent: 0,
      },
    });
  });

  const invoiceBody: any = {
    DocNumber: params.contract_number,
    CustomerRef: { value: params.qbo_customer_id },
    CustomerMemo: {
      value: [
        `Final Invoice — Contract ${params.contract_number}`,
        params.customer_name,
        params.location_name,
        `Delivered ${new Date().toLocaleDateString("en-US")}`,
      ].filter(Boolean).join(" — ").slice(0, 1000),
    },
    TxnDate: new Date().toISOString().slice(0, 10),
    Line: lines,
  };

  // Add tax if present
  if (params.tax_amount > 0) {
    invoiceBody.TxnTaxDetail = { TotalTax: params.tax_amount };
  }

  if (params.department_id) {
    invoiceBody.DepartmentRef = { value: params.department_id };
  }

  return qboFetch("/invoice", {
    method: "POST",
    body: JSON.stringify(invoiceBody),
  });
}

// ─── Apply Deposits as Payment Against Invoice ──────────────────────────────

export async function applyDepositsToInvoice(params: {
  qbo_customer_id: string;
  invoice_id: string;
  deposit_amount: number;
  deposit_account_id?: string;
}) {
  const paymentBody: any = {
    CustomerRef: { value: params.qbo_customer_id },
    TotalAmt: params.deposit_amount,
    Line: [
      {
        Amount: params.deposit_amount,
        LinkedTxn: [
          {
            TxnId: params.invoice_id,
            TxnType: "Invoice",
          },
        ],
      },
    ],
  };

  if (params.deposit_account_id) {
    paymentBody.DepositToAccountRef = { value: params.deposit_account_id };
  }

  return qboFetch("/payment", {
    method: "POST",
    body: JSON.stringify(paymentBody),
  });
}

// ─── Accounts Query ─────────────────────────────────────────────────────────

export async function queryQBOAccounts(type?: string) {
  const query = type
    ? `select * from Account where AccountType = '${type}' and Active = true MAXRESULTS 200`
    : `select * from Account where Active = true MAXRESULTS 200`;
  const data = await qboFetch(`/query?query=${encodeURIComponent(query)}`);
  return data.QueryResponse?.Account ?? [];
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
