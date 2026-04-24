export const dynamic = "force-dynamic";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/contracts/PrintButton";

// ─── Inline SVG illustrations (same as StepDelivery) ─────────────────────────

function SvgGroundLevel() {
  return (
    <svg viewBox="0 0 240 160" className="w-full max-w-sm mx-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="120" width="220" height="16" rx="4" fill="#CBD5E1" />
      <rect x="60" y="76" width="120" height="48" rx="8" fill="#E0F2FE" stroke="#0EA5E9" strokeWidth="4" />
      <ellipse cx="120" cy="100" rx="44" ry="12" fill="#BAE6FD" />
      <circle cx="76" cy="92" r="6" fill="#0EA5E9" opacity="0.6" />
      <circle cx="164" cy="92" r="6" fill="#0EA5E9" opacity="0.6" />
      <rect x="16" y="84" width="36" height="28" rx="4" fill="#94A3B8" stroke="#64748B" strokeWidth="3" />
      <text x="120" y="152" textAnchor="middle" fontSize="14" fill="#64748B">Ground Level</text>
    </svg>
  );
}

function SvgElevatedDeck() {
  return (
    <svg viewBox="0 0 240 180" className="w-full max-w-sm mx-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="150" width="220" height="16" rx="4" fill="#CBD5E1" />
      <rect x="36" y="84" width="10" height="68" fill="#92400E" />
      <rect x="194" y="84" width="10" height="68" fill="#92400E" />
      <rect x="24" y="70" width="192" height="16" rx="4" fill="#D97706" />
      <line x1="60" y1="70" x2="60" y2="86" stroke="#B45309" strokeWidth="2" />
      <line x1="96" y1="70" x2="96" y2="86" stroke="#B45309" strokeWidth="2" />
      <line x1="132" y1="70" x2="132" y2="86" stroke="#B45309" strokeWidth="2" />
      <line x1="168" y1="70" x2="168" y2="86" stroke="#B45309" strokeWidth="2" />
      <line x1="24" y1="40" x2="24" y2="70" stroke="#64748B" strokeWidth="4" />
      <line x1="216" y1="40" x2="216" y2="70" stroke="#64748B" strokeWidth="4" />
      <line x1="24" y1="40" x2="216" y2="40" stroke="#64748B" strokeWidth="4" />
      <line x1="60" y1="40" x2="60" y2="70" stroke="#94A3B8" strokeWidth="2" />
      <line x1="96" y1="40" x2="96" y2="70" stroke="#94A3B8" strokeWidth="2" />
      <line x1="132" y1="40" x2="132" y2="70" stroke="#94A3B8" strokeWidth="2" />
      <line x1="168" y1="40" x2="168" y2="70" stroke="#94A3B8" strokeWidth="2" />
      <rect x="64" y="28" width="112" height="44" rx="8" fill="#E0F2FE" stroke="#0EA5E9" strokeWidth="4" />
      <ellipse cx="120" cy="50" rx="40" ry="10" fill="#BAE6FD" />
      <line x1="12" y1="86" x2="12" y2="150" stroke="#F59E0B" strokeWidth="3" strokeDasharray="6,4" />
    </svg>
  );
}

function SvgRecessed() {
  return (
    <svg viewBox="0 0 240 160" className="w-full max-w-sm mx-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="56" width="96" height="20" rx="2" fill="#D97706" />
      <rect x="134" y="56" width="96" height="20" rx="2" fill="#D97706" />
      <rect x="10" y="130" width="220" height="16" rx="4" fill="#CBD5E1" />
      <rect x="96" y="76" width="8" height="56" fill="#94A3B8" />
      <rect x="136" y="76" width="8" height="56" fill="#94A3B8" />
      <rect x="96" y="130" width="48" height="8" fill="#94A3B8" />
      <rect x="72" y="70" width="96" height="60" rx="8" fill="#E0F2FE" stroke="#0EA5E9" strokeWidth="4" />
      <ellipse cx="120" cy="100" rx="36" ry="10" fill="#BAE6FD" />
    </svg>
  );
}

function SvgThroughGate() {
  return (
    <svg viewBox="0 0 240 160" className="w-full max-w-sm mx-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="40" width="12" height="90" rx="2" fill="#92400E" />
      <line x1="10" y1="56" x2="76" y2="56" stroke="#92400E" strokeWidth="6" />
      <line x1="10" y1="84" x2="76" y2="84" stroke="#92400E" strokeWidth="6" />
      <line x1="30" y1="40" x2="30" y2="130" stroke="#92400E" strokeWidth="4" />
      <line x1="50" y1="40" x2="50" y2="130" stroke="#92400E" strokeWidth="4" />
      <line x1="70" y1="40" x2="70" y2="130" stroke="#92400E" strokeWidth="4" />
      <rect x="76" y="30" width="12" height="110" rx="4" fill="#78350F" />
      <rect x="152" y="30" width="12" height="110" rx="4" fill="#78350F" />
      <rect x="164" y="32" width="72" height="16" rx="4" fill="#D97706" opacity="0.7" />
      <rect x="218" y="40" width="12" height="90" rx="2" fill="#92400E" />
      <line x1="164" y1="56" x2="230" y2="56" stroke="#92400E" strokeWidth="6" />
      <line x1="164" y1="84" x2="230" y2="84" stroke="#92400E" strokeWidth="6" />
      <rect x="92" y="64" width="52" height="40" rx="8" fill="#E0F2FE" stroke="#0EA5E9" strokeWidth="4" />
      <line x1="88" y1="144" x2="164" y2="144" stroke="#F59E0B" strokeWidth="3" />
      <polygon points="82,144 94,138 94,150" fill="#F59E0B" />
      <polygon points="170,144 158,138 158,150" fill="#F59E0B" />
      <text x="126" y="158" textAnchor="middle" fontSize="12" fill="#F59E0B">Gate Width</text>
    </svg>
  );
}

