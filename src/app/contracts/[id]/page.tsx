export const dynamic = "force-dynamic";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ContingentToggle } from "@/components/contracts/ContingentToggle";
import { CancelContractButton } from "@/components/contracts/CancelContractButton";
import { TaxRefundButton } from "@/components/contracts/TaxRefundButton";

const STATUS_COLORS: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  draft: "secondary",
  pending_signature: "warning",
  signed: "default",
  deposit_collected: "success",
  in_production: "default",
  ready_for_delivery: "warning",
  delivered: "success",
  cancelled: "destructive",
};

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: contract } = await supabase
    .from("contracts")
    .select(`
      *,
      customer:customers(*),
      show:shows(name, venue_name),
      location:locations(name),
      sales_rep:profiles(full_name)
    `)
    .eq("id", id)
    .single();

  if (!contract) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const canViewAudit = ["admin", "manager", "bookkeeper"].includes(profile?.role ?? "");
  const canRecordRefund = ["admin", "manager", "bookkeeper"].includes(profile?.role ?? "");

  const { data: payments } = await supabase
    .from("payments")
    .select("*")
    .eq("contract_id", id)
    .order("created_at");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let auditLogs: any[] = [];
  if (canViewAudit) {
    const { data } = await supabase
      .from("audit_logs")
      .select("action, metadata, ip_address, created_at, user:profiles(full_name)")
      .eq("entity_type", "contract")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(10);
    auditLogs = data ?? [];
  }

  const lineItems = Array.isArray(contract.line_items) ? contract.line_items : [];
  const discounts = Array.isArray(contract.discounts) ? contract.discounts : [];
  const financing = contract.financing ?? {};

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <Link href="/contracts" className="p-2 rounded-lg hover:bg-white/10">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold">{contract.contract_number}</h1>
            <p className="text-[#00929C] text-xs">{formatDate(contract.created_at)}</p>
          </div>
          {contract.is_contingent && (
            <Badge variant="warning" className="text-xs">Contingent</Badge>
          )}
          <Badge variant={STATUS_COLORS[contract.status] ?? "secondary"} className="text-xs">
            {contract.status.replace(/_/g, " ")}
          </Badge>
          <a
            href={`/api/contracts/${contract.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Print / PDF"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
          </a>
        </div>
      </header>

      <main className="px-5 py-6 space-y-4 max-w-2xl mx-auto pb-24">
        {/* Customer */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-lg font-semibold">
              {contract.customer?.first_name} {contract.customer?.last_name}
            </p>
            <p className="text-slate-600">{contract.customer?.email}</p>
            <p className="text-slate-600">{contract.customer?.phone}</p>
            {contract.customer?.address && (
              <p className="text-slate-500 text-sm">
                {contract.customer.address}, {contract.customer.city}, {contract.customer.state} {contract.customer.zip}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Context */}
        <Card>
          <CardContent className="p-4 flex justify-between text-sm">
            <div>
              <p className="text-slate-500">Location / Show</p>
              <p className="font-medium">{contract.show?.name ?? contract.location?.name}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-500">Sales Rep</p>
              <p className="font-medium">{(contract.sales_rep as { full_name?: string } | null)?.full_name ?? "—"}</p>
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Products</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-2 text-slate-500 font-medium">Product</th>
                  <th className="text-right px-4 py-2 text-slate-500 font-medium">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {lineItems.map((item: { product_name: string; serial_number?: string; sell_price: number; quantity: number }, i: number) => (
                  <tr key={i}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{item.product_name}</p>
                      {item.serial_number && (
                        <p className="text-xs text-slate-400">SN: {item.serial_number}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(item.sell_price * item.quantity)}
                    </td>
                  </tr>
                ))}
                {discounts.map((d: { label: string; amount: number }, i: number) => (
                  <tr key={`d-${i}`} className="text-emerald-700">
                    <td className="px-4 py-2 text-sm">{d.label}</td>
                    <td className="px-4 py-2 text-right text-sm">−{formatCurrency(d.amount)}</td>
                  </tr>
                ))}
                {financing?.financed_amount > 0 && (
                  <tr className="text-blue-700">
                    <td className="px-4 py-2 text-sm">
                      Financing ({financing.financer_name ?? "In-House"})
                    </td>
                    <td className="px-4 py-2 text-right text-sm">
                      −{formatCurrency(financing.financed_amount)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Financial Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Financial Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>{formatCurrency(contract.subtotal)}</span>
              </div>
              {contract.discount_total > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discounts</span>
                  <span>−{formatCurrency(contract.discount_total)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Tax ({((contract.tax_rate ?? 0) * 100).toFixed(2)}%)</span>
                <span>{formatCurrency(contract.tax_amount)}</span>
              </div>
              {contract.surcharge_amount > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>CC Surcharge</span>
                  <span>{formatCurrency(contract.surcharge_amount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-2 border-t border-slate-200 text-slate-900">
                <span>Total</span>
                <span>{formatCurrency(contract.total)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 pt-1">
                <span>Deposit Paid</span>
                <span>−{formatCurrency(contract.deposit_paid)}</span>
              </div>
              <div className="flex justify-between font-semibold text-amber-700 pt-1 border-t border-slate-100">
                <span>Balance Due at Delivery</span>
                <span>{formatCurrency(contract.balance_due)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payments */}
        {payments && payments.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Payments</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <li key={p.id} className="px-4 py-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium capitalize">{p.method?.replace(/_/g, " ")}</p>
                      <p className="text-xs text-slate-400">{p.processed_at ? formatDate(p.processed_at) : "Pending"}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(p.amount)}</p>
                      <Badge variant={p.status === "completed" ? "success" : "warning"} className="text-xs">
                        {p.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* QBO Sync */}
        {contract.qbo_estimate_id && (
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-slate-700">QuickBooks Sync</p>
              <p className="text-xs text-slate-500 mt-1">Estimate: {contract.qbo_estimate_id}</p>
              {contract.qbo_deposit_invoice_id && (
                <p className="text-xs text-slate-500">Deposit Invoice: {contract.qbo_deposit_invoice_id}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="space-y-3 pt-2">
          {(contract.deposit_paid ?? 0) < contract.total && !["cancelled", "delivered"].includes(contract.status) && (
            <Link href={`/contracts/${id}/collect-payment`} className="block">
              <Button variant="success" size="xl" className="w-full">
                {(contract.deposit_paid ?? 0) > 0 ? "Add Payment" : "Collect Deposit"}
              </Button>
            </Link>
          )}
          <Link href={`/api/contracts/${id}/pdf`} target="_blank" className="block">
            <Button variant="outline" size="lg" className="w-full">
              Download PDF
            </Button>
          </Link>
          {!["quote", "draft", "cancelled"].includes(contract.status) && (
            <ContingentToggle
              contractId={contract.id}
              isContingent={contract.is_contingent ?? false}
            />
          )}
          {!["cancelled", "delivered"].includes(contract.status) && (
            <CancelContractButton
              contractId={contract.id}
              contractNumber={contract.contract_number}
              depositPaid={contract.deposit_paid ?? 0}
            />
          )}
          {canRecordRefund && "tax_refund_amount" in contract && (contract.tax_amount > 0 || contract.tax_refund_amount != null) && (
            <TaxRefundButton
              contractId={contract.id}
              taxAmount={contract.tax_amount ?? 0}
              existingRefund={
                contract.tax_refund_amount != null
                  ? {
                      amount: contract.tax_refund_amount,
                      issued_at: contract.tax_refund_issued_at,
                      notes: contract.tax_refund_notes ?? null,
                    }
                  : null
              }
            />
          )}
          <Link href={`/portal/contract/${id}`} target="_blank" className="block">
            <Button variant="outline" size="lg" className="w-full flex items-center justify-center gap-2 text-[#00929C] border-[#00929C]/30 hover:bg-[#00929C]/5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Preview Customer Portal
            </Button>
          </Link>
        </div>

        {/* Audit Trail (admin/manager/bookkeeper only) */}
        {canViewAudit && auditLogs.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Audit Trail</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-slate-100">
                {auditLogs.map((log, i) => (
                  <li key={i} className="px-4 py-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {log.action.replace(/\./g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                        </p>
                        <p className="text-xs text-slate-500">
                          {(Array.isArray(log.user) ? log.user[0]?.full_name : log.user?.full_name) ?? "System"}
                          {log.ip_address ? ` from ${log.ip_address}` : ""}
                        </p>
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <p className="text-xs text-slate-400 mt-1">
                            {Object.entries(log.metadata)
                              .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
                              .join(" | ")}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 whitespace-nowrap ml-2">
                        {formatDate(log.created_at)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
