"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useContractStore } from "@/store/contractStore";

interface Step6DeliveryProps {
  onNext: () => void;
}

interface Scenario {
  id: number;
  label: string;
  note?: string;
  fields?: { key: string; label: string; placeholder?: string; hint?: string }[];
  svg: React.ReactNode;
}

// ─── Inline SVG illustrations ────────────────────────────────────────────────

function SvgGroundLevel() {
  return (
    <svg viewBox="0 0 120 80" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Ground */}
      <rect x="5" y="60" width="110" height="8" rx="2" fill="#CBD5E1" />
      {/* Spa tub */}
      <rect x="30" y="38" width="60" height="24" rx="4" fill="#E0F2FE" stroke="#0EA5E9" strokeWidth="2" />
      {/* Water ripple */}
      <ellipse cx="60" cy="50" rx="22" ry="6" fill="#BAE6FD" />
      {/* Jets */}
      <circle cx="38" cy="46" r="3" fill="#0EA5E9" opacity="0.6" />
      <circle cx="82" cy="46" r="3" fill="#0EA5E9" opacity="0.6" />
      {/* Cover off to side */}
      <rect x="8" y="42" width="18" height="14" rx="2" fill="#94A3B8" stroke="#64748B" strokeWidth="1.5" />
      {/* Ground indicator line */}
      <text x="60" y="76" textAnchor="middle" fontSize="7" fill="#64748B">Ground Level</text>
    </svg>
  );
}

function SvgElevatedDeck() {
  return (
    <svg viewBox="0 0 120 90" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Ground */}
      <rect x="5" y="75" width="110" height="8" rx="2" fill="#CBD5E1" />
      {/* Deck posts */}
      <rect x="18" y="42" width="5" height="34" fill="#92400E" />
      <rect x="97" y="42" width="5" height="34" fill="#92400E" />
      {/* Deck surface */}
      <rect x="12" y="35" width="96" height="8" rx="2" fill="#D97706" />
      {/* Deck planks */}
      <line x1="30" y1="35" x2="30" y2="43" stroke="#B45309" strokeWidth="1" />
      <line x1="48" y1="35" x2="48" y2="43" stroke="#B45309" strokeWidth="1" />
      <line x1="66" y1="35" x2="66" y2="43" stroke="#B45309" strokeWidth="1" />
      <line x1="84" y1="35" x2="84" y2="43" stroke="#B45309" strokeWidth="1" />
      {/* Railing */}
      <line x1="12" y1="20" x2="12" y2="35" stroke="#64748B" strokeWidth="2" />
      <line x1="108" y1="20" x2="108" y2="35" stroke="#64748B" strokeWidth="2" />
      <line x1="12" y1="20" x2="108" y2="20" stroke="#64748B" strokeWidth="2" />
      {/* Railing balusters */}
      <line x1="30" y1="20" x2="30" y2="35" stroke="#94A3B8" strokeWidth="1" />
      <line x1="48" y1="20" x2="48" y2="35" stroke="#94A3B8" strokeWidth="1" />
      <line x1="66" y1="20" x2="66" y2="35" stroke="#94A3B8" strokeWidth="1" />
      <line x1="84" y1="20" x2="84" y2="35" stroke="#94A3B8" strokeWidth="1" />
      {/* Spa tub */}
      <rect x="32" y="14" width="56" height="22" rx="4" fill="#E0F2FE" stroke="#0EA5E9" strokeWidth="2" />
      <ellipse cx="60" cy="25" rx="20" ry="5" fill="#BAE6FD" />
      {/* Height arrows */}
      <line x1="6" y1="43" x2="6" y2="75" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="3,2" />
      <polygon points="6,40 4,46 8,46" fill="#F59E0B" />
      <polygon points="6,78 4,72 8,72" fill="#F59E0B" />
      <text x="2" y="62" fontSize="6" fill="#F59E0B" transform="rotate(-90,2,62)">Height</text>
    </svg>
  );
}

