export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AppShell from "@/components/layout/AppShell";
import { AuditFilters } from "./AuditFilters";
import { AuditRow } from "./AuditRow";
import type { AuditAction } from "@/lib/audit";

const PAGE_SIZE = 25;

const ACTION_LABELS: Record<AuditAction, { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" | "accent" }> = {
  "contract.created":          { label: "Contract Created",       variant: "accent" },
  "contract.signed":           { label: "Contract Signed",        variant: "success" },
  "contract.status_changed":   { label: "Contract Status",        variant: "secondary" },
  "contract.cancelled":        { label: "Contract Cancelled",     variant: "destructive" },
  "payment.collected":         { label: "Payment Collected",      variant: "success" },
  "payment.manual_recorded":   { label: "Manual Payment",         variant: "warning" },
  "inventory.transferred":     { label: "Inventory Transfer",     variant: "accent" },
  "user.invited":              { label: "User Invited",           variant: "secondary" },
  "customer.created":          { label: "Customer Created",       variant: "accent" },
  "cert.uploaded":             { label: "Cert Uploaded",          variant: "secondary" },
  "cert.marked_received":      { label: "Cert Received",          variant: "success" },
  "contract.refund_marked":    { label: "Refund Marked",          variant: "warning" },
  "contract.tax_refund_issued":{ label: "Tax Refund Issued",      variant: "warning" },
  "lead.created":              { label: "Lead Created",           variant: "accent" },
  "lead.status_changed":       { label: "Lead Status",            variant: "secondary" },
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }) + " " + d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function truncateId(id: string | null): string {
  if (!id) return "--";
  return id.length > 8 ? id.slice(0, 8) + "..." : id;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "manager"].includes(profile.role)) {
    redirect("/dashboard");
  }

  const params = await searchParams;

  const page = Math.max(1, parseInt(String(params.page ?? "1"), 10) || 1);
  const actionFilter = typeof params.action === "string" && params.action !== "all" ? params.action : null;
  const startDate = typeof params.start === "string" ? params.start : null;
  const endDate = typeof params.end === "string" ? params.end : null;

  // Build query
  let query = supabase
    .from("audit_logs")
    .select("*, user:profiles(full_name)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (actionFilter) {
    query = query.eq("action", actionFilter);
  }
  if (startDate) {
    query = query.gte("created_at", `${startDate}T00:00:00`);
  }
  if (endDate) {
    query = query.lte("created_at", `${endDate}T23:59:59`);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: logs, count } = await query.range(from, to);

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  // Build pagination search params
  function pageHref(p: number): string {
    const sp = new URLSearchParams();
    sp.set("page", String(p));
    if (actionFilter) sp.set("action", actionFilter);
    if (startDate) sp.set("start", startDate);
    if (endDate) sp.set("end", endDate);
    return `/admin/audit?${sp.toString()}`;
  }

  return (
    <AppShell role={profile.role} userName={profile.full_name}>
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="p-2 rounded-lg hover:bg-white/10">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold">Audit Trail</h1>
            <p className="text-xs text-white/60">{count ?? 0} total entries</p>
          </div>
        </div>
      </header>

      <main className="px-5 py-6 space-y-4 max-w-5xl mx-auto pb-24">
        {/* Filters */}
        <AuditFilters
          currentAction={actionFilter ?? "all"}
          startDate={startDate ?? ""}
          endDate={endDate ?? ""}
        />

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Activity Log</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!logs?.length ? (
              <div className="px-6 py-12 text-center">
                <p className="text-slate-500 text-sm">No audit entries found.</p>
                {(actionFilter || startDate || endDate) && (
                  <Link href="/admin/audit" className="text-[#00929C] text-sm mt-2 inline-block hover:underline">
                    Clear filters
                  </Link>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                {/* Desktop table header */}
                <div className="hidden md:grid md:grid-cols-[1fr_140px_100px_140px_160px] gap-4 px-6 py-3 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <span>Action</span>
                  <span>Entity Type</span>
                  <span>Entity ID</span>
                  <span>User</span>
                  <span>Timestamp</span>
                </div>

                <ul className="divide-y divide-slate-100">
                  {logs.map((log) => {
                    const actionInfo = ACTION_LABELS[log.action as AuditAction] ?? {
                      label: log.action,
                      variant: "secondary" as const,
                    };
                    const userName = (log.user as { full_name: string } | null)?.full_name ?? "System";

                    return (
                      <AuditRow
                        key={log.id}
                        id={log.id}
                        actionLabel={actionInfo.label}
                        actionVariant={actionInfo.variant}
                        entityType={log.entity_type}
                        entityId={truncateId(log.entity_id)}
                        fullEntityId={log.entity_id}
                        userName={userName}
                        timestamp={formatTimestamp(log.created_at)}
                        metadata={log.metadata}
                        ipAddress={log.ip_address}
                        userAgent={log.user_agent}
                      />
                    );
                  })}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-slate-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link href={pageHref(page - 1)}>
                  <Button variant="outline" size="sm">Previous</Button>
                </Link>
              ) : (
                <Button variant="outline" size="sm" disabled>Previous</Button>
              )}
              {page < totalPages ? (
                <Link href={pageHref(page + 1)}>
                  <Button variant="outline" size="sm">Next</Button>
                </Link>
              ) : (
                <Button variant="outline" size="sm" disabled>Next</Button>
              )}
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
