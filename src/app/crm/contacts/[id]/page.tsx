export const dynamic = "force-dynamic";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { formatDate } from "@/lib/utils";
import ActivityTimeline from "../../_components/ActivityTimeline";
import HouseholdLinker from "../../_components/HouseholdLinker";
import TaskList from "../../_components/TaskList";
import InlineEdit from "../../_components/InlineEdit";
import ContactOpportunitiesList from "../../_components/ContactOpportunitiesList";
import RealtimeRefresher from "../../_components/RealtimeRefresher";

const CONTACT_SOURCE_OPTIONS = [
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

export default async function CrmContactDetailPage({
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

  const { data: contact } = await supabase
    .from("contacts")
    .select(`
      id, first_name, last_name, email_primary, phone_primary, emails, phones,
      source, source_detail, score, notes, created_at, updated_at,
      household_id, customer_id, owner_id, last_activity_at, dob,
      address, city, state, zip,
      channels_consent, do_not_contact,
      household:households(id, name, lifecycle_stage),
      customer:customers(id, first_name, last_name, qbo_customer_id),
      owner:profiles!owner_id(id, full_name)
    `)
    .eq("id", id)
    .single();

  if (!contact) notFound();

  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Unnamed contact";
  const initials = ((contact.first_name?.[0] ?? "") + (contact.last_name?.[0] ?? "")).toUpperCase() || "?";
  const household = (contact.household as any) ?? null;
  const customer = (contact.customer as any) ?? null;
  const owner = (contact.owner as any) ?? null;

  return (
    <AppShell role={profile?.role} userName={profile?.full_name} orgPerms={orgPerms}>
      <AppHeader
        title={fullName}
        subtitle={contact.source ? `${contact.source} · ${formatDate(contact.created_at)}` : `Created ${formatDate(contact.created_at)}`}
        backHref="/crm/contacts"
      />

      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 space-y-6">
        {/* Header card */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#00929C] to-[#007a82] flex items-center justify-center text-white font-bold text-lg shadow-sm flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-slate-900 truncate">{fullName}</h2>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-6 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {contact.email_primary ? (
                    <a href={`mailto:${contact.email_primary}`} className="text-slate-700 hover:text-[#00929C] truncate">
                      {contact.email_primary}
                    </a>
                  ) : (
                    <span className="text-slate-400">no email</span>
                  )}
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {contact.phone_primary ? (
                    <a href={`tel:${contact.phone_primary}`} className="text-slate-700 hover:text-[#00929C] truncate">
                      {contact.phone_primary}
                    </a>
                  ) : (
                    <span className="text-slate-400">no phone</span>
                  )}
                </div>
                {(contact.city || contact.state || contact.zip) && (
                  <div className="flex items-center gap-2 min-w-0 sm:col-span-2">
                    <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-slate-600 truncate">
                      {[contact.address, contact.city, contact.state, contact.zip].filter(Boolean).join(", ")}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              {contact.score > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#00929C]/10 text-[#00929C] text-xs font-bold tabular-nums">
                  Score {contact.score}
                </span>
              )}
              {owner?.full_name && (
                <span className="text-xs text-slate-500">Owner: <span className="font-medium text-slate-700">{owner.full_name}</span></span>
              )}
            </div>
          </div>
        </section>

        {/* Two-column on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: linked records */}
          <div className="lg:col-span-1 space-y-4">
            {/* Household */}
            <section className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Household</h3>
              <HouseholdLinker
                contactId={contact.id}
                contactRole={contact.role_in_household ?? null}
                currentHousehold={household ? { id: household.id, name: household.name, lifecycle_stage: household.lifecycle_stage } : null}
              />
              <p className="mt-3 text-[11px] text-slate-400 leading-relaxed">
                Households group multiple contacts (couples, families, HOAs) under one deal. Activity logged on any member rolls up to the household timeline.
              </p>
            </section>

            {/* Linked legacy customer */}
            <section className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Legacy customer record</h3>
              {customer ? (
                <Link
                  href={`/contracts?customer_id=${customer.id}`}
                  className="block p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <p className="font-semibold text-slate-900 text-sm">
                    {[customer.first_name, customer.last_name].filter(Boolean).join(" ") || "—"}
                  </p>
                  {customer.qbo_customer_id && (
                    <p className="text-[11px] text-slate-500 mt-0.5">QBO: {customer.qbo_customer_id}</p>
                  )}
                  <p className="text-[11px] text-[#00929C] mt-1.5 font-medium">View contracts →</p>
                </Link>
              ) : (
                <p className="text-sm text-slate-400 italic">Not linked to a `customers` row.</p>
              )}
              <p className="mt-3 text-[11px] text-slate-400 leading-relaxed">
                When this contact closes-won, the contract creates a `customers` row and links it back here.
              </p>
            </section>

            {/* Source attribution */}
            <section className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Source</h3>
              <p className="font-semibold text-slate-900 text-sm">{contact.source ?? "Not set"}</p>
              {contact.source_detail && Object.keys(contact.source_detail as object).length > 0 && (
                <pre className="mt-2 text-[11px] text-slate-500 bg-slate-50 p-2 rounded overflow-x-auto">
                  {JSON.stringify(contact.source_detail, null, 2)}
                </pre>
              )}
            </section>
          </div>

          {/* Right: editable details + opportunities + activities */}
          <div className="lg:col-span-2 space-y-4">
            {/* Editable details */}
            <section className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Contact details</h3>
                <span className="text-[10px] text-slate-400">Click any value to edit</span>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
                <InlineEdit
                  recordType="contact"
                  recordId={contact.id}
                  field="first_name"
                  value={contact.first_name ?? null}
                  label="First name"
                  allowClear={false}
                />
                <InlineEdit
                  recordType="contact"
                  recordId={contact.id}
                  field="last_name"
                  value={contact.last_name ?? null}
                  label="Last name"
                />
                <InlineEdit
                  recordType="contact"
                  recordId={contact.id}
                  field="email_primary"
                  value={contact.email_primary ?? null}
                  label="Email"
                  placeholder="customer@example.com"
                />
                <InlineEdit
                  recordType="contact"
                  recordId={contact.id}
                  field="phone_primary"
                  value={contact.phone_primary ?? null}
                  label="Phone"
                  placeholder="(555) 123-4567"
                />
                <InlineEdit
                  recordType="contact"
                  recordId={contact.id}
                  field="source"
                  value={contact.source ?? null}
                  fieldType="select"
                  options={CONTACT_SOURCE_OPTIONS}
                  label="Source"
                />
                <InlineEdit
                  recordType="contact"
                  recordId={contact.id}
                  field="score"
                  value={contact.score ?? null}
                  fieldType="number"
                  label="Score"
                  placeholder="0"
                />
                <InlineEdit
                  recordType="contact"
                  recordId={contact.id}
                  field="address"
                  value={contact.address ?? null}
                  label="Address"
                  className="sm:col-span-2"
                />
                <InlineEdit
                  recordType="contact"
                  recordId={contact.id}
                  field="city"
                  value={contact.city ?? null}
                  label="City"
                />
                <div className="grid grid-cols-2 gap-3">
                  <InlineEdit
                    recordType="contact"
                    recordId={contact.id}
                    field="state"
                    value={contact.state ?? null}
                    label="State"
                    placeholder="TX"
                  />
                  <InlineEdit
                    recordType="contact"
                    recordId={contact.id}
                    field="zip"
                    value={contact.zip ?? null}
                    label="ZIP"
                  />
                </div>
                <div className="sm:col-span-2">
                  <InlineEdit
                    recordType="contact"
                    recordId={contact.id}
                    field="notes"
                    value={contact.notes ?? null}
                    fieldType="textarea"
                    label="Notes"
                    placeholder="Anything important about this contact…"
                  />
                </div>
              </dl>
            </section>

            {/* Opportunities (real data — Phase 1.11) */}
            <ContactOpportunitiesList
              contactId={contact.id}
              householdId={contact.household_id}
            />

            {/* Tasks for this contact */}
            <TaskList
              contactId={contact.id}
              title="Tasks"
              hideParentLinks
              emptyDescription="No open tasks for this contact. Add one above."
            />

            {/* Activities */}
            <ActivityTimeline contactId={contact.id} />

            {/* Notes */}
            {contact.notes && (
              <section className="bg-white rounded-2xl border border-slate-200">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">Notes</h3>
                </div>
                <div className="p-5 text-sm text-slate-700 whitespace-pre-wrap">{contact.notes}</div>
              </section>
            )}
          </div>
        </div>
      </main>

      {/* Live updates for this contact's activities, tasks, and opportunities. */}
      <RealtimeRefresher tables={["activities", "tasks", "opportunities"]} />
    </AppShell>
  );
}
