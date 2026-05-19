export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import DraggableKanban from "./DraggableKanban";
import RealtimeRefresher from "../_components/RealtimeRefresher";

interface Stage {
  id: string;
  name: string;
  display_order: number;
  probability: number;
  color: string | null;
  is_won: boolean;
  is_lost: boolean;
}

interface Opportunity {
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

function formatCurrency(amount: number | null): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function buildLink(params: { pipeline?: string; mine?: string }, currentPipeline: string, currentMine: boolean) {
  const out = new URLSearchParams();
  const pipeline = params.pipeline ?? currentPipeline;
  const mine = params.mine ?? (currentMine ? "1" : null);
  if (pipeline && pipeline !== "Retail Sales") out.set("pipeline", pipeline);
  if (mine === "1") out.set("mine", "1");
  const qs = out.toString();
  return qs ? `/crm/pipeline?${qs}` : "/crm/pipeline";
}

export default async function CrmPipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ pipeline?: string; mine?: string }>;
}) {
  const { pipeline: pipelineParam, mine: mineParam } = await searchParams;

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

  // Load all pipelines for the tab strip
  const { data: pipelinesRaw } = await supabase
    .from("pipelines")
    .select("id, name, type, is_default")
    .order("name");

  const pipelines = pipelinesRaw ?? [];

  // Resolve active pipeline (URL param > Retail Sales default > first available)
  const activePipelineName = pipelineParam ?? "Retail Sales";
  const activePipeline =
    pipelines.find((p) => p.name === activePipelineName) ??
    pipelines.find((p) => p.is_default) ??
    pipelines[0];

  if (!activePipeline) {
    return (
      <AppShell role={profile?.role} userName={profile?.full_name} orgPerms={orgPerms}>
        <AppHeader title="Pipeline" backHref="/crm" />
        <main className="max-w-4xl mx-auto pb-24">
          <EmptyState
            title="No pipelines configured"
            description="Re-run migration 044 to seed the default pipelines."
            action={{ label: "Back to CRM", href: "/crm" }}
          />
        </main>
      </AppShell>
    );
  }

  const mineOnly = mineParam === "1";

  const { data: stagesRaw } = await supabase
    .from("pipeline_stages")
    .select("id, name, display_order, probability, color, is_won, is_lost")
    .eq("pipeline_id", activePipeline.id)
    .order("display_order");

  const stages = (stagesRaw ?? []) as Stage[];

  let oppsQuery = supabase
    .from("opportunities")
    .select(`
      id, name, stage_id, value_estimate, source, interest_category, status,
      primary_contact_id, owner_id,
      primary_contact:contacts!primary_contact_id(id, first_name, last_name),
      owner:profiles!owner_id(id, full_name)
    `)
    .eq("pipeline_id", activePipeline.id)
    .neq("status", "abandoned")
    .order("created_at", { ascending: false })
    .limit(500);

  if (mineOnly) {
    oppsQuery = oppsQuery.eq("owner_id", user.id);
  }

  const { data: oppsRaw } = await oppsQuery;
  const opps = (oppsRaw ?? []) as unknown as Opportunity[];

  // (DraggableKanban handles stage grouping client-side now.)

  const totalValue = opps
    .filter((o) => o.status === "open")
    .reduce((s, o) => s + (o.value_estimate ?? 0), 0);

  return (
    <AppShell role={profile?.role} userName={profile?.full_name} orgPerms={orgPerms}>
      <AppHeader
        title="Pipeline"
        subtitle={`${activePipeline.name} · ${opps.length} ${mineOnly ? "mine" : "open"} · ${formatCurrency(totalValue)} pipeline`}
        backHref="/crm"
        actions={
          <Link
            href={`/crm/opportunities/new?pipeline_id=${activePipeline.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00929C] hover:bg-[#007a82] text-white text-xs font-semibold transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            New Opportunity
          </Link>
        }
      />

      {/* Pipeline tab strip + filter chips */}
      <div className="bg-white border-b border-slate-200 sticky top-[65px] z-10">
        <div className="flex items-center gap-1 px-4 pt-3 overflow-x-auto scrollbar-hide">
          {pipelines.map((p) => {
            const isActive = p.id === activePipeline.id;
            return (
              <Link
                key={p.id}
                href={buildLink({ pipeline: p.name }, p.name, mineOnly)}
                className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? "text-[#00929C] border-[#00929C]"
                    : "text-slate-500 border-transparent hover:text-slate-900"
                }`}
              >
                {p.name}
                <span className="ml-1.5 text-[10px] text-slate-400 uppercase tracking-wide">{p.type}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-slate-100">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Filters:</span>
          <Link
            href={buildLink({ mine: mineOnly ? undefined : "1" }, activePipeline.name, !mineOnly)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              mineOnly
                ? "bg-[#010F21] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {mineOnly ? "✓ My deals only" : "My deals only"}
          </Link>
          {mineOnly && (
            <Link
              href={buildLink({ mine: undefined }, activePipeline.name, false)}
              className="text-[11px] text-slate-500 hover:text-slate-900 underline"
            >
              Show all
            </Link>
          )}
        </div>
      </div>

      <main className="overflow-x-auto pb-24">
        {stages.length === 0 ? (
          <EmptyState
            title="No stages on this pipeline"
            description={`The "${activePipeline.name}" pipeline has no stages yet.`}
            action={{ label: "Back to CRM", href: "/crm" }}
          />
        ) : (
          <DraggableKanban
            pipelineId={activePipeline.id}
            stages={stages}
            opportunities={opps}
          />
        )}
      </main>

      {/* Subscribe to opportunities changes — Rep A's drag triggers
          Rep B's board to re-fetch within ~300ms. RLS is enforced on
          the broadcast side; each client only sees their org's changes. */}
      <RealtimeRefresher tables={["opportunities"]} />
    </AppShell>
  );
}
