"use client";

interface Row {
  contract_number: string;
  date: string;
  sales_rep: string;
  location_name: string;
  location_state: string;
  show_name: string;
  customer_name: string;
  customer_state: string;
  sale_total: number;
  sale_subtotal: number;
  discount_total: number;
  tax_rate: number;
  items_tax: number;
  doc_fee_amount: number;
  doc_fee_tax: number;
  total_tax_collected: number;
  tax_status: string;
  cert_received: string;
  cert_received_at: string;
  refund_amount: number;
  refund_issued_at: string;
}

// Headers ordered to align with TX Comptroller Form 01-114 line items so the
// bookkeeper can copy/paste columns into the filing without re-sorting.
const HEADERS: { label: string; key: keyof Row; format?: "money" | "rate" }[] = [
  { label: "Contract #", key: "contract_number" },
  { label: "Date", key: "date" },
  { label: "Sales Rep", key: "sales_rep" },
  { label: "Location", key: "location_name" },
  { label: "Location State", key: "location_state" },
  { label: "Show", key: "show_name" },
  { label: "Customer", key: "customer_name" },
  { label: "Customer State", key: "customer_state" },
  { label: "Sale Subtotal", key: "sale_subtotal", format: "money" },
  { label: "Discounts", key: "discount_total", format: "money" },
  { label: "Tax Rate", key: "tax_rate", format: "rate" },
  { label: "Items Tax (Refundable)", key: "items_tax", format: "money" },
  { label: "Doc Fee", key: "doc_fee_amount", format: "money" },
  { label: "Doc Fee Tax (Non-Refundable)", key: "doc_fee_tax", format: "money" },
  { label: "Total Tax Collected", key: "total_tax_collected", format: "money" },
  { label: "Sale Total", key: "sale_total", format: "money" },
  { label: "Tax Status", key: "tax_status" },
  { label: "Cert Received", key: "cert_received" },
  { label: "Cert Received Date", key: "cert_received_at" },
  { label: "Refund Amount", key: "refund_amount", format: "money" },
  { label: "Refund Issued Date", key: "refund_issued_at" },
];

function escapeCsv(v: unknown): string {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

export function TaxReportCsvExport({
  rows,
  from,
  to,
}: {
  rows: Row[];
  from: string;
  to: string;
}) {
  function exportCsv() {
    const lines = [HEADERS.map((h) => h.label).map(escapeCsv).join(",")];
    for (const r of rows) {
      const cells = HEADERS.map((h) => {
        const raw = r[h.key];
        if (h.format === "money") return Number(raw ?? 0).toFixed(2);
        if (h.format === "rate") return Number(raw ?? 0).toFixed(4);
        return raw ?? "";
      }).map(escapeCsv);
      lines.push(cells.join(","));
    }
    // Aggregate footer for quick visual check / paste-into-filing
    const sumKeys: (keyof Row)[] = [
      "sale_subtotal",
      "discount_total",
      "items_tax",
      "doc_fee_amount",
      "doc_fee_tax",
      "total_tax_collected",
      "sale_total",
      "refund_amount",
    ];
    const totals: Partial<Record<keyof Row, number>> = {};
    for (const k of sumKeys) {
      totals[k] = rows.reduce((s, r) => s + Number(r[k] ?? 0), 0);
    }
    const totalsRow = HEADERS.map((h) => {
      if (h.key === "contract_number") return "TOTALS";
      if (h.format === "money" && sumKeys.includes(h.key)) return Number(totals[h.key] ?? 0).toFixed(2);
      return "";
    }).map(escapeCsv);
    lines.push(totalsRow.join(","));

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tax-report_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={exportCsv}
        disabled={rows.length === 0}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
        </svg>
        Export CSV ({rows.length})
      </button>
    </div>
  );
}
