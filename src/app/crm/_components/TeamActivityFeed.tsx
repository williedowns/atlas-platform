import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

interface TeamActivityFeedProps {
  /** How far back to look (hours). Defaults to 24. */
  hours?: number;
  /** Max rows to render. Defaults to 30. */
  limit?: number;
  /** Title override. */
  title?: string;
}

interface ActivityRow {
  id: string;
  type: string;
  direction: string | null;
  body: string | null;
  ai_summary: string | null;
  occurred_at: string;
  contact_id: string | null;
  opportunity_id: string | null;
  household_id: string | null;
  created_by: string | null;
  created_by_profile: { id: string; full_name: string | null } | null;
  contact: { id: string; first_name: string; last_name: string | null } | null;
  opportunity: { id: string; name: string } | null;
}

const TYPE_STYLE: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  note: { label: "Note", color: "text-amber-700", bg: "bg-amber-50", icon: <Dot /> },
  call: { label: "Call", color: "text-blue-700", bg: "bg-blue-50", icon: <Dot /> },
  sms: { label: "SMS", color: "text-purple-700", bg: "bg-purple-50", icon: <Dot /> },
  email: { label: "Email", color: "text-indigo-700", bg: "bg-indigo-50", icon: <Dot /> },
  meeting: { label: "Meeting", color: "text-teal-700", bg: "bg-teal-50", icon: <Dot /> },
  task: { label: "Task", color: "text-slate-700", bg: "bg-slate-100", icon: <Dot /> },
  system: { label: "System", color: "text-slate-500", bg: "bg-slate-50", icon: <Dot /> },
  stage_change: { label: "Stage", color: "text-emerald-700", bg: "bg-emerald-50", icon: <Arrow /> },
  page_view: { label: "Visit", color: "text-cyan-700", bg: "bg-cyan-50", icon: <Dot /> },
  form_submit: { label: "Form", color: "text-pink-700", bg: "bg-pink-50", icon: <Dot /> },
};

function Dot() {
  return <span className="w-1.5 h-1.5 rounded-full bg-current" />;
}
function Arrow() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function TeamActivityFeed({
  hours = 24,
  limit = 30,
  title = "Team activity",
}: TeamActivityFeedProps) {
  const supabase = await createClient();

  const since = new Date();
  since.setHours(since.getHours() - hours);

  const { data: actsRaw } = await supabase
    .from("activities")
    .select(`
      id, type, direction, body, ai_summary, occurred_at,
      contact_id, opportunity_id, household_id, created_by,
      created_by_profile:profiles!created_by(id, full_name),
      contact:contacts!contact_id(id, first_name, last_name),
      opportunity:opportunities!opportunity_id(id, name)
    `)
    .gte("occurred_at", since.toISOString())
    .order("occurred_at", { ascending: false })
    .limit(limit);

  const activities = (actsRaw ?? []) as unknown as ActivityRow[];

  // Count distinct contributors for the header
  const contributors = new Set<string>();
  for (const a of activities) {
    if (a.created_by) contributors.add(a.created_by);
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <p className="text-[11px] text-slate-500">
            {activities.length === 0
              ? `No team activity in the last ${hours}h`
              : `${activities.length} event${activities.length === 1 ? "" : "s"} · ${contributors.size} ${contributors.size === 1 ? "rep" : "reps"} active · last ${hours}h`}
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          live
        </span>
      </div>

      {activities.length === 0 ? (
        <div className="p-5 text-center text-sm text-slate-400 italic">
          Nothing logged yet today. Activity from any rep — calls, notes, stage moves, tasks completed — shows up here.
        </div>
      ) : (
        <ol className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
          {activities.map((a) => {
            const style = TYPE_STYLE[a.type] ?? TYPE_STYLE.system;
            const author = a.created_by_profile?.full_name ?? "Someone";
            const authorInitials = a.created_by_profile?.full_name
              ? a.created_by_profile.full_name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)
              : "?";
            const contactName = a.contact
              ? [a.contact.first_name, a.contact.last_name].filter(Boolean).join(" ")
              : null;
            const href = a.opportunity_id
              ? `/crm/opportunities/${a.opportunity_id}`
              : a.contact_id
                ? `/crm/contacts/${a.contact_id}`
                : a.household_id
                  ? `/crm/households/${a.household_id}`
                  : null;

            return (
              <li key={a.id}>
                <Link
                  href={href ?? "#"}
                  className={`flex items-start gap-3 px-4 py-3 transition-colors group ${
                    href ? "hover:bg-slate-50" : "cursor-default"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full ${style.bg} ${style.color} flex items-center justify-center flex-shrink-0`}
                    aria-label={style.label}
                  >
                    {style.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-slate-900">{author}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wide ${style.color}`}>
                        {style.label}
                      </span>
                      {a.direction && (
                        <span className="text-[10px] text-slate-500">
                          {a.direction === "outbound" ? "→ outbound" : "← inbound"}
                        </span>
                      )}
                      {contactName && (
                        <span className="text-[11px] text-slate-600">with <span className="font-semibold">{contactName}</span></span>
                      )}
                      {a.opportunity && (
                        <span className="text-[11px] text-slate-600">on <span className="font-semibold truncate">{a.opportunity.name}</span></span>
                      )}
                      <span className="ml-auto text-[10px] text-slate-400 flex-shrink-0">
                        {relativeTime(a.occurred_at)}
                      </span>
                    </div>
                    {a.body && (
                      <p className="text-[12px] text-slate-600 mt-0.5 line-clamp-1">{a.body}</p>
                    )}
                  </div>
                  <span
                    className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-[9px] font-bold flex items-center justify-center flex-shrink-0"
                    title={author}
                  >
                    {authorInitials}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