function SvgUpSteps() {
  return (
    <svg viewBox="0 0 240 160" className="w-full max-w-sm mx-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="136" width="220" height="12" rx="2" fill="#CBD5E1" />
      <rect x="16" y="120" width="40" height="16" fill="#94A3B8" stroke="#64748B" strokeWidth="2" />
      <rect x="56" y="100" width="40" height="36" fill="#94A3B8" stroke="#64748B" strokeWidth="2" />
      <rect x="96" y="80" width="40" height="56" fill="#94A3B8" stroke="#64748B" strokeWidth="2" />
      <rect x="136" y="60" width="40" height="76" fill="#94A3B8" stroke="#64748B" strokeWidth="2" />
      <rect x="176" y="44" width="54" height="92" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
      <rect x="180" y="20" width="48" height="32" rx="6" fill="#E0F2FE" stroke="#0EA5E9" strokeWidth="4" />
      <ellipse cx="204" cy="36" rx="18" ry="6" fill="#BAE6FD" />
      <path d="M40 104 Q88 72 132 56" stroke="#F59E0B" strokeWidth="3" fill="none" strokeDasharray="6,4" />
      <polygon points="136,52 128,62 140,62" fill="#F59E0B" />
    </svg>
  );
}

function SvgDownSteps() {
  return (
    <svg viewBox="0 0 240 160" className="w-full max-w-sm mx-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="136" width="220" height="12" rx="2" fill="#CBD5E1" />
      <rect x="10" y="20" width="54" height="116" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
      <rect x="12" y="4" width="48" height="32" rx="6" fill="#E0F2FE" stroke="#0EA5E9" strokeWidth="4" />
      <ellipse cx="36" cy="20" rx="18" ry="6" fill="#BAE6FD" />
      <rect x="64" y="60" width="40" height="76" fill="#94A3B8" stroke="#64748B" strokeWidth="2" />
      <rect x="104" y="80" width="40" height="56" fill="#94A3B8" stroke="#64748B" strokeWidth="2" />
      <rect x="144" y="100" width="40" height="36" fill="#94A3B8" stroke="#64748B" strokeWidth="2" />
      <rect x="184" y="120" width="40" height="16" fill="#94A3B8" stroke="#64748B" strokeWidth="2" />
      <path d="M64 44 Q108 80 160 116" stroke="#F59E0B" strokeWidth="3" fill="none" strokeDasharray="6,4" />
      <polygon points="164,124 156,112 168,114" fill="#F59E0B" />
    </svg>
  );
}

function SvgThroughDoor() {
  return (
    <svg viewBox="0 0 240 160" className="w-full max-w-sm mx-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="30" width="76" height="110" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="3" />
      <rect x="154" y="30" width="76" height="110" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="3" />
      <rect x="86" y="30" width="68" height="110" fill="none" stroke="#78350F" strokeWidth="5" />
      <rect x="86" y="32" width="12" height="104" rx="2" fill="#D97706" opacity="0.7" />
      <rect x="92" y="56" width="56" height="52" rx="8" fill="#E0F2FE" stroke="#0EA5E9" strokeWidth="4" />
      <ellipse cx="120" cy="82" rx="22" ry="8" fill="#BAE6FD" />
      <line x1="86" y1="152" x2="154" y2="152" stroke="#F59E0B" strokeWidth="3" />
      <polygon points="80,152 92,146 92,158" fill="#F59E0B" />
      <polygon points="160,152 148,146 148,158" fill="#F59E0B" />
      <text x="120" y="160" textAnchor="middle" fontSize="11" fill="#F59E0B">Width</text>
      <line x1="16" y1="30" x2="16" y2="140" stroke="#F59E0B" strokeWidth="3" />
      <polygon points="16,24 10,36 22,36" fill="#F59E0B" />
      <polygon points="16,146 10,134 22,134" fill="#F59E0B" />
      <text x="28" y="92" fontSize="11" fill="#F59E0B">Height</text>
    </svg>
  );
}

