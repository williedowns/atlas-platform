export const dynamic = "force-dynamic";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: quote } = await supabase
    .from("contracts")
    .select(`
      *,
      customer:customers(*),
      show:shows(name, venue_name),
      location:locations(name, state),
      sales_rep:profiles(full_name)
    `)
    .eq("id", id)
    .eq("status", "quote")
    .single();

  if (!quote) notFound();

  const lineItems = Array.isArray(quote.line_items) ? quote.line_items : [];
  const discounts = Array.isArray(quote.discounts) ? quote.discounts : [];
  const financing = Array.isArray(quote.financing) ? quote.financing : [];
  const financedAtSale = financing
    .filter((f: any) => f.deduct_from_balance !== false)
    .reduce((sum: number, f: any) => sum + (f.financed_amount ?? 0), 0);
  const foundationEntries = financing.filter((f: any) => f.deduct_from_balance === false);

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
            <h1 className="text-lg font-bold">{quote.contract_number}</h1>
            <p className="text-[#00929C] text-xs">{formatDate(quote.created_at)}</p>
          </div>
          <Badge variant="secondary" className="text-xs bg-slate-600 text-white">Quote</Badge>
        </div>
      </header>

      <main className="px-5 py-6 space-y-4 max-w-2xl mx-auto pb-32">

        {/* ── Action Buttons ─────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <a
            href={`/api/contracts/${id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 h-14 rounded-xl border-2 border-slate-300 bg-white text-slate-700 font-semibold text-sm hover:border-[#00929C] hover:text-[#00929C] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print / PDF
          </a>
          <Link
            href={`/contracts/new?from=${id}`}
            className="flex items-center justify-center gap-2 h-14 rounded-xl bg-[#00929C] text-white font-semibold text-sm hover:bg-[#007279] transition-colors shadow-md"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Continue to Contract
          </Link>
        </div>

        {/* ── Customer ───────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent>
            {quote.customer ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-500">Name</span>
                  <p className="font-medium">{quote.customer.first_name} {quote.customer.last_name}</p>
                </div>
                <div>
                  <span className="text-slate-500">Phone</span>
                  <p className="font-medium">{quote.customer.phone}</p>
                </div>
                <div>
                  <span className="text-slate-500">Email</span>
                  <p className="font-medium">{quote.customer.email}</p>
                </div>
                <div>
                  <span className="text-slate-500">Address</span>
                  <p className="font-medium">{quote.customer.city}, {quote.customer.state}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">No customer</p>
            )}
          </CardContent>
        </Card>

        {/* ── Show / Location ─────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Show / Location</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {quote.show?.name && <p className="font-medium">{quote.show.name}</p>}
            {quote.show?.venue_name && <p className="text-slate-500">{quote.show.venue_name}</p>}
            {quote.location?.name && <p className="text-slate-500">{quote.location.name}</p>}
            <p className="text-slate-400 text-xs">{formatDate(quote.created_at)}</p>
          </CardContent>
        </Card>

        {/* ── Line Items ──────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Products</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left py-2 px-4 font-medium text-slate-500">Product</th>
                  <th className="text-right py-2 px-4 font-medium text-slate-500">Price</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-3 px-4 font-medium text-slate-900">{item.product_name}</td>
                    <td className="py-3 px-4 text-right font-medium">
                      {item.waived
                        ? <span className="text-emerald-600 text-xs font-bold">FREE</span>
                        : formatCurrency(item.sell_price * (item.quantity ?? 1))}
                    </td>
                  </tr>
                ))}
                {discounts.map((d: any, i: number) => (
                  <tr key={`d-${i}`} className="border-b border-slate-100">
                    <td className="py-3 px-4 text-red-600">{d.label}</td>
                    <td className="py-3 px-4 text-right text-red-600 font-medium">−{formatCurrency(d.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* ── Financing ───────────────────────────────────────── */}
        {financing.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Financing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {financing.map((f: any, i: number) => (
                <div key={i} className="flex justify-between items-start text-sm">
                  <div>
                    <p className="font-medium text-slate-900">{f.financer_name}</p>
                    <p className="text-xs text-slate-500">Plan {f.plan_number}</p>
                    {f.deduct_from_balance === false && (
                      <span className="text-xs text-amber-700 font-semibold">Carries to balance</span>
                    )}
                  </div>
                  <span className="font-semibold">{formatCurrency(f.financed_amount)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* ── Order Summary ───────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium">{formatCurrency(quote.subtotal)}</span>
            </div>
            {quote.discount_total > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Discounts</span>
                <span className="text-red-600 font-medium">−{formatCurrency(quote.discount_total)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Tax ({((quote.tax_rate ?? 0) * 100).toFixed(2)}%)</span>
              <span className="font-medium">{formatCurrency(quote.tax_amount)}</span>
            </div>
            {quote.surcharge_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">CC Surcharge</span>
                <span className="font-medium">{formatCurrency(quote.surcharge_amount)}</span>
              </div>
            )}
            <div className="border-t border-slate-200 pt-2 flex justify-between text-base font-bold text-[#00929C]">
              <span>Total</span>
              <span>{formatCurrency(quote.total)}</span>
            </div>
            {financedAtSale > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">
                  {financing.filter((f: any) => f.deduct_from_balance !== false).map((f: any) => f.financer_name).join(", ")} (financed)
                </span>
                <span className="text-[#00929C] font-medium">−{formatCurrency(financedAtSale)}</span>
              </div>
            )}
            {foundationEntries.length > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-amber-700">Foundation (carries to balance)</span>
                <span className="text-amber-700 font-medium">{formatCurrency(foundationEntries.reduce((s: number, f: any) => s + f.financed_amount, 0))}</span>
              </div>
            )}
            <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-amber-700">
              <span>Balance Due at Delivery</span>
              <span>{formatCurrency(quote.balance_due)}</span>
            </div>
          </CardContent>
        </Card>

        {/* ── Sales Rep ───────────────────────────────────────── */}
        {quote.sales_rep?.full_name && (
          <p className="text-center text-xs text-slate-400">
            Quote prepared by {quote.sales_rep.full_name}
          </p>
        )}
      </main>
    </div>
  );
}
