export const dynamic = "force-dynamic";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { formatDate } from "@/lib/utils";
import StageMoveSelect from "../../pipeline/StageMoveSelect";
import ActivityTimeline from "../../_components/ActivityTimeline";
import TaskList from "../../_components/TaskList";
import InlineEdit from "../../_components/InlineEdit";
import LostReasonForm from "../../_components/LostReasonForm";
import RealtimeRefresher from "../../_components/RealtimeRefresher";

const SOURCE_OPTIONS = [
  { value: "showroom", label: "Showroom" },
  { value: "show", label: "Show" },
  { value: "referral", label: "Referral" },
  { value: "website", label: "Website" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "google", label: "Google" },
  { value: "yelp", label: "Yelp" },
  { value: "phone", label: "Phone" },
  { value: "walk_in", label: "Walk in" },
  { value: "other", label: "Other" },
];

const INTEREST_OPTIONS = [
  { value: "hot_tub", label: "Hot tub" },
  { value: "swim_spa", label: "Swim spa" },
  { value: "cold_tub", label: "Cold tub" },
  { value: "above_ground_pool", label: "Above-ground pool" },
  { value: "accessory", label: "Accessory" },
  { value: "service", label: "Service" },
];

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

const STATUS_STYLE: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  won: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
  abandoned: "bg-slate-100 text-slate-500",
};