function SvgRecessed() {
  return (
    <svg viewBox="0 0 120 80" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Deck surface */}
      <rect x="5" y="28" width="48" height="10" rx="1" fill="#D97706" />
      <rect x="67" y="28" width="48" height="10" rx="1" fill="#D97706" />
      {/* Deck planks left */}
      <line x1="20" y1="28" x2="20" y2="38" stroke="#B45309" strokeWidth="1" />
      <line x1="35" y1="28" x2="35" y2="38" stroke="#B45309" strokeWidth="1" />
      {/* Deck planks right */}
      <line x1="82" y1="28" x2="82" y2="38" stroke="#B45309" strokeWidth="1" />
      <line x1="97" y1="28" x2="97" y2="38" stroke="#B45309" strokeWidth="1" />
      {/* Ground */}
      <rect x="5" y="65" width="110" height="8" rx="2" fill="#CBD5E1" />
      {/* Vault walls */}
      <rect x="48" y="38" width="4" height="28" fill="#94A3B8" />
      <rect x="68" y="38" width="4" height="28" fill="#94A3B8" />
      <rect x="48" y="65" width="24" height="4" fill="#94A3B8" />
      {/* Spa recessed inside */}
      <rect x="36" y="35" width="48" height="30" rx="4" fill="#E0F2FE" stroke="#0EA5E9" strokeWidth="2" />
      <ellipse cx="60" cy="50" rx="18" ry="5" fill="#BAE6FD" />
      {/* Down arrows showing recessed */}
      <line x1="60" y1="26" x2="60" y2="34" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="2,2" />
      <polygon points="60,37 57,31 63,31" fill="#F59E0B" />
      <text x="60" y="76" textAnchor="middle" fontSize="7" fill="#64748B">Recessed / Vault</text>
    </svg>
  );
}

function SvgThroughGate() {
  return (
    <svg viewBox="0 0 120 80" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Fence left */}
      <rect x="5" y="20" width="6" height="45" rx="1" fill="#92400E" />
      <line x1="5" y1="28" x2="38" y2="28" stroke="#92400E" strokeWidth="3" />
      <line x1="5" y1="42" x2="38" y2="42" stroke="#92400E" strokeWidth="3" />
      <line x1="15" y1="20" x2="15" y2="65" stroke="#92400E" strokeWidth="2" />
      <line x1="25" y1="20" x2="25" y2="65" stroke="#92400E" strokeWidth="2" />
      <line x1="35" y1="20" x2="35" y2="65" stroke="#92400E" strokeWidth="2" />
      {/* Gate post left */}
      <rect x="38" y="15" width="6" height="55" rx="2" fill="#78350F" />
      {/* Gate opening */}
      {/* Gate post right */}
      <rect x="76" y="15" width="6" height="55" rx="2" fill="#78350F" />
      {/* Gate (open) — rotated */}
      <rect x="82" y="16" width="36" height="8" rx="2" fill="#D97706" opacity="0.7" />
      {/* Fence right */}
      <rect x="109" y="20" width="6" height="45" rx="1" fill="#92400E" />
      <line x1="82" y1="28" x2="115" y2="28" stroke="#92400E" strokeWidth="3" />
      <line x1="82" y1="42" x2="115" y2="42" stroke="#92400E" strokeWidth="3" />
      <line x1="90" y1="20" x2="90" y2="65" stroke="#92400E" strokeWidth="2" />
      <line x1="100" y1="20" x2="100" y2="65" stroke="#92400E" strokeWidth="2" />
      {/* Spa tub (tilted, going through gate) */}
      <rect x="46" y="32" width="26" height="20" rx="4" fill="#E0F2FE" stroke="#0EA5E9" strokeWidth="2" />
      {/* Width arrows */}
      <line x1="44" y1="72" x2="82" y2="72" stroke="#F59E0B" strokeWidth="1.5" />
      <polygon points="41,72 47,69 47,75" fill="#F59E0B" />
      <polygon points="85,72 79,69 79,75" fill="#F59E0B" />
      <text x="63" y="79" textAnchor="middle" fontSize="7" fill="#F59E0B">Width</text>
    </svg>
  );
}

function SvgUpSteps() {
  return (
    <svg viewBox="0 0 120 80" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Ground */}
      <rect x="5" y="68" width="110" height="6" rx="2" fill="#CBD5E1" />
      {/* Steps going up left to right */}
      <rect x="8" y="60" width="20" height="8" fill="#94A3B8" stroke="#64748B" strokeWidth="1" />
      <rect x="28" y="50" width="20" height="18" fill="#94A3B8" stroke="#64748B" strokeWidth="1" />
      <rect x="48" y="40" width="20" height="28" fill="#94A3B8" stroke="#64748B" strokeWidth="1" />
      <rect x="68" y="30" width="20" height="38" fill="#94A3B8" stroke="#64748B" strokeWidth="1" />
      {/* Destination platform */}
      <rect x="88" y="22" width="27" height="46" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1" />
      {/* Spa on top */}
      <rect x="90" y="10" width="24" height="16" rx="3" fill="#E0F2FE" stroke="#0EA5E9" strokeWidth="2" />
      <ellipse cx="102" cy="18" rx="9" ry="3" fill="#BAE6FD" />
      {/* Arrow showing direction */}
      <path d="M20 52 Q44 36 66 28" stroke="#F59E0B" strokeWidth="1.5" fill="none" strokeDasharray="3,2" />
      <polygon points="68,25 64,31 70,31" fill="#F59E0B" />
    </svg>
  );
}

