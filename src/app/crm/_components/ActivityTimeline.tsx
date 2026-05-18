import { createClient } from "@/lib/supabase/server";
import LogActivityForm from "./LogActivityForm";

interface ActivityTimelineProps {
  contactId?: string | null;
  opportunityId?: string | null;
  householdId?: string | null;
  /** Max activities to load. Defaults to 50. */
  limit?: number;
}

interface ActivityRow {
  id: string;
  type: string;
  direction: string | null;
  body: string | null;
  ai_summary: string | null;
  duration_seconds: number | null;
  occurred_at: string;
  created_by: string | null;
  created_by_profile: { id: string; full_name: string | null } | null;
}

const TYPE_STYLE: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  note: {
    label: "Note",
    color: "text-amber-700",
    bg: "bg-amber-50",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  call: {
    label: "Call",
    color: "text-blue-700",
    bg: "bg-blue-50",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
  },
  sms: {
    label: "SMS",
    color: "text-purple-700",
    bg: "bg-purple-50",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  email: {
    label: "Email",
    color: "text-indigo-700",
    bg: "bg-indigo-50",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  meeting: {
    label: "Meeting",
    color: "text-teal-700",
    bg: "bg-teal-50",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  task: {
    label: "Task",
    color: "text-slate-700",
    bg: "bg-slate-100",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  system: {
    label: "System",
    color: "text-slate-500",
    bg: "bg-slate-50",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  stage_change: {
    label: "Stage move",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
    ),
  },
};

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
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ActivityTimeline({
  contactId,
  opportunityId,
  householdId,
  limit = 50,
}: ActivityTimelineProps) {
  if (!contactId && !opportunityId && !householdId) {
    return null;
  }

  const supabase = await createClient();

  let query = supabase
    .from("activities")
    .select(`
      id, type, direction, body, ai_summary, duration_seconds, occurred_at, created_by,
      created_by_profile:profiles!created_by(id, full_name)
    `)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (contactId) query = query.eq("contact_id", contactId);
  else if (opportunityId) query = query.eq("opportunity_id", opportunityId);
  else if (householdId) query = query.eq("household_id", householdId);

  const { data: activitiesRaw } = await query;
  const activities = (activitiesRaw ?? []) as unknown as ActivityRow[];

  return (
    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Activity timeline</h3>
          <p className="text-[11px] text-slate-500">
            {activities.length === 0
              ? "No activity yet — log the first one below."
              : `${activities.length} ${activities.length === 1 ? "entry" : "entries"}`}
          </p>
        </div>
      </div>

      {/* Inline log form */}
      <LogActivityForm
        contactId={contactId ?? null}
        opportunityId={opportunityId ?? null}
        householdId={householdId ?? null}
      />

      {/* Timeline list */}
      {activities.length === 0 ? (
        <div className="p-5 text-center text-sm text-slate-400 italic">
          Start by logging a call, note, or email above. Future inbound SMS / email / call data will land here automatically.
        </div>
      ) : (
        <ol className="divide-y divide-slate-100">
          {activities.map((a) => {
            const style = TYPE_STYLE[a.type] ?? TYPE_STYLE.system;
            const authorInitials = a.created_by_profile?.full_name
              ? a.created_by_profile.full_name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)
              : null;
            return (
              <li key={a.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${style.bg} ${style.color}`}
                    aria-label={style.label}
                  >
                    {style.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] font-semibold uppercase tracking-wide ${style.color}`}>
                        {style.label}
                      </span>
                      {a.direction && (
                        <span className="text-[10px] font-medium text-slate-500">
                          {a.direction === "outbound" ? "→ outbound" : "← inbound"}
                        </span>
                      )}
                      {a.duration_seconds != null && a.duration_seconds > 0 && (
                        <span className="text-[10px] font-medium text-slate-500 tabular-nums">
                          {Math.round(a.duration_seconds / 60)} min
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400" title={absoluteTime(a.occurred_at)}>
                        · {relativeTime(a.occurred_at)}
                      </span>
                      {a.created_by_profile?.full_name && (
                        <span className="text-[10px] text-slate-400">· {a.created_by_profile.full_name}</span>
                      )}
                    </div>
                    {a.body && (
                      <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{a.body}</p>
                    )}
                    {a.ai_summary && (
                      <div className="mt-2 px-3 py-2 rounded-lg bg-[#00929C]/5 border border-[#00929C]/20">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#00929C] mb-1">
                          AI summary
                        </p>
                        <p className="text-xs text-slate-700">{a.ai_summary}</p>
                      </div>
                    )}
                  </div>
                  {authorInitials && (
                    <span
                      className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                      title={a.created_by_profile?.full_name ?? ""}
                    >
                      {authorInitials}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
