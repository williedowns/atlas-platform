// Visual contract lifecycle stepper — shows all stages, highlights current
// Renders as a horizontal scrollable timeline on mobile

const STEPS = [
  { key: "pending_signature", label: "Awaiting Sig." },
  { key: "signed",             label: "Signed" },
  { key: "deposit_collected",  label: "Deposit" },
  { key: "in_production",      label: "Production" },
  { key: "ready_for_delivery", label: "Ready" },
  { key: "delivered",          label: "Delivered" },
];

export function StatusTimeline({ status }: { status: string }) {
  if (status === "draft" || status === "quote") return null;

  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
        <span className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </span>
        <span className="text-sm font-semibold text-red-700">Contract Cancelled</span>
      </div>
    );
  }

  const currentIndex = STEPS.findIndex((s) => s.key === status);

  return (
    <div className="overflow-x-auto -mx-1 px-1 pb-1">
      <div className="flex items-center min-w-max gap-0">
        {STEPS.map((step, i) => {
          const isCompleted = i < currentIndex;
          const isCurrent   = i === currentIndex;
          const isFuture    = i > currentIndex;

          return (
            <div key={step.key} className="flex items-center">
              {/* Node */}
              <div className="flex flex-col items-center gap-1">
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    background: isCompleted
                      ? "#00929C"
                      : isCurrent
                      ? "#010F21"
                      : "#e2e8f0",
                    border: isCurrent ? "2px solid #00929C" : "none",
                    boxShadow: isCurrent ? "0 0 0 3px rgba(0,146,156,0.18)" : "none",
                  }}
                >
                  {isCompleted ? (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isCurrent ? (
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00929C" }} />
                  ) : (
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#cbd5e1" }} />
                  )}
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: isCurrent ? 700 : 500,
                    color: isCompleted ? "#00929C" : isCurrent ? "#010F21" : "#94a3b8",
                    whiteSpace: "nowrap",
                    maxWidth: 60,
                    textAlign: "center",
                  }}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div
                  style={{
                    height: 2,
                    width: 32,
                    background: i < currentIndex ? "#00929C" : "#e2e8f0",
                    marginBottom: 18,
                    flexShrink: 0,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
