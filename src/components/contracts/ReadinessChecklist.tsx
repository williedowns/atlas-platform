import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ReadinessResult } from "@/lib/readiness";

interface Props {
  readiness: ReadinessResult;
  overrideState?: {
    overridden: boolean;
    reason?: string | null;
  };
}

function CheckIcon() {
  return (
    <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

function DashIcon() {
  return (
    <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
    </svg>
  );
}

export default function ReadinessChecklist({ readiness, overrideState }: Props) {
  const blockerCount = readiness.blockers.length;
  const allClear = readiness.ok;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Delivery Readiness</CardTitle>
          {allClear ? (
            <Badge variant="success" className="text-xs">All set</Badge>
          ) : (
            <Badge variant="warning" className="text-xs">
              {blockerCount} item{blockerCount === 1 ? "" : "s"} missing
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="space-y-2">
          {readiness.items.map((item) => {
            const dim = !item.applicable;
            return (
              <li key={item.key} className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {dim ? <DashIcon /> : item.satisfied ? <CheckIcon /> : <WarningIcon />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${dim ? "text-slate-400" : item.satisfied ? "text-slate-900" : "text-amber-800"}`}>
                    {item.label}
                  </p>
                  <p className={`text-xs ${dim ? "text-slate-400" : item.satisfied ? "text-slate-500" : "text-amber-700"}`}>
                    {item.detail}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        {overrideState?.overridden && (
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="text-xs font-semibold text-amber-800">Readiness gate overridden by manager</p>
            {overrideState.reason && (
              <p className="text-xs text-amber-700 mt-0.5">{overrideState.reason}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