export default async function CrmOpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, organization:organizations(role_permissions)")
    .eq("id", user.id)
    .single();

  if (!["admin", "manager"].includes(profile?.role ?? "")) {
    redirect("/dashboard");
  }

  const orgPerms = (profile?.organization as any)?.role_permissions;

  const { data: opp } = await supabase
    .from("opportunities")
    .select(`
      id, name, status, value_estimate, value_actual, probability, expected_close_date,
      source, source_detail, interest_category, lost_reason, lost_notes, won_at, lost_at,
      notes, ai_score, ai_health, created_at, updated_at,
      pipeline_id, stage_id, primary_contact_id, household_id, owner_id,
      pipeline:pipelines(id, name, type),
      stage:pipeline_stages!stage_id(id, name, display_order, probability, color, is_won, is_lost),
      primary_contact:contacts!primary_contact_id(id, first_name, last_name, email_primary, phone_primary),
      household:households(id, name, lifecycle_stage),
      owner:profiles!owner_id(id, full_name)
    `)
    .eq("id", id)
    .single();

  if (!opp) notFound();

  const { data: pipelineStagesRaw } = await supabase
    .from("pipeline_stages")
    .select("id, name, display_order, probability, color, is_won, is_lost")
    .eq("pipeline_id", opp.pipeline_id)
    .order("display_order");

  const pipelineStages = pipelineStagesRaw ?? [];
  const pipeline = (opp.pipeline as any) ?? null;
  const stage = (opp.stage as any) ?? null;
  const contact = (opp.primary_contact as any) ?? null;
  const household = (opp.household as any) ?? null;
  const owner = (opp.owner as any) ?? null;

  const contactName = contact ? [contact.first_name, contact.last_name].filter(Boolean).join(" ") : null;

  return (
    <AppShell role={profile?.role} userName={profile?.full_name} orgPerms={orgPerms}>
      <AppHeader
        title={opp.name}
        subtitle={pipeline ? `${pipeline.name} pipeline` : "Opportunity"}
        backHref="/crm/pipeline"
      />

      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 space-y-6">
        {/* Top summary */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-slate-900">{formatCurrency(opp.value_estimate)}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${
                    STATUS_STYLE[opp.status] ?? "bg-slate-100 text-slate-600"
                  }`}
                >
                  {opp.status}
                </span>
                {opp.probability != null && (
                  <span className="text-xs text-slate-500 tabular-nums">{opp.probability}% probability</span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Stage
              </label>
              <StageMoveSelect
                opportunityId={opp.id}
                currentStageId={opp.stage_id}
                stages={pipelineStages.map((s) => ({ id: s.id, name: s.name }))}
              />
              {stage?.color && (
                <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                  {stage.is_won ? "Won stage" : stage.is_lost ? "Lost stage" : "In progress"}
                </span>
              )}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: linked records */}
          <div className="lg:col-span-1 space-y-4">
            {/* Contact */}
            <section className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Primary contact</h3>
              {contact ? (
                <Link
                  href={`/crm/contacts/${contact.id}`}
                  className="block p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <p className="font-semibold text-slate-900 text-sm">{contactName}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {contact.email_primary ?? "no email"}
                    {contact.phone_primary && ` · ${contact.phone_primary}`}
                  </p>
                  <p className="text-[11px] text-[#00929C] mt-1.5 font-medium">View contact →</p>
                </Link>
              ) : (
                <p className="text-sm text-slate-400 italic">No contact linked.</p>
              )}
            </section>

            {/* Household */}
            <section className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Household</h3>
              {household ? (
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{household.name}</p>
                  <p className="text-xs text-slate-500 mt-1 capitalize">{household.lifecycle_stage}</p>
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">No household linked yet.</p>
              )}
            </section>

            {/* Owner */}
            <section className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Owner</h3>
              {owner ? (
                <p className="font-semibold text-slate-900 text-sm">{owner.full_name}</p>
              ) : (
                <p className="text-sm text-slate-400 italic">Unassigned</p>
              )}
            </section>
          </div>

          {/* Right: details */}
          <div className="lg:col-span-2 space-y-4">
            {/* Lost reason callout — only when lost and reason is still the placeholder */}
            {opp.status === "lost" && opp.lost_reason === "needs_reason" && (
              <LostReasonForm opportunityId={opp.id} />
            )}

            {/* Details grid — inline-editable */}
            <section className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Details</h3>
                <span className="text-[10px] text-slate-400">Click any value to edit</span>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
                <InlineEdit
                  recordType="opportunity"
                  recordId={opp.id}
                  field="source"
                  value={opp.source ?? null}
                  fieldType="select"
                  options={SOURCE_OPTIONS}
                  label="Source"
                />
                <InlineEdit
                  recordType="opportunity"
                  recordId={opp.id}
                  field="interest_category"
                  value={opp.interest_category ?? null}
                  fieldType="select"
                  options={INTEREST_OPTIONS}
                  label="Interest"
                />
                <InlineEdit
                  recordType="opportunity"
                  recordId={opp.id}
                  field="value_estimate"
                  value={opp.value_estimate ?? null}
                  fieldType="currency"
                  label="Estimated value"
                  placeholder="12500"
                />
                <InlineEdit
                  recordType="opportunity"
                  recordId={opp.id}
                  field="value_actual"
                  value={opp.value_actual ?? null}
                  fieldType="currency"
                  label="Actual value"
                  placeholder="(set on close)"
                />
                <InlineEdit
                  recordType="opportunity"
                  recordId={opp.id}
                  field="expected_close_date"
                  value={opp.expected_close_date ?? null}
                  fieldType="date"
                  label="Expected close"
                />
                <div>
                  <dt className="text-[11px] text-slate-500 uppercase tracking-wide">Created</dt>
                  <dd className="font-medium text-slate-900 mt-0.5">{formatDate(opp.created_at)}</dd>
                </div>
                {opp.won_at && (
                  <div>
                    <dt className="text-[11px] text-slate-500 uppercase tracking-wide">Won at</dt>
                    <dd className="font-medium text-green-700 mt-0.5">{formatDate(opp.won_at)}</dd>
                  </div>
                )}
                {opp.lost_at && (
                  <div>
                    <dt className="text-[11px] text-slate-500 uppercase tracking-wide">Lost at</dt>
                    <dd className="font-medium text-red-700 mt-0.5">{formatDate(opp.lost_at)}</dd>
                  </div>
                )}
              </dl>

              {/* Show the captured lost reason once a real one is set
                  (skip the "needs_reason" placeholder — the LostReasonForm
                  callout above handles that case). */}
              {opp.lost_reason && opp.lost_reason !== "needs_reason" && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <dt className="text-[11px] text-slate-500 uppercase tracking-wide">Lost reason</dt>
                  <dd className="text-sm text-slate-700 mt-1 capitalize">{opp.lost_reason.replace(/_/g, " ")}</dd>
                  {opp.lost_notes && (
                    <p className="text-sm text-slate-600 mt-1 italic">{opp.lost_notes}</p>
                  )}
                </div>
              )}
            </section>

            {/* Tasks for this opportunity */}
            <TaskList
              opportunityId={opp.id}
              title="Tasks"
              hideParentLinks
              emptyDescription="No open tasks for this opportunity. Add one above."
            />

            {/* Activities */}
            <ActivityTimeline opportunityId={opp.id} />

            {/* Notes */}
            {opp.notes && (
              <section className="bg-white rounded-2xl border border-slate-200">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">Notes</h3>
                </div>
                <div className="p-5 text-sm text-slate-700 whitespace-pre-wrap">{opp.notes}</div>
              </section>
            )}
          </div>
        </div>
      </main>

      {/* Live updates for this opportunity's activities + tasks. */}
      <RealtimeRefresher tables={["activities", "tasks", "opportunities"]} />
    </AppShell>
  );
}