function SvgDownSteps() {
  return (
    <svg viewBox="0 0 120 80" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Ground destination */}
      <rect x="5" y="68" width="110" height="6" rx="2" fill="#CBD5E1" />
      {/* Starting platform */}
      <rect x="5" y="10" width="27" height="58" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1" />
      {/* Spa on top */}
      <rect x="6" y="2" width="24" height="16" rx="3" fill="#E0F2FE" stroke="#0EA5E9" strokeWidth="2" />
      <ellipse cx="18" cy="10" rx="9" ry="3" fill="#BAE6FD" />
      {/* Steps going down left to right */}
      <rect x="32" y="30" width="20" height="38" fill="#94A3B8" stroke="#64748B" strokeWidth="1" />
      <rect x="52" y="40" width="20" height="28" fill="#94A3B8" stroke="#64748B" strokeWidth="1" />
      <rect x="72" y="50" width="20" height="18" fill="#94A3B8" stroke="#64748B" strokeWidth="1" />
      <rect x="92" y="60" width="20" height="8" fill="#94A3B8" stroke="#64748B" strokeWidth="1" />
      {/* Arrow showing direction down */}
      <path d="M32 22 Q56 40 80 58" stroke="#F59E0B" strokeWidth="1.5" fill="none" strokeDasharray="3,2" />
      <polygon points="82,62 78,56 84,57" fill="#F59E0B" />
    </svg>
  );
}

function SvgThroughDoor() {
  return (
    <svg viewBox="0 0 120 80" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Wall */}
      <rect x="5" y="15" width="38" height="55" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1.5" />
      <rect x="77" y="15" width="38" height="55" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1.5" />
      {/* Door frame */}
      <rect x="43" y="15" width="34" height="55" fill="none" stroke="#78350F" strokeWidth="2.5" />
      {/* Door (open) */}
      <rect x="43" y="16" width="6" height="52" rx="1" fill="#D97706" opacity="0.7" />
      {/* Spa going through door */}
      <rect x="46" y="28" width="28" height="26" rx="4" fill="#E0F2FE" stroke="#0EA5E9" strokeWidth="2" />
      <ellipse cx="60" cy="41" rx="11" ry="4" fill="#BAE6FD" />
      {/* Width arrows */}
      <line x1="43" y1="76" x2="77" y2="76" stroke="#F59E0B" strokeWidth="1.5" />
      <polygon points="40,76 46,73 46,79" fill="#F59E0B" />
      <polygon points="80,76 74,73 74,79" fill="#F59E0B" />
      <text x="60" y="79" textAnchor="middle" fontSize="6" fill="#F59E0B">W</text>
      {/* Height arrows */}
      <line x1="8" y1="15" x2="8" y2="70" stroke="#F59E0B" strokeWidth="1.5" />
      <polygon points="8,12 5,18 11,18" fill="#F59E0B" />
      <polygon points="8,73 5,67 11,67" fill="#F59E0B" />
      <text x="14" y="46" fontSize="6" fill="#F59E0B">H</text>
    </svg>
  );
}

function SvgCrane() {
  return (
    <svg viewBox="0 0 120 80" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Ground */}
      <rect x="5" y="68" width="110" height="6" rx="2" fill="#CBD5E1" />
      {/* Crane base / truck */}
      <rect x="8" y="56" width="40" height="14" rx="2" fill="#94A3B8" />
      <circle cx="18" cy="72" r="4" fill="#475569" />
      <circle cx="38" cy="72" r="4" fill="#475569" />
      {/* Crane mast */}
      <rect x="22" y="18" width="5" height="38" fill="#64748B" />
      {/* Crane boom */}
      <line x1="24" y1="20" x2="90" y2="10" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
      {/* Cable */}
      <line x1="88" y1="11" x2="75" y2="38" stroke="#1E293B" strokeWidth="1.5" strokeDasharray="3,2" />
      {/* Spa hanging */}
      <rect x="60" y="36" width="30" height="20" rx="4" fill="#E0F2FE" stroke="#0EA5E9" strokeWidth="2" />
      <ellipse cx="75" cy="46" rx="11" ry="4" fill="#BAE6FD" />
      {/* Hook */}
      <path d="M75 35 Q75 30 80 28 Q85 26 85 32" stroke="#475569" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Warning label */}
      <rect x="78" y="2" width="36" height="10" rx="2" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="1" />
      <text x="96" y="9" textAnchor="middle" fontSize="6" fill="#D97706" fontWeight="bold">EXTRA COST</text>
    </svg>
  );
}

// ─── Scenario definitions ─────────────────────────────────────────────────────

