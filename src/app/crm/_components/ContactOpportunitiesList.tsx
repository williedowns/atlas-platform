import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

interface ContactOpportunitiesListProps {
  contactId: string;
  /** Also include opps attached to the contact's household. Defaults to true. */
  householdId?: string | null;
}

interface OppRow {
  id: string;
  name: string;
  status: string;
  value_estimate: number | null;
  expected_close_date: string | null;
  primary_contact_id: string | null;
  pipeline: { name: string } | null;
  stage: { name: string; color: string | null; is_won: boolean; is_lost: boolean } | null;
}

function formatCurrency(amount: number | null): string {
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

export default async function ContactOpportunitiesList({
  contactId,
  householdId,
}: ContactOpportunitiesListProps) {
  const supabase = await createClient();

  // Direct match
  const { data: directRaw } = await supabase
    .from("opportunities")
    .select(`
      id, name, status, value_estimate, expected_close_date, primary_contact_id,
      pipeline:pipelines(name),
      stage:pipeline_stages!stage_id(name, color, is_won, is_lost)
    `)
    .eq("primary_contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(50);

  // Household-level (only when contact is in a household — these are deals
  // attached to the household but whose primary_contact_id may be someone
  // else in the household, e.g. spouse)
  let householdRaw: unknown[] = [];
  if (householdId) {
    const { data } = await supabase
      .from("opportunities")
      .select(`
        id, name, status, value_estimate, expected_close_date, primary_contact_id,
        pipeline:pipelines(name),
        stage:pipeline_stages!stage_id(name, color, is_won, is_lost)
      `)
      .eq("household_id", householdId)
      .neq("primary_contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(50);
    householdRaw = data ?? [];
  }

  const direct = (directRaw ?? []) as unknown as OppRow[];
  const household = householdRaw as unknown as OppRow[];

  const totalOpen = [...direct, ...household].filter((o) => o.status === "open");
  const totalOpenValue = totalOpen.reduce((s, o) => s + (o.value_estimate ?? 0), 0);
  const totalCount = direct.length + household.length;

  return (
    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Opportunities</h3>
          <p className="text-[11px] text-slate-500">
            {totalCount === 0
              ? "No deals yet"
              : `${totalCount} total · ${totalOpen.length} open · ${formatCurrency(totalOpenValue)} pipeline`}
          </p>
        </div>
        <Link
          href={`/crm/opportunities/new?contact_id=${contactId}`}
          className="text-[11px] font-semibold text-[#00929C] hover:underline"
        >
          + New deal
        </Link>
      </div>

      {totalCount === 0 ? (
        <div className="p-5 text-center text-sm text-slate-400 italic">
          No opportunities yet. Click "+ New deal" to create one.
        </div>
      ) : (
        <div>
          {direct.length > 0 && (
            <div>
              {household.length > 0 && (
                <div className="px-5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Their deals ({direct.length})
                </div>
              )}
              <ul className="divide-y divide-slate-100">
                {direct.map((o) => (
                  <OppRowItem key={o.id} opp={o} />
                ))}
              </ul>
            </div>
          )}
          {household.length > 0 && (
            <div>
              <div className="px-5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Household deals ({household.length})
                <span className="font-normal normal-case ml-2 text-slate-400">— attached via partner/spouse</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {household.map((o) => (
                  <OppRowItem key={o.id} opp={o} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function OppRowItem({ opp }: { opp: OppRow }) {
  return (
    <li>
      <Link
        href={`/crm/opportunities/${opp.id}`}
        className="flex items-start justify-between px-4 py-3 hover:bg-slate-50 transition-colors group gap-3"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm text-slate-900 group-hover:text-[#00929C] transition-colors truncate">
              {opp.name}
            </p>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${STATUS_STYLE[opp.status] ?? STATUS_STYLE.open}`}>
              {opp.status}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {opp.stage?.color && (
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: opp.stage.color }} />
            )}
            <p className="text-[11px] text-slate-500 truncate">
              {opp.pipeline?.name}
              {opp.stage?.name && ` · ${opp.stage.name}`}
              {opp.expected_close_date && ` · close ${new Date(opp.expected_close_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
            </p>
          </div>
        </div>
        <span className="text-sm font-bold text-slate-900 tabular-nums flex-shrink-0">
          {formatCurrency(opp.value_estimate)}
        </span>
      </Link>
    </li>
  );
}
