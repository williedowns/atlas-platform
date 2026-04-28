"use client";

interface Row {
  contract_number: string;
  customerName: string;
  showName: string;
  rep: string;
  product: string;
  total: number;
  deposit_paid: number;
  balance_due: number;
  financer: string;
  financed_amount: number;
  stipsOk: boolean;
  dlOk: boolean;
  proofOk: boolean;
  achOk: boolean;
  lyonStageSummary: string;
  permitOk: boolean;
  hoaOk: boolean;
  createdAt: string;
  status: string;
}

export function ReconciliationCsvExport({ rows }: { rows: Row[] }) {
  function exportCsv() {
    const headers = [
      "Contract", "Customer", "Show/Location", "Rep", "Product",
      "Total", "Deposit Paid", "Balance Due", "Status",
      "Financier", "Financed", "Lyon Stages",
      "DL", "Proof of Ownership", "ACH", "Stipulations OK",
      "Permit OK", "HOA OK", "Date",
    ];
    const lines = [headers.join(",")];
    for (const r of rows) {
      const cells = [
        r.contract_number, r.customerName, r.showName, r.rep, r.product,
        r.total.toFixed(2), r.deposit_paid.toFixed(2), r.balance_due.toFixed(2), r.status,
        r.financer, r.financed_amount.toFixed(2), r.lyonStageSummary,
        r.dlOk ? "Y" : "N", r.proofOk ? "Y" : "N", r.achOk ? "Y" : "N", r.stipsOk ? "Y" : "N",
        r.permitOk ? "Y" : "N", r.hoaOk ? "Y" : "N", r.createdAt,
      ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`);
      lines.push(cells.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reconciliation-${new Date().toISOString().slice(0, 10)}.csv`;
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
