import {
  INVOICES,
  financeStats,
  topOverdueDealers,
  recentPayments,
  COOP_ACCRUALS,
  COOP_CLAIMS,
  DEALERS,
  type InvoiceStatus,
} from "@/lib/manufacturer/mock-data";
import FinanceClient from "./FinanceClient";

export default async function FinancePage() {
  const stats = financeStats();
  const overdueRaw = topOverdueDealers(10);
  const payments = recentPayments(15);

  const overdueDealers = overdueRaw.map((x) => ({
    dealer: {
      id: x.dealer.id,
      name: x.dealer.name,
      city: x.dealer.city,
      state: x.dealer.state,
      tier: x.dealer.tier,
    },
    openInvoices: x.openInvoices,
    overdueInvoices: x.overdueInvoices,
    balance: x.balance,
    oldestOverdueDays: x.oldestOverdueDays,
  }));

  const statusCounts: Record<InvoiceStatus, number> = {
    open: 0, partial: 0, paid: 0, overdue: 0, written_off: 0,
  };
  for (const inv of INVOICES) statusCounts[inv.status]++;

  return (
    <FinanceClient
      invoices={INVOICES}
      stats={stats}
      overdueDealers={overdueDealers}
      payments={payments}
      coopAccruals={COOP_ACCRUALS}
      coopClaims={COOP_CLAIMS}
      statusCounts={statusCounts}
    />
  );
}