function SvgCrane() {
  return (
    <svg viewBox="0 0 240 160" className="w-full max-w-sm mx-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="136" width="220" height="12" rx="2" fill="#CBD5E1" />
      <rect x="16" y="112" width="80" height="28" rx="4" fill="#94A3B8" />
      <circle cx="36" cy="144" r="8" fill="#475569" />
      <circle cx="76" cy="144" r="8" fill="#475569" />
      <rect x="44" y="36" width="10" height="76" fill="#64748B" />
      <line x1="48" y1="40" x2="180" y2="20" stroke="#475569" strokeWidth="6" strokeLinecap="round" />
      <line x1="176" y1="22" x2="150" y2="76" stroke="#1E293B" strokeWidth="3" strokeDasharray="6,4" />
      <rect x="120" y="72" width="60" height="40" rx="8" fill="#E0F2FE" stroke="#0EA5E9" strokeWidth="4" />
      <ellipse cx="150" cy="92" rx="22" ry="8" fill="#BAE6FD" />
      <path d="M150 70 Q150 60 160 56 Q170 52 170 64" stroke="#475569" strokeWidth="4" fill="none" strokeLinecap="round" />
      <rect x="156" y="4" width="72" height="20" rx="4" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="2" />
      <text x="192" y="18" textAnchor="middle" fontSize="11" fill="#D97706" fontWeight="bold">EXTRA COST</text>
    </svg>
  );
}

const SCENARIO_SVGS: Record<number, React.ReactNode> = {
  1: <SvgGroundLevel />,
  2: <SvgElevatedDeck />,
  3: <SvgRecessed />,
  4: <SvgThroughGate />,
  5: <SvgUpSteps />,
  6: <SvgDownSteps />,
  7: <SvgThroughDoor />,
  8: <SvgCrane />,
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DeliveryDiagramPage({
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
    .select("contract_number, delivery_diagram, customer:customers(first_name, last_name), signed_at")
    .eq("id", id)
    .single();

  if (!contract) notFound();

  // Normalize to array: legacy contracts stored a single object; new ones store an array.
  type DiagramItem = {
    scenario_id?: number;
    label?: string;
    fields?: Record<string, string>;
  };
  const rawDd = contract.delivery_diagram as DiagramItem | DiagramItem[] | null;
  const diagrams: DiagramItem[] = rawDd
    ? Array.isArray(rawDd)
      ? rawDd
      : [rawDd]
    : [];

  const customer = Array.isArray(contract.customer) ? contract.customer[0] : contract.customer;
  const customerName = customer
    ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
    : "—";

  return (
    <div className="min-h-screen bg-white print:bg-white">
      {/* Print-friendly header — no navigation */}
      <div className="px-8 pt-8 pb-4 border-b border-slate-200 flex items-start justify-between print:px-6 print:pt-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Spa Delivery Diagram</h1>
          <p className="text-sm text-slate-500 mt-1">
            Contract: <span className="font-semibold text-slate-700">{contract.contract_number}</span>
          </p>
          <p className="text-sm text-slate-500">
            Customer: <span className="font-semibold text-slate-700">{customerName}</span>
          </p>
        </div>
        {/* Atlas logo placeholder / print hint */}
        <PrintButton />
      </div>

      <div className="px-8 py-8 max-w-2xl mx-auto print:px-6 print:py-6">
        {diagrams.length > 0 ? (
          <>
            {diagrams.map((dd, idx) => {
              const fieldEntries = dd.fields
                ? Object.entries(dd.fields).filter(([, v]) => v)
                : [];
              const ScenarioSvg = dd.scenario_id ? SCENARIO_SVGS[dd.scenario_id] : null;
              const isLast = idx === diagrams.length - 1;
              return (
                <div key={`${dd.scenario_id ?? idx}`} className={isLast ? "" : "mb-10 pb-10 border-b border-slate-200 print:break-after-page"}>
                  {/* Scenario label */}
                  <div className="mb-6 text-center">
                    <span className="inline-block bg-[#00929C]/10 text-[#00929C] font-bold text-lg px-6 py-2 rounded-full">
                      {diagrams.length > 1 ? `${idx + 1}. ` : ""}{dd.label}
                    </span>
                  </div>

                  {/* SVG illustration */}
                  {ScenarioSvg && (
                    <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50 mb-6">
                      {ScenarioSvg}
                    </div>
                  )}

                  {/* Fill-in field values */}
                  {fieldEntries.length > 0 && (
                    <div className="border border-slate-200 rounded-2xl p-6 mb-6">
                      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                        Measurements &amp; Details
                      </h2>
                      <dl className="space-y-2">
                        {fieldEntries.map(([key, value]) => (
                          <div key={key} className="flex justify-between items-baseline">
                            <dt className="text-sm text-slate-600 capitalize">{key.replace(/_/g, " ")}</dt>
                            <dd className="text-base font-semibold text-slate-900 ml-4">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Buyer signature line — single signature covers all selected scenarios */}
            <div className="border-t border-slate-300 pt-6 mt-8 grid grid-cols-2 gap-8">
              <div>
                <div className="border-b border-slate-400 h-10 mb-1" />
                <p className="text-xs text-slate-500">Buyer Signature</p>
              </div>
              <div>
                <div className="border-b border-slate-400 h-10 mb-1" />
                <p className="text-xs text-slate-500">Date</p>
              </div>
            </div>
          </>
        ) : (
          <div className="py-16 text-center text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="font-medium">No delivery diagram on file for this contract</p>
          </div>
        )}
      </div>
    </div>
  );
}
