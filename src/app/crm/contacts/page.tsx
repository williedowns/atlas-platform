export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/utils";

interface ContactRow {
  id: string;
  first_name: string;
  last_name: string | null;
  email_primary: string | null;
  phone_primary: string | null;
  source: string | null;
  score: number;
  created_at: string;
  household_id: string | null;
  owner_id: string | null;
}

export default async function CrmContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; source?: string }>;
}) {
  const { q, source } = await searchParams;

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

  let query = supabase
    .from("contacts")
    .select("id, first_name, last_name, email_primary, phone_primary, source, score, created_at, household_id, owner_id")
    .order("created_at", { ascending: false })
    .limit(200);

  if (q && q.trim()) {
    const term = `%${q.trim()}%`;
    query = query.or(
      `first_name.ilike.${term},last_name.ilike.${term},email_primary.ilike.${term},phone_primary.ilike.${term}`
    );
  }

  if (source && source !== "all") {
    query = query.eq("source", source);
  }

  const { data: contactsRaw } = await query;
  const contacts = (contactsRaw ?? []) as ContactRow[];

  // Distinct sources for filter chips (computed from current result set; for
  // a small N this is fine — when N grows we'll want a separate facet query).
  const sources = Array.from(new Set(contacts.map((c) => c.source).filter(Boolean))) as string[];
  const activeSource = source ?? "all";

  return (
    <AppShell role={profile?.role} userName={profile?.full_name} orgPerms={orgPerms}>
      <AppHeader
        title="Contacts"
        subtitle={`${contacts.length} contact${contacts.length === 1 ? "" : "s"}`}
        backHref="/crm"
        actions={
          <Link
            href="/crm/contacts/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00929C] hover:bg-[#007a82] text-white text-xs font-semibold transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            New Contact
          </Link>
        }
      />

      {/* Search + filter strip */}
      <div className="bg-white border-b border-slate-100 sticky top-[65px] z-10">
        <form className="flex items-center gap-2 px-4 py-3" action="/crm/contacts" method="get">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search by name, email, or phone…"
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C]"
            />
          </div>
          {activeSource !== "all" && (
            <input type="hidden" name="source" value={activeSource} />
          )}
          <button
            type="submit"
            className="px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            Search
          </button>
          {(q || activeSource !== "all") && (
            <Link
              href="/crm/contacts"
              className="px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              Clear
            </Link>
          )}
        </form>

        {sources.length > 0 && (
          <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
            <Link
              href={q ? `/crm/contacts?q=${encodeURIComponent(q)}` : "/crm/contacts"}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
                activeSource === "all"
                  ? "bg-[#010F21] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All sources
            </Link>
            {sources.map((s) => (
              <Link
                key={s}
                href={`/crm/contacts?${q ? `q=${encodeURIComponent(q)}&` : ""}source=${encodeURIComponent(s)}`}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
                  activeSource === s
                    ? "bg-[#010F21] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {s}
              </Link>
            ))}
          </div>
        )}
      </div>

      <main className="max-w-4xl mx-auto pb-24">
        {contacts.length === 0 ? (
          q || activeSource !== "all" ? (
            <EmptyState
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
              title="No contacts match those filters"
              description="Try a different search term or clear the filters."
              action={{ label: "Clear filters", href: "/crm/contacts" }}
            />
          ) : (
            <EmptyState
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
              title="No contacts yet"
              description="Add your first contact manually, or wire up a Meta/Google lead webhook in Phase 2 to auto-populate."
              action={{ label: "Add a contact", href: "/crm/contacts/new" }}
            />
          )
        ) : (
          <ul className="divide-y divide-slate-100 bg-white">
            {contacts.map((c) => {
              const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
              const initials = ((c.first_name?.[0] ?? "") + (c.last_name?.[0] ?? "")).toUpperCase() || "?";
              return (
                <li key={c.id}>
                  <Link
                    href={`/crm/contacts/${c.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-full bg-slate-100 group-hover:bg-[#00929C]/10 flex items-center justify-center flex-shrink-0 transition-colors">
                        <span className="text-xs font-semibold text-slate-600 group-hover:text-[#00929C]">
                          {initials}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 group-hover:text-[#00929C] transition-colors truncate">
                          {fullName}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {c.email_primary ?? "no email"}
                          {c.phone_primary && <span> · {c.phone_primary}</span>}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {c.source ? <span className="font-medium">{c.source}</span> : "no source"}
                          <span> · {formatDate(c.created_at)}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {c.score > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-[#00929C]/10 text-[#00929C] text-[11px] font-semibold tabular-nums">
                          {c.score}
                        </span>
                      )}
                      <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </AppShell>
  );
}
