"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import type { AuditAction } from "@/lib/audit";

const ALL_ACTIONS: { value: AuditAction | "all"; label: string }[] = [
  { value: "all",                        label: "All Actions" },
  { value: "contract.created",           label: "Contract Created" },
  { value: "contract.signed",            label: "Contract Signed" },
  { value: "contract.status_changed",    label: "Contract Status Changed" },
  { value: "contract.cancelled",         label: "Contract Cancelled" },
  { value: "payment.collected",          label: "Payment Collected" },
  { value: "payment.manual_recorded",    label: "Manual Payment Recorded" },
  { value: "inventory.transferred",      label: "Inventory Transferred" },
  { value: "user.invited",              label: "User Invited" },
  { value: "customer.created",           label: "Customer Created" },
  { value: "cert.uploaded",              label: "Cert Uploaded" },
  { value: "cert.marked_received",       label: "Cert Marked Received" },
  { value: "contract.refund_marked",     label: "Refund Marked" },
  { value: "contract.tax_refund_issued", label: "Tax Refund Issued" },
  { value: "lead.created",              label: "Lead Created" },
  { value: "lead.status_changed",       label: "Lead Status Changed" },
];

interface AuditFiltersProps {
  currentAction: string;
  startDate: string;
  endDate: string;
}

export function AuditFilters({ currentAction, startDate, endDate }: AuditFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const applyFilter = useCallback(
    (key: string, value: string) => {
      const sp = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        sp.set(key, value);
      } else {
        sp.delete(key);
      }
      // Reset to page 1 when filters change
      sp.delete("page");
      router.push(`/admin/audit?${sp.toString()}`);
    },
    [router, searchParams]
  );

  const clearFilters = useCallback(() => {
    router.push("/admin/audit");
  }, [router]);

  const hasFilters = currentAction !== "all" || startDate || endDate;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          {/* Action filter */}
          <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
            <label className="text-sm font-medium text-slate-700">Action Type</label>
            <select
              value={currentAction}
              onChange={(e) => applyFilter("action", e.target.value)}
              className="flex h-12 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C] focus:border-transparent touch-manipulation"
            >
              {ALL_ACTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          {/* Start date */}
          <div className="flex-1 min-w-[150px]">
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => applyFilter("start", e.target.value)}
            />
          </div>

          {/* End date */}
          <div className="flex-1 min-w-[150px]">
            <Input
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => applyFilter("end", e.target.value)}
            />
          </div>

          {/* Clear */}
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0">
              Clear
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
