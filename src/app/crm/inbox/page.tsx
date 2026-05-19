export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import RealtimeRefresher from "../_components/RealtimeRefresher";

// Channels reps care about — what they expect to see in an "Inbox".
const CHANNEL_TYPES = ["call", "sms", "email", "voicemail", "note"] as const;
type ChannelType = (typeof CHANNEL_TYPES)[number];

const CHANNEL_LABEL: Record<ChannelType, string> = {
  call: "Calls",
  sms: "SMS",
  email: "Email",
  voicemail: "Voicemails",
  note: "Notes",
};

const CHANNEL_ICON: Record<string, React.ReactNode> = {
  call: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  sms: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  email: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  voicemail: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 11-4 0 2 2 0 014 0zM23 13a2 2 0 11-4 0 2 2 0 014 0zM5 13h14" />
    </svg>
  ),
  note: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
};

const CHANNEL_COLOR: Record<string, string> = {
  call: "text-blue-700 bg-blue-50",
  sms: "text-purple-700 bg-purple-50",
  email: "text-indigo-700 bg-indigo-50",
  voicemail: "text-amber-700 bg-amber-50",
  note: "text-slate-700 bg-slate-100",
};

interface ActivityRow {
  id: string;
  type: string;
  direction: string | null;
  body: string | null;
  occurred_at: string;
  contact_id: string;
  contact: {
    id: string;
    first_name: string;
    last_name: string | null;
    email_primary: string | null;
    phone_primary: string | null;
  } | null;
}

