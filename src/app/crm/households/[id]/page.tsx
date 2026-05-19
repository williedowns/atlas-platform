export const dynamic = "force-dynamic";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { formatDate } from "@/lib/utils";
import ActivityTimeline from "../../_components/ActivityTimeline";
import InlineEdit from "../../_components/InlineEdit";
import RealtimeRefresher from "../../_components/RealtimeRefresher";

const HOUSEHOLD_TYPE_OPTIONS = [
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
  { value: "hoa", label: "HOA" },
  { value: "referral", label: "Referral partner" },
];

const HOUSEHOLD_LIFECYCLE_OPTIONS = [
  { value: "lead", label: "Lead" },
  { value: "mql", label: "MQL" },
  { value: "sql", label: "SQL" },
  { value: "customer", label: "Customer" },
  { value: "inactive", label: "Inactive" },
];

const HOUSEHOLD_SOURCE_OPTIONS = [
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

const ROLE_LABEL: Record<string, string> = {
  primary: "Primary",
  partner: "Partner",
  child: "Child",
  other: "Other",
};

const ROLE_BG: Record<string, string> = {
  primary: "bg-[#00929C] text-white",
  partner: "bg-purple-100 text-purple-700",
  child: "bg-amber-100 text-amber-700",
  other: "bg-slate-100 text-slate-600",
};

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function CrmHouseholdDetailPage({
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

  const { data: household } = await supabase
    .from("households")
    .select(`
      id, name, household_type, lifecycle_stage, primary_address, city, state, zip,
      source, source_detail, score, marketing_eligible, last_activity_at, notes, created_at,
      owner:profiles!owner_id(id, full_name),
      primary_location:locations(id, name)
    `)
    .eq("id", id)
    .single();

  if (!household) notFound();

  // Members
  const { data: membersRaw } = await supabase
    .from("contacts")
    .select(`
      id, first_name, last_name, email_primary, phone_primary,
      role_in_household, last_activity_at, score
    `)
    .eq("household_id", id)
    .order("role_in_household", { ascending: true })
    .order("first_name", { ascending: true });

  const members = (membersRaw ?? []) as unknown as Array<{
    id: string;
    first_name: string;
    last_name: string | null;
    email_primary: string | null;
    phone_primary: string | null;
    role_in_household: string | null;
    last_activity_at: string | null;
    score: number;
  }>;

  // Opportunities for this household
  const { data: oppsRaw } = await supabase
    .from("opportunities")
    .select(`
      id, name, status, value_estimate, value_actual, expected_close_date,
      pipeline:pipelines(name),
      stage:pipeline_stages!stage_id(name, color, is_won, is_lost)
    `)
    .eq("household_id", id)
    .order("created_at", { ascending: false });

  const opps = (oppsRaw ?? []) as any[];

  const owner = (household.owner as any) ?? null;
  const primaryLocation = (household.primary_location as any) ?? null;
  const location = [household.city, household.state, household.zip].filter(Boolean).join(", ");

  const totalPipelineValue = opps
    .filter((o) => o.status === "open")
    .reduce((s, o) => s + (o.value_estimate ?? 0), 0);

  return (
    <AppShell role={profile?.role} userName={profile?.full_name} orgPerms={orgPerms}>
      <AppHeader
        title={household.name}
        subtitle={`${members.length} member${members.length === 1 ? "" : "s"} · ${household.lifecycle_stage}`}
        backHref="/crm/households"
      />

      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 space-y-6">
        {/* Top summary */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#00929C]/20 to-[#00929C]/5 flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7 text-[#00929C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-slate-900 truncate">{household.name}</h2>
                <p className="text-sm text-slate-500 mt-1 capitalize">
                  {household.household_type} · {household.lifecycle_stage}
                  {location && ` · ${location}`}
                </p>
                {primaryLocation?.name && (
                  <p className="text-xs text-slate-400 mt-0.5">Showroom: {primaryLocation.name}</p>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              {household.score > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#00929C]/10 text-[#00929C] text-xs font-bold tabular-nums">
                  Score {household.score}
                </span>
              )}
              {owner?.full_name && (
                <span className="text-xs text-slate-500">
                  Owner: <span className="font-medium text-slate-700">{owner.full_name}</span>
                </span>
              )}
              {totalPipelineValue > 0 && (
                <span className="text-xs text-slate-500 tabular-nums">
                  Pipeline: <span className="font-bold text-slate-900">{formatCurrency(totalPipelineValue)}</span>
                </span>
              )}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Members */}
          <div className="lg:col-span-1 space-y-4">
            <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">Members</h3>
                <span className="text-[11px] text-slate-400 tabular-nums">{members.length}</span>
              </div>
              {members.length === 0 ? (
                <div className="p-5 text-center text-sm text-slate-400 italic">
                  No contacts linked to this household yet.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {members.map((m) => {
                    const fullName = [m.first_name, m.last_name].filter(Boolean).join(" ");
                    const initials = ((m.first_name?.[0] ?? "") + (m.last_name?.[0] ?? "")).toUpperCase() || "?";
                    const roleKey = m.role_in_household ?? "other";
                    return (
                      <li key={m.id}>
                        <Link
                          href={`/crm/contacts/${m.id}`}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group"
                        >
                          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-semibold text-slate-600">{initials}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-slate-900 group-hover:text-[#00929C] transition-colors truncate text-sm">
                                {fullName}
                              </p>
                              {m.role_in_household && (
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${ROLE_BG[roleKey] ?? ROLE_BG.other}`}>
                                  {ROLE_LABEL[roleKey] ?? roleKey}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 truncate">
                              {m.email_primary ?? "no email"}
                            </p>
                            {m.phone_primary && (
                              <p className="text-[11px] text-slate-500 truncate">{m.phone_primary}</p>
                            )}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 leading-relaxed">
                To add a member: open any contact and click <span className="font-semibold">Link to household</span>, then pick this household.
              </div>
            </section>

            {/* Details — inline editable */}
            <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Details</h3>
                <span className="text-[10px] text-slate-400">Click to edit</span>
              </div>
              <div className="text-sm space-y-3">
                <InlineEdit
                  recordType="household"
                  recordId={household.id}
                  field="name"
                  value={household.name ?? null}
                  label="Name"
                  allowClear={false}
                />
                <InlineEdit
                  recordType="household"
                  recordId={household.id}
                  field="household_type"
                  value={household.household_type ?? null}
                  fieldType="select"
                  options={HOUSEHOLD_TYPE_OPTIONS}
                  label="Type"
                  allowClear={false}
                />
                <InlineEdit
                  recordType="household"
                  recordId={household.id}
                  field="lifecycle_stage"
                  value={household.lifecycle_stage ?? null}
                  fieldType="select"
                  options={HOUSEHOLD_LIFECYCLE_OPTIONS}
                  label="Lifecycle stage"
                  allowClear={false}
                />
                <InlineEdit
                  recordType="household"
                  recordId={household.id}
                  field="primary_address"
                  value={household.primary_address ?? null}
                  label="Address"
                  placeholder="123 Main St"
                />
                <div className="grid grid-cols-3 gap-2">
                  <InlineEdit
                    recordType="household"
                    recordId={household.id}
                    field="city"
                    value={household.city ?? null}
                    label="City"
                  />
                  <InlineEdit
                    recordType="household"
                    recordId={household.id}
                    field="state"
                    value={household.state ?? null}
                    label="State"
                  />
                  <InlineEdit
                    recordType="household"
                    recordId={household.id}
                    field="zip"
                    value={household.zip ?? null}
                    label="ZIP"
                  />
                </div>
                <InlineEdit
                  recordType="household"
                  recordId={household.id}
                  field="source"
                  value={household.source ?? null}
                  fieldType="select"
                  options={HOUSEHOLD_SOURCE_OPTIONS}
                  label="Source"
                />
                <InlineEdit
                  recordType="household"
                  recordId={household.id}
                  field="score"
                  value={household.score ?? null}
                  fieldType="number"
                  label="Score"
                />
                <div>
                  <p className="text-[11px] text-slate-500 uppercase tracking-wide">Marketing eligible</p>
                  <p className="text-slate-700">{household.marketing_eligible ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 uppercase tracking-wide">Created</p>
                  <p className="text-slate-700">{formatDate(household.created_at)}</p>
                </div>
              </div>
            </section>
          </div>

          {/* Right: Opportunities + Activities */}
          <div className="lg:col-span-2 space-y-4">
            {/* Opportunities */}
            <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">Opportunities</h3>
                <Link
                  href={`/crm/opportunities/new`}
                  className="text-[11px] font-semibold text-[#00929C] hover:underline"
                >
                  + New
                </Link>
              </div>
              {opps.length === 0 ? (
                <div className="p-5 text-center text-sm text-slate-400 italic">
                  No opportunities yet for this household.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {opps.map((o) => {
                    const stage = o.stage as any;
                    const pipeline = o.pipeline as any;
                    return (
                      <li key={o.id}>
                        <Link
                          href={`/crm/opportunities/${o.id}`}
                          className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors group"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-900 group-hover:text-[#00929C] transition-colors truncate text-sm">
                              {o.name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {stage?.color && (
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                              )}
                              <p className="text-[11px] text-slate-500 truncate">
                                {pipeline?.name}{stage?.name && ` · ${stage.name}`}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-bold text-slate-900 tabular-nums flex-shrink-0 ml-3">
                            {formatCurrency(o.value_estimate)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Unified activity timeline */}
            <ActivityTimeline householdId={household.id} />

            {/* Notes */}
            {household.notes && (
              <section className="bg-white rounded-2xl border border-slate-200">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">Notes</h3>
                </div>
                <div className="p-5 text-sm text-slate-700 whitespace-pre-wrap">{household.notes}</div>
              </section>
            )}
          </div>
        </div>
      </main>

      {/* Live updates for this household's activities + opportunities. */}
      <RealtimeRefresher tables={["activities", "opportunities"]} />
    </AppShell>
  );
}
