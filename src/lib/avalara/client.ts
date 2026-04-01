// Avalara AvaTax REST API Client
// Docs: https://developer.avalara.com/api-reference/avatax/rest/v2/

const AVALARA_BASE_URL = "https://rest.avatax.com/api/v2";
const AVALARA_SANDBOX_URL = "https://sandbox-rest.avatax.com/api/v2";

function getBaseUrl() {
  return process.env.AVALARA_SANDBOX === "true" ? AVALARA_SANDBOX_URL : AVALARA_BASE_URL;
}

function getAuthHeader() {
  const credentials = Buffer.from(
    `${process.env.AVALARA_ACCOUNT_ID}:${process.env.AVALARA_LICENSE_KEY}`
  ).toString("base64");
  return `Basic ${credentials}`;
}

async function avaTaxFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
      "X-Avalara-Client": "AtlasSpas;1.0.0;NextJS;1.0",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Avalara API error ${res.status}: ${error}`);
  }

  return res.json();
}

export interface TaxLine {
  number: string;
  amount: number;
  itemCode?: string;
  description?: string;
}

export interface TaxRequest {
  lines: TaxLine[];
  customerCode: string;
  date: string;
  // Ship-to address (the show venue or store)
  shipTo: {
    line1: string;
    city: string;
    region: string; // state abbreviation
    postalCode: string;
    country: string;
  };
  // Ship-from address (Atlas Spas warehouse/origin)
  shipFrom: {
    line1: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
  };
  type?: "SalesOrder" | "SalesInvoice"; // SalesOrder = estimate, SalesInvoice = commit
  commit?: boolean;
  companyCode?: string;
  purchaseOrderNo?: string;
}

export interface TaxResult {
  totalTax: number;
  totalTaxable: number;
  totalExempt: number;
  taxDate: string;
  lines: {
    lineNumber: string;
    tax: number;
    taxableAmount: number;
    rate: number;
    details: { taxName: string; rate: number; tax: number }[];
  }[];
}

// Calculate tax for a contract (non-committing)
export async function calculateTax(params: TaxRequest): Promise<TaxResult> {
  return avaTaxFetch("/transactions/create", {
    method: "POST",
    body: JSON.stringify({
      type: params.type ?? "SalesOrder",
      companyCode: params.companyCode ?? process.env.AVALARA_COMPANY_CODE,
      date: params.date,
      customerCode: params.customerCode,
      purchaseOrderNo: params.purchaseOrderNo,
      commit: params.commit ?? false,
      addresses: {
        shipFrom: {
          line1: params.shipFrom.line1,
          city: params.shipFrom.city,
          region: params.shipFrom.region,
          postalCode: params.shipFrom.postalCode,
          country: params.shipFrom.country ?? "US",
        },
        shipTo: {
          line1: params.shipTo.line1,
          city: params.shipTo.city,
          region: params.shipTo.region,
          postalCode: params.shipTo.postalCode,
          country: params.shipTo.country ?? "US",
        },
      },
      lines: params.lines.map((line) => ({
        number: line.number,
        amount: line.amount,
        itemCode: line.itemCode ?? "SPA",
        description: line.description ?? "Hot Tub",
        taxCode: "P0000000", // Tangible personal property
      })),
    }),
  });
}

// Commit tax transaction (call on deposit collection)
export async function commitTaxTransaction(transactionCode: string) {
  return avaTaxFetch(`/transactions/${transactionCode}/commit`, {
    method: "POST",
    body: JSON.stringify({ commit: true }),
  });
}

// Verify Avalara connection
export async function pingAvalara() {
  return avaTaxFetch("/utilities/ping");
}