interface ContactThread {
  contactId: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  initials: string;
  latestActivity: ActivityRow;
  count: number;
  channels: Set<string>;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function CrmInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string; q?: string; mine?: string }>;
}) {
  const { channel, q, mine } = await searchParams;

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
  const mineOnly = mine === "1";

  // Pull recent activities of conversation channels, with the contact joined.
  // We then group client-side by contact_id to build threads.
  let activityQuery = supabase
    .from("activities")
    .select(`
      id, type, direction, body, occurred_at, contact_id,
      contact:contacts!contact_id(id, first_name, last_name, email_primary, phone_primary, owner_id)
    `)
    .in("type", CHANNEL_TYPES as unknown as string[])
    .not("contact_id", "is", null)
    .order("occurred_at", { ascending: false })
    .limit(500);

  if (channel && CHANNEL_TYPES.includes(channel as ChannelType)) {
    activityQuery = activityQuery.eq("type", channel);
  }

  const { data: actsRaw } = await activityQuery;
  let activities = (actsRaw ?? []) as unknown as ActivityRow[];

  // Owner filter (Mine = activities where contact's owner is me OR I logged it)
  if (mineOnly) {
    activities = activities.filter(
      (a) => (a.contact as any)?.owner_id === user.id
    );
  }

  // Search by contact name
  if (q && q.trim()) {
    const needle = q.trim().toLowerCase();
    activities = activities.filter((a) => {
      const c = a.contact;
      if (!c) return false;
      const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.toLowerCase();
      const email = (c.email_primary ?? "").toLowerCase();
      const phone = (c.phone_primary ?? "").toLowerCase();
      return name.includes(needle) || email.includes(needle) || phone.includes(needle);
    });
  }

  // Group by contact_id
  const threadsMap = new Map<string, ContactThread>();
  for (const a of activities) {
    if (!a.contact) continue;
    const cid = a.contact_id;
    const existing = threadsMap.get(cid);
    const fullName = [a.contact.first_name, a.contact.last_name].filter(Boolean).join(" ") || "Unnamed";
    const initials = ((a.contact.first_name?.[0] ?? "") + (a.contact.last_name?.[0] ?? "")).toUpperCase() || "?";

    if (!existing) {
      threadsMap.set(cid, {
        contactId: cid,
        contactName: fullName,
        contactEmail: a.contact.email_primary,
        contactPhone: a.contact.phone_primary,
        initials,
        latestActivity: a,
        count: 1,
        channels: new Set([a.type]),
      });
    } else {
      existing.count += 1;
      existing.channels.add(a.type);
      // activities are pre-sorted DESC by occurred_at, so first wins
    }
  }

  const threads = Array.from(threadsMap.values()).sort(
    (a, b) => new Date(b.latestActivity.occurred_at).getTime() - new Date(a.latestActivity.occurred_at).getTime()
  );

  const activeChannel = (channel && CHANNEL_TYPES.includes(channel as ChannelType)) ? channel : "all";

  function buildHref(params: { channel?: string; mine?: string; q?: string }) {
    const out = new URLSearchParams();
    const ch = params.channel ?? activeChannel;
    const m = params.mine ?? (mineOnly ? "1" : null);
    const search = params.q ?? q;
    if (ch && ch !== "all") out.set("channel", ch);
    if (m === "1") out.set("mine", "1");
    if (search) out.set("q", search);
    const qs = out.toString();
    return qs ? `/crm/inbox?${qs}` : "/crm/inbox";
  }

  return (
    <AppShell role={profile?.role} userName={profile?.full_name} orgPerms={orgPerms}>
      <AppHeader
        title="Inbox"
        subtitle={`${threads.length} ${threads.length === 1 ? "conversation" : "conversations"} · ${activities.length} ${activities.length === 1 ? "message" : "messages"}`}
        backHref="/crm"
      />

      {/* Search + channel + owner filters */}
      <div className="bg-white border-b border-slate-100 sticky top-[65px] z-10">
        <form className="flex items-center gap-2 px-4 py-3" action="/crm/inbox" method="get">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search by contact name, email, or phone…"
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C]"
            />
          </div>
          {activeChannel !== "all" && <input type="hidden" name="channel" value={activeChannel} />}
          {mineOnly && <input type="hidden" name="mine" value="1" />}
          <button
            type="submit"
            className="px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            Search
          </button>
          {(q || activeChannel !== "all" || mineOnly) && (
            <Link
              href="/crm/inbox"
              className="px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              Clear
            </Link>
          )}
        </form>

        <div className="flex items-center gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
          <Link
            href={buildHref({ channel: "all" })}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
              activeChannel === "all"
                ? "bg-[#010F21] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All channels
          </Link>
          {CHANNEL_TYPES.map((c) => (
            <Link
              key={c}
              href={buildHref({ channel: c })}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors flex items-center gap-1.5 ${
                activeChannel === c
                  ? "bg-[#010F21] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span className={activeChannel === c ? "text-white" : "text-slate-500"}>{CHANNEL_ICON[c]}</span>
              {CHANNEL_LABEL[c]}
            </Link>
          ))}

          <span className="w-px h-5 bg-slate-200 mx-1" />

          <Link
            href={buildHref({ mine: mineOnly ? undefined : "1" })}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
              mineOnly
                ? "bg-[#00929C] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {mineOnly ? "✓ My contacts" : "My contacts"}
          </Link>
        </div>
      </div>

      <main className="max-w-4xl mx-auto pb-24">
        {threads.length === 0 ? (
          q || activeChannel !== "all" || mineOnly ? (
            <EmptyState
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
              title="No conversations match those filters"
              description="Try a different channel, clear the search, or remove the 'My contacts' filter."
              action={{ label: "Clear filters", href: "/crm/inbox" }}
            />
          ) : (
            <EmptyState
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              }
              title="No conversations yet"
              description="Calls, SMS, emails, voicemails, and notes logged against any contact appear here grouped by person. When Phase 2 wires Twilio + Resend + OpenPhone, inbound messages flow in automatically. For now: open any contact, log a call or note, and it'll appear here."
              action={{ label: "Go to contacts", href: "/crm/contacts" }}
            />
          )
        ) : (
          <ul className="divide-y divide-slate-100 bg-white">
            {threads.map((t) => {
              const a = t.latestActivity;
              const channelStyle = CHANNEL_COLOR[a.type] ?? CHANNEL_COLOR.note;
              const directionMark = a.direction === "inbound" ? "←" : a.direction === "outbound" ? "→" : "·";

              return (
                <li key={t.contactId}>
                  <Link
                    href={`/crm/contacts/${t.contactId}`}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-slate-700">{t.initials}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900 group-hover:text-[#00929C] transition-colors truncate">
                          {t.contactName}
                        </p>
                        {t.count > 1 && (
                          <span className="text-[10px] font-bold text-slate-500 tabular-nums">
                            · {t.count}
                          </span>
                        )}
                        <span className="ml-auto text-[11px] text-slate-400 flex-shrink-0">
                          {relativeTime(a.occurred_at)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${channelStyle}`}
                        >
                          {CHANNEL_ICON[a.type]}
                          {a.type}
                        </span>
                        {a.direction && (
                          <span className="text-[10px] font-medium text-slate-500">{directionMark} {a.direction}</span>
                        )}
                      </div>

                      {a.body && (
                        <p className="text-sm text-slate-600 mt-1 line-clamp-1">
                          {a.body}
                        </p>
                      )}

                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {t.contactEmail ?? "no email"}
                        {t.contactPhone && ` · ${t.contactPhone}`}
                      </p>
                    </div>

                    <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-500 mt-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {/* Live updates — when anyone logs a new call/SMS/email, the inbox refreshes. */}
      <RealtimeRefresher tables={["activities"]} />
    </AppShell>
  );
}
