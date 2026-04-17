"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface AuditRowProps {
  id: string;
  actionLabel: string;
  actionVariant: "default" | "secondary" | "success" | "warning" | "destructive" | "accent";
  entityType: string;
  entityId: string;
  fullEntityId: string | null;
  userName: string;
  timestamp: string;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export function AuditRow({
  id,
  actionLabel,
  actionVariant,
  entityType,
  entityId,
  fullEntityId,
  userName,
  timestamp,
  metadata,
  ipAddress,
  userAgent,
}: AuditRowProps) {
  const [expanded, setExpanded] = useState(false);

  const hasDetails = metadata && Object.keys(metadata).length > 0 || ipAddress || userAgent || fullEntityId;

  return (
    <li className="group">
      <button
        type="button"
        onClick={() => hasDetails && setExpanded(!expanded)}
        className={`w-full text-left px-6 py-3 transition-colors ${
          hasDetails ? "hover:bg-slate-50 active:bg-slate-100 cursor-pointer" : "cursor-default"
        } ${expanded ? "bg-slate-50" : ""}`}
      >
        {/* Desktop layout */}
        <div className="hidden md:grid md:grid-cols-[1fr_140px_100px_140px_160px] gap-4 items-center">
          <div className="flex items-center gap-2">
            <Badge variant={actionVariant}>{actionLabel}</Badge>
            {hasDetails && (
              <svg
                className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </div>
          <span className="text-sm text-slate-700 capitalize">{entityType?.replace(/_/g, " ") ?? "--"}</span>
          <span className="text-sm text-slate-500 font-mono">{entityId}</span>
          <span className="text-sm text-slate-700">{userName}</span>
          <span className="text-sm text-slate-500">{timestamp}</span>
        </div>

        {/* Mobile layout */}
        <div className="md:hidden space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Badge variant={actionVariant}>{actionLabel}</Badge>
            <span className="text-xs text-slate-500">{timestamp}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-slate-700">{userName}</span>
            <span className="text-slate-500 capitalize">{entityType?.replace(/_/g, " ") ?? "--"}</span>
          </div>
          {hasDetails && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-[#00929C]">{expanded ? "Hide" : "Show"} details</span>
              <svg
                className={`w-3 h-3 text-[#00929C] transition-transform ${expanded ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          )}
        </div>
      </button>

      {/* Expanded detail panel */}
      {expanded && hasDetails && (
        <div className="px-6 pb-4 bg-slate-50 border-t border-slate-100">
          <div className="rounded-lg bg-white border border-slate-200 p-4 mt-3 space-y-3">
            {fullEntityId && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Entity ID</p>
                <p className="text-sm text-slate-700 font-mono break-all">{fullEntityId}</p>
              </div>
            )}

            {metadata && Object.keys(metadata).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Metadata</p>
                <pre className="text-xs text-slate-700 bg-slate-50 rounded-lg p-3 overflow-x-auto border border-slate-100">
                  {JSON.stringify(metadata, null, 2)}
                </pre>
              </div>
            )}

            {ipAddress && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">IP Address</p>
                <p className="text-sm text-slate-700 font-mono">{ipAddress}</p>
              </div>
            )}

            {userAgent && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">User Agent</p>
                <p className="text-xs text-slate-500 break-all">{userAgent}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