const SCENARIOS: Scenario[] = [
  {
    id: 1,
    label: "Ground Level",
    note: "Concrete pad, crushed granite base, or ground level deck — no extra cost",
    svg: <SvgGroundLevel />,
  },
  {
    id: 2,
    label: "Elevated Deck",
    note: "Extra costs may apply",
    fields: [
      { key: "deck_height", label: "Deck height from ground", placeholder: 'e.g. 36"' },
      { key: "railing_height", label: "Ground to top of railing", placeholder: 'e.g. 42"' },
    ],
    svg: <SvgElevatedDeck />,
  },
  {
    id: 3,
    label: "Recessed / Vault",
    note: "Recessed in a deck or vault — extra costs may apply",
    svg: <SvgRecessed />,
  },
  {
    id: 4,
    label: "Through Gate (Upright)",
    note: "At least 40\" clearance for hot tub · 12\' for swim spa",
    fields: [
      { key: "gate_width", label: "Gate width", placeholder: 'e.g. 48"', hint: 'Min 40" for hot tub, 12\' for swim spa' },
    ],
    svg: <SvgThroughGate />,
  },
  {
    id: 5,
    label: "Up Steps",
    note: "Extra costs may apply",
    fields: [
      { key: "step_count", label: "Number of steps", placeholder: "e.g. 4" },
    ],
    svg: <SvgUpSteps />,
  },
  {
    id: 6,
    label: "Down Steps",
    note: "Extra costs may apply",
    fields: [
      { key: "step_count", label: "Number of steps", placeholder: "e.g. 3" },
    ],
    svg: <SvgDownSteps />,
  },
  {
    id: 7,
    label: "Through Door",
    fields: [
      { key: "door_width", label: "Door width", placeholder: 'e.g. 36"' },
      { key: "door_height", label: "Door height", placeholder: 'e.g. 80"' },
    ],
    svg: <SvgThroughDoor />,
  },
  {
    id: 8,
    label: "Crane Required",
    note: "Extra costs WILL apply",
    svg: <SvgCrane />,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Step6Delivery({ onNext }: Step6DeliveryProps) {
  const { setDeliveryDiagram } = useContractStore();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const selectedScenario = SCENARIOS.find((s) => s.id === selectedId) ?? null;

  function handleSelectScenario(id: number) {
    setSelectedId(id);
    setFieldValues({}); // clear fields when switching scenario
  }

  function handleFieldChange(key: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleContinue() {
    if (!selectedScenario) return;
    setDeliveryDiagram({
      scenario_id: selectedScenario.id,
      label: selectedScenario.label,
      fields: fieldValues,
    });
    onNext();
  }

  function handleSkip() {
    onNext();
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-[#00929C] font-bold">Step 6 of 8</p>
        <h2 className="text-2xl font-black text-slate-900 mt-1">Delivery Setup</h2>
        <p className="text-sm text-slate-500 mt-1">
          Pick the scenario that matches where the spa is going.
        </p>
      </div>

      {/* Scenario grid */}
      <div className="grid grid-cols-2 gap-3">
        {SCENARIOS.map((scenario) => {
          const isSelected = selectedId === scenario.id;
          return (
            <button
              key={scenario.id}
              type="button"
              onClick={() => handleSelectScenario(scenario.id)}
              className={`flex flex-col items-center rounded-2xl border-2 p-3 text-left transition-all ${
                isSelected
                  ? "border-[#00929C] bg-[#00929C]/5 shadow-md"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              {/* Illustration */}
              <div className="w-full h-20 mb-2">
                {scenario.svg}
              </div>
              {/* Label */}
              <span className={`text-xs font-semibold text-center leading-snug ${isSelected ? "text-[#00929C]" : "text-slate-700"}`}>
                {scenario.label}
              </span>
              {scenario.note && (
                <span className="text-[10px] text-slate-400 text-center leading-tight mt-0.5">
                  {scenario.note}
                </span>
              )}
              {/* Selected checkmark */}
              {isSelected && (
                <div className="mt-1.5 w-5 h-5 rounded-full bg-[#00929C] flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Fill-in fields for selected scenario */}
      {selectedScenario?.fields && selectedScenario.fields.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold text-amber-800">
            Additional details for <span className="text-[#00929C]">{selectedScenario.label}</span>
          </p>
          {selectedScenario.fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {field.label}
              </label>
              {field.hint && (
                <p className="text-xs text-slate-500 mb-1">{field.hint}</p>
              )}
              <input
                type="text"
                value={fieldValues[field.key] ?? ""}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
              />
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-2 pt-2">
        <Button
          onClick={handleContinue}
          disabled={selectedId === null}
          size="lg"
          className="w-full"
        >
          Continue to Sign
        </Button>
        <Button
          onClick={handleSkip}
          variant="ghost"
          size="lg"
          className="w-full text-slate-500"
        >
          Skip — Select Later
        </Button>
      </div>
    </div>
  );
}
