"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { moveOpportunityStage } from "../opportunities/actions";
import StageMoveSelect from "./StageMoveSelect";

export interface Stage {
  id: string;
  name: string;
  display_order: number;
  probability: number;
  color: string | null;
  is_won: boolean;
  is_lost: boolean;
}

export interface Opportunity {
  id: string;
  name: string;
  stage_id: string;
  value_estimate: number | null;
  source: string | null;
  interest_category: string | null;
  status: string;
  primary_contact_id: string | null;
  owner_id: string | null;
  primary_contact: { id: string; first_name: string; last_name: string | null } | null;
  owner: { id: string; full_name: string | null } | null;
}

interface DraggableKanbanProps {
  pipelineId: string;
  stages: Stage[];
  opportunities: Opportunity[];
}

function formatCurrency(amount: number | null): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function DraggableKanban({ pipelineId, stages, opportunities }: DraggableKanbanProps) {
  // Optimistic state — when a card is dragged, move it visually before the
  // server confirms. Revert on error.
  const [localOpps, setLocalOpps] = useState<Opportunity[]>(opportunities);
  const [activeOppId, setActiveOppId] = useState<string | null>(null);
  const [errorOppId, setErrorOppId] = useState<string | null>(null);
  const [_, startTransition] = useTransition();

  // Sync local state when parent re-fetches (e.g. after revalidate)
  if (opportunities !== localOpps && activeOppId === null) {
    setTimeout(() => setLocalOpps(opportunities), 0);
  }

  // Sensors: pointer (mouse + most touch on modern browsers), touch (iPad),
  // and keyboard for accessibility. activationConstraint prevents drag from
  // firing on a click — only after a small movement.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      // Long-press for ~200ms before drag starts on touch. Tolerance allows
      // finger to wiggle slightly during the hold without scrolling.
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  // Group opportunities by stage_id
  const byStage = new Map<string, Opportunity[]>();
  for (const stage of stages) byStage.set(stage.id, []);
  for (const opp of localOpps) {
    const list = byStage.get(opp.stage_id);
    if (list) list.push(opp);
  }

  const activeOpp = activeOppId ? localOpps.find((o) => o.id === activeOppId) ?? null : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveOppId(String(event.active.id));
    setErrorOppId(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveOppId(null);
    const { active, over } = event;
    if (!over) return;

    const oppId = String(active.id);
    const newStageId = String(over.id);

    const opp = localOpps.find((o) => o.id === oppId);
    if (!opp || opp.stage_id === newStageId) return;

    const previousStageId = opp.stage_id;

    // Optimistic update
    setLocalOpps((prev) =>
      prev.map((o) => (o.id === oppId ? { ...o, stage_id: newStageId } : o))
    );

    startTransition(async () => {
      const result = await moveOpportunityStage(oppId, newStageId);
      if (!result.ok) {
        setLocalOpps((prev) =>
          prev.map((o) => (o.id === oppId ? { ...o, stage_id: previousStageId } : o))
        );
        setErrorOppId(oppId);
        setTimeout(() => setErrorOppId((curr) => (curr === oppId ? null : curr)), 2500);
      }
    });
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 px-4 py-4 min-w-max">
        {stages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            pipelineId={pipelineId}
            stages={stages}
            opportunities={byStage.get(stage.id) ?? []}
            errorOppId={errorOppId}
            isAnyDragging={activeOppId !== null}
          />
        ))}
      </div>

      {/* DragOverlay renders a floating clone of the dragged card that follows
          the pointer. Without this, on touch devices the card appears to stay
          put while only a ghost cursor moves. */}
      <DragOverlay dropAnimation={null}>
        {activeOpp ? <KanbanCardDisplay opp={activeOpp} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  stage,
  pipelineId,
  stages,
  opportunities,
  errorOppId,
  isAnyDragging,
}: {
  stage: Stage;
  pipelineId: string;
  stages: Stage[];
  opportunities: Opportunity[];
  errorOppId: string | null;
  isAnyDragging: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const accentColor = stage.color ?? "#94a3b8";
  const stageValue = opportunities.reduce((s, o) => s + (o.value_estimate ?? 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={`w-72 flex-shrink-0 flex flex-col rounded-xl transition-all ${
        isOver
          ? "bg-[#00929C]/10 ring-2 ring-[#00929C]"
          : "bg-slate-100/70"
      }`}
    >
      <div className="px-3 py-2.5 border-b border-slate-200/70 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: accentColor }} />
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide truncate">{stage.name}</h3>
          <span className="text-[10px] font-semibold text-slate-500 tabular-nums flex-shrink-0">
            {opportunities.length}
          </span>
        </div>
        <Link
          href={`/crm/opportunities/new?pipeline_id=${pipelineId}&stage_id=${stage.id}`}
          className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-[#00929C] hover:bg-white transition-colors flex-shrink-0"
          aria-label={`New opportunity in ${stage.name}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </Link>
      </div>

      {stageValue > 0 && (
        <div className="px-3 py-1.5 text-[11px] font-medium text-slate-500 tabular-nums border-b border-slate-200/70">
          {formatCurrency(stageValue)} · {stage.probability}% prob
        </div>
      )}

      <div className="flex-1 p-2 space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
        {opportunities.length === 0 ? (
          isAnyDragging ? (
            <div
              className={`text-center text-[11px] py-6 px-2 border-2 border-dashed rounded-lg ${
                isOver
                  ? "border-[#00929C] text-[#00929C] bg-white/50"
                  : "border-slate-200 text-slate-400"
              }`}
            >
              {isOver ? "↓ Drop here" : "Drop in this stage"}
            </div>
          ) : (
            <Link
              href={`/crm/opportunities/new?pipeline_id=${pipelineId}&stage_id=${stage.id}`}
              className="block text-center text-[11px] py-6 px-2 border-2 border-dashed border-slate-200 text-slate-400 hover:border-[#00929C]/50 hover:text-[#00929C] rounded-lg transition-colors"
            >
              + Add opportunity
            </Link>
          )
        ) : (
          opportunities.map((opp) => (
            <KanbanCard
              key={opp.id}
              opp={opp}
              stages={stages}
              hadError={errorOppId === opp.id}
            />
          ))
        )}
      </div>
    </div>
  );
}

function KanbanCard({
  opp,
  stages,
  hadError,
}: {
  opp: Opportunity;
  stages: Stage[];
  hadError: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: opp.id });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ touchAction: "none" }}
      className={`relative ${isDragging ? "opacity-30" : "opacity-100"}`}
    >
      <Link
        href={`/crm/opportunities/${opp.id}`}
        className={`block p-3 bg-white rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
          hadError
            ? "border-red-400 ring-2 ring-red-200"
            : "border-slate-200 hover:border-[#00929C] hover:shadow-sm"
        } group`}
      >
        <KanbanCardBody opp={opp} />
        <KanbanCardFooter opp={opp} stages={stages} />
        {hadError && (
          <p className="absolute -top-2 left-2 right-2 bg-red-50 border border-red-200 text-[10px] text-red-700 px-2 py-1 rounded shadow-sm">
            Move failed — reverted
          </p>
        )}
      </Link>
    </div>
  );
}

function KanbanCardDisplay({ opp, isOverlay = false }: { opp: Opportunity; isOverlay?: boolean }) {
  return (
    <div
      className={`p-3 bg-white rounded-lg border border-[#00929C] shadow-lg ${
        isOverlay ? "rotate-2 cursor-grabbing" : ""
      }`}
      style={{ width: 280 }}
    >
      <KanbanCardBody opp={opp} />
      <KanbanCardFooter opp={opp} stages={[]} hideStageSelect />
    </div>
  );
}

function KanbanCardBody({ opp }: { opp: Opportunity }) {
  const contactName = opp.primary_contact
    ? [opp.primary_contact.first_name, opp.primary_contact.last_name].filter(Boolean).join(" ")
    : null;
  return (
    <>
      <p className="font-semibold text-sm text-slate-900 line-clamp-2 leading-snug">{opp.name}</p>
      {contactName && (
        <p className="text-[11px] text-slate-500 mt-1 truncate">{contactName}</p>
      )}
      {opp.interest_category && (
        <p className="text-[10px] text-slate-400 mt-0.5 capitalize">
          {opp.interest_category.replace(/_/g, " ")}
        </p>
      )}
    </>
  );
}

function KanbanCardFooter({
  opp,
  stages,
  hideStageSelect = false,
}: {
  opp: Opportunity;
  stages: Stage[];
  hideStageSelect?: boolean;
}) {
  const ownerInitials = opp.owner?.full_name
    ? opp.owner.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : null;

  return (
    <div className="flex items-center justify-between mt-2.5 gap-2">
      <span className="text-[11px] font-bold text-slate-700 tabular-nums">
        {formatCurrency(opp.value_estimate)}
      </span>
      <div
        className="flex items-center gap-2 flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {ownerInitials && (
          <span
            className="w-5 h-5 rounded-full bg-gradient-to-br from-[#00929C] to-[#007a82] text-white text-[9px] font-bold flex items-center justify-center"
            title={opp.owner?.full_name ?? ""}
          >
            {ownerInitials}
          </span>
        )}
        {!hideStageSelect && (
          <StageMoveSelect
            opportunityId={opp.id}
            currentStageId={opp.stage_id}
            stages={stages.map((s) => ({ id: s.id, name: s.name }))}
          />
        )}
      </div>
    </div>
  );
}
