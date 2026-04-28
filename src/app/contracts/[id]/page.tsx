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
import { CertViewButton } from "@/components/contracts/CertViewButton";
import { StatusTimeline } from "@/components/contracts/StatusTimeline";
import { DeliveryConfirmDialog } from "@/components/contracts/DeliveryConfirmDialog";
import CustomerFileVault from "@/components/contracts/CustomerFileVault";
import ContingencyTracker from "@/components/contracts/ContingencyTracker";
import ScheduleDeliveryButton from "@/components/contracts/ScheduleDeliveryButton";
import FinancingDetailsCard from "@/components/contracts/FinancingDetailsCard";
import { AppHeader } from "@/components/ui/AppHeader";
import { SectionCard } from "@/components/ui/SectionCard";

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

  // Fetch contract, profile, and payments in parallel — all three only need user.id
  const [
    { data: contract },
    { data: profile },
    { data: payments },
  ] = await Promise.all([
    supabase
      .from("contracts")
      .select(`
        *,
        customer:customers(*),
        show:shows(name, venue_name),
        location:locations(name),
        sales_rep:profiles(full_name)
      `)
      .eq("id", id)
      .single(),
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single(),
    supabase
      .from("payments")
      .select("*, intuit_charge_id, card_brand, card_last4")
      .eq("contract_id", id)
      .order("created_at"),
  ]);

  if (!contract) notFound();

  const canViewAudit = ["admin", "manager", "bookkeeper"].includes(profile?.role ?? "");
  const canRecordRefund = ["admin", "manager", "bookkeeper"].includes(profile?.role ?? "");

  // Find the first completed CC payment that can receive a refund
  const ccPayment = (payments ?? []).find(
    (p) => p.intuit_charge_id && p.card_brand && p.card_last4 && p.status === "completed"
  ) ?? null;

  // Load registered equipment for this contract (visible after delivery)
  const { data: contractEquipment } = await supabase
    .from("equipment")
    .select("id, product_name, serial_number, purchase_date, warranty_expires, notes")
    .eq("contract_id", id)
    .order("product_name");

  // Pull existing delivery work order (if scheduled)
  const { data: deliveryRow } = await supabase
    .from("delivery_work_orders")
    .select("id, scheduled_date, scheduled_window, delivery_address, special_instructions, status, readiness_overridden, readiness_override_reason")
    .eq("contract_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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
  const financingArr = Array.isArray(contract.financing) ? contract.financing : (contract.financing ? [contract.financing] : []);
  // Legacy single-object fallback kept for older contracts
  const financing = financingArr[0] ?? {};

  // deposit_amount = what was agreed in the contract wizard (used for balance_due calc)
  // deposit_paid   = what has actually been collected so far
  const depositAmount = contract.deposit_amount ?? 0;
  const depositPaid = contract.deposit_paid ?? 0;
  const totalFinanced = financingArr.reduce((sum: number, f: { financed_amount?: number }) => sum + (f.financed_amount ?? 0), 0);
  // Always derive balance due from real numbers so it's never stale
  const computedBalanceDue = Math.max(0, (contract.total ?? 0) - totalFinanced - depositPaid);

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        title={contract.contract_number}
        subtitle={formatDate(contract.created_at)}
        backHref="/contracts"
        status={{
          label: contract.status.replace(/_/g, " "),
          color:
            contract.status === "delivered" ? "#10b981" :
            contract.status === "cancelled" ? "#ef4444" :
            contract.status === "ready_for_delivery" ? "#f59e0b" :
            contract.status === "deposit_collected" ? "#00929C" :
            contract.status === "pending_signature" ? "#f59e0b" :
            "#64748b",
        }}
        actions={
          <a
            href={`/api/contracts/${contract.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Print / PDF"
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Print / PDF"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
          </a>
        }
      />

      <main className="px-5 py-6 space-y-4 max-w-3xl mx-auto pb-24">

        {/* Summary hero: 3-up numbers */}
        <div className="rounded-2xl overflow-hidden shadow-md border border-slate-200">
          <div
            className="px-6 py-5 text-white"
            style={{ background: "linear-gradient(135deg, #010F21 0%, #00929C 180%)" }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-white/60">
                  {contract.is_contingent ? "Contingent contract" : "Contract"}
                </p>
                <p className="text-lg font-bold truncate">
                  {contract.customer?.first_name} {contract.customer?.last_name}
                </p>
                <p className="text-xs text-white/60 truncate">
                  {contract.show?.name ?? contract.location?.name ?? "—"}
                </p>
              </div>
              {contract.is_contingent && (
                <span className="px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-200 text-[10px] font-bold uppercase tracking-widest flex-shrink-0">
                  Contingent
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-slate-100 bg-white">
            <div className="px-4 py-4 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Total</p>
              <p className="text-xl md:text-2xl font-black text-slate-900 mt-1 tabular-nums">
                {formatCurrency(contract.total ?? 0)}
              </p>
            </div>
            <div className="px-4 py-4 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Deposit</p>
              <p className="text-xl md:text-2xl font-black text-emerald-600 mt-1 tabular-nums">
                {formatCurrency(depositPaid)}
              </p>
            </div>
            <div className="px-4 py-4 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Balance</p>
              <p
                className={`text-xl md:text-2xl font-black mt-1 tabular-nums ${
                  computedBalanceDue > 0 ? "text-amber-600" : "text-slate-400"
                }`}
              >
                {formatCurrency(computedBalanceDue)}
              </p>
            </div>
          </div>
        </div>

        {/* Status Timeline */}
        <Card>
          <CardContent className="p-4">
            <StatusTimeline status={contract.status} />
          </CardContent>
        </Card>

        {/* Customer */}
        <SectionCard title="Customer">
          <div className="space-y-1">
            <p className="text-lg font-semibold text-slate-900">
              {contract.customer?.first_name} {contract.customer?.last_name}
            </p>
            {contract.customer?.email && (
              <p className="text-slate-600 text-sm">
                <a href={`mailto:${contract.customer.email}`} className="hover:text-[#00929C] transition-colors">
                  {contract.customer.email}
                </a>
              </p>
            )}
            {contract.customer?.phone && (
              <p className="text-slate-600 text-sm">
                <a href={`tel:${contract.customer.phone}`} className="hover:text-[#00929C] transition-colors">
                  {contract.customer.phone}
                </a>
              </p>
            )}
            {contract.customer?.address && (
              <p className="text-slate-500 text-sm pt-1">
                {contract.customer.address}, {contract.customer.city}, {contract.customer.state} {contract.customer.zip}
              </p>
            )}
          </div>
        </SectionCard>

        {/* Context */}
        <Card>
          <CardContent className="p-4 flex justify-between text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Location / Show</p>
              <p className="font-medium text-slate-900 mt-0.5">{contract.show?.name ?? contract.location?.name ?? "—"}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Sales Rep</p>
              <p className="font-medium text-slate-900 mt-0.5">{(contract.sales_rep as { full_name?: string } | null)?.full_name ?? "—"}</p>
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
                {/* Financing rows intentionally NOT rendered here — they appear once in the Financial Summary below. */}
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
              {contract.tax_exempt_cert_received && (
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-1.5 text-emerald-700">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    TX Exemption Cert Received
                  </span>
                  {contract.tax_exempt_cert_url ? (
                    <CertViewButton contractId={id} />
                  ) : (
                    <span className="text-xs text-slate-400">No file attached</span>
                  )}
                </div>
              )}
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
              {financingArr.filter((f: { financed_amount?: number }) => (f.financed_amount ?? 0) > 0).map((f: { financed_amount: number; financer_name?: string }, i: number) => (
                <div key={i} className="flex justify-between text-blue-700 pt-1">
                  <span>Financing ({f.financer_name ?? "In-House"})</span>
                  <span>−{formatCurrency(f.financed_amount)}</span>
                </div>
              ))}
              {depositAmount > 0 && depositPaid === 0 && (
                <div className="flex justify-between text-slate-600 pt-1">
                  <span>Deposit (due now)</span>
                  <span>−{formatCurrency(depositAmount)}</span>
                </div>
              )}
              {depositPaid > 0 && (
                <div className="flex justify-between text-emerald-700 pt-1">
                  <span>Deposit Paid</span>
                  <span>−{formatCurrency(depositPaid)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-amber-700 pt-1 border-t border-slate-100">
                <span>Balance Due at Delivery</span>
                <span>{formatCurrency(computedBalanceDue)}</span>
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

        {/* Comprehensive financing details — replaces the legacy Lyon-only tracker */}
        {financingArr.length > 0 && (
          <FinancingDetailsCard contractId={contract.id} financing={financingArr} />
        )}

        {/* Permit / HOA contingency tracker — only shows when one is required */}
        <ContingencyTracker
          contractId={contract.id}
          needsPermit={!!contract.needs_permit}
          permitStatus={contract.permit_status ?? null}
          permitNumber={contract.permit_number ?? null}
          permitJurisdiction={contract.permit_jurisdiction ?? null}
          needsHoa={!!contract.needs_hoa}
          hoaStatus={contract.hoa_status ?? null}
        />

        {/* Customer file vault — DL, proof of homeownership, ACH, permits, etc. */}
        {contract.customer_id && (
          <CustomerFileVault
            customerId={contract.customer_id}
            contractId={contract.id}
          />
        )}

        {/* Notes — internal (staff-only) and external (printed on PDF) shown side by side */}
        {(contract.notes || contract.external_notes) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {contract.external_notes && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                    External · printed on customer contract
                  </p>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap">{contract.external_notes}</p>
                </div>
              )}
              {contract.notes && (
                <div className="rounded-lg bg-amber-50/50 border border-amber-200 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">
                    Internal · staff-only, never on PDF
                  </p>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap">{contract.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Spa Delivery Diagram — only shown when delivery_diagram is set */}
        {contract.delivery_diagram && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#00929C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Spa Delivery Diagram
                </CardTitle>
                <Link
                  href={`/contracts/${id}/delivery-diagram`}
                  target="_blank"
                  className="text-xs text-[#00929C] font-semibold hover:underline"
                >
                  View / Print →
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {(() => {
                // Normalize to array: legacy single-object contracts stored as {...}, new ones as [{...}]
                type DiagramItem = { scenario_id?: number; label?: string; fields?: Record<string, string> };
                const raw = contract.delivery_diagram as DiagramItem | DiagramItem[];
                const items: DiagramItem[] = Array.isArray(raw) ? raw : [raw];
                if (items.length === 0) return <p className="text-sm text-slate-400">No scenarios selected</p>;
                return (
                  <div className="space-y-3">
                    {items.map((dd, idx) => {
                      const fieldEntries = dd.fields ? Object.entries(dd.fields).filter(([, v]) => v) : [];
                      return (
                        <div key={`${dd.scenario_id ?? idx}`} className="space-y-1.5">
                          <p className="font-semibold text-slate-900">{dd.label ?? "—"}</p>
                          {fieldEntries.length > 0 ? (
                            <ul className="text-sm text-slate-600 space-y-0.5">
                              {fieldEntries.map(([k, v]) => (
                                <li key={k}>
                                  <span className="capitalize text-slate-500">{k.replace(/_/g, " ")}:</span>{" "}
                                  <span className="font-medium">{v}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-slate-400">No measurements recorded</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Delivery scheduling — show existing schedule or button to create one */}
        {!["cancelled", "delivered"].includes(contract.status) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Delivery</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {deliveryRow ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatDate(deliveryRow.scheduled_date)}
                        {deliveryRow.scheduled_window ? ` · ${deliveryRow.scheduled_window}` : ""}
                      </p>
                      <p className="text-xs text-slate-500 capitalize">
                        Status: {deliveryRow.status?.replace(/_/g, " ")}
                      </p>
                    </div>
                  </div>
                  {deliveryRow.delivery_address && (
                    <p className="text-sm text-slate-700">{deliveryRow.delivery_address}</p>
                  )}
                  {deliveryRow.special_instructions && (
                    <p className="text-xs text-slate-500 italic">{deliveryRow.special_instructions}</p>
                  )}
                  {deliveryRow.readiness_overridden && (
                    <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      Readiness gate overridden{deliveryRow.readiness_override_reason ? ` — ${deliveryRow.readiness_override_reason}` : ""}
                    </p>
                  )}
                </div>
              ) : (
                <ScheduleDeliveryButton
                  contractId={contract.id}
                  defaultAddress={
                    (() => {
                      const c = Array.isArray(contract.customer) ? contract.customer[0] : contract.customer;
                      const parts = [c?.address, c?.city, c?.state, c?.zip].filter(Boolean);
                      return parts.join(", ");
                    })()
                  }
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="space-y-3 pt-2">
          {contract.status === "ready_for_delivery" && (
            <DeliveryConfirmDialog
              contractId={contract.id}
              contractNumber={contract.contract_number}
              total={contract.total ?? 0}
              depositPaid={contract.deposit_paid ?? 0}
              balanceDue={computedBalanceDue}
              taxAmount={contract.tax_amount ?? 0}
              lineItems={(Array.isArray(contract.line_items) ? contract.line_items : []).filter(
                (i: any) => !i.waived && i.product_name
              ).map((i: any) => ({
                product_name: i.product_name ?? "Product",
                quantity: i.quantity ?? 1,
                sell_price: i.sell_price ?? 0,
              }))}
            />
          )}
          {computedBalanceDue > 0 && !["cancelled", "delivered"].includes(contract.status) && (
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
              ccPayment={ccPayment ? { card_brand: ccPayment.card_brand, card_last4: ccPayment.card_last4 } : null}
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

        {/* Equipment Registry */}
        {(contractEquipment ?? []).length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Registered Equipment</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-slate-100">
                {(contractEquipment ?? []).map((eq) => (
                  <li key={eq.id} className="px-4 py-3">
                    <p className="font-medium text-slate-900 text-sm">{eq.product_name}</p>
                    {eq.serial_number && (
                      <p className="text-xs text-slate-500 mt-0.5">S/N: {eq.serial_number}</p>
                    )}
                    {eq.purchase_date && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        Purchased {new Date(eq.purchase_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    )}
                    {eq.warranty_expires && (
                      <p className={`text-xs mt-0.5 ${new Date(eq.warranty_expires) > new Date() ? "text-emerald-600" : "text-slate-400"}`}>
                        Warranty {new Date(eq.warranty_expires) > new Date() ? `expires ${new Date(eq.warranty_expires).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "expired"}
                      </p>
                    )}
                    {eq.notes && <p className="text-xs text-slate-500 mt-0.5 italic">{eq.notes}</p>}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

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
