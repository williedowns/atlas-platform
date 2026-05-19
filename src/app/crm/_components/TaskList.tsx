import { createClient } from "@/lib/supabase/server";
import TaskQuickAdd from "./TaskQuickAdd";
import TaskItem from "./TaskItem";

interface TaskListProps {
  /** Filter to tasks linked to this contact. */
  contactId?: string | null;
  /** Filter to tasks linked to this opportunity. */
  opportunityId?: string | null;
  /** Filter to tasks assigned to this user. */
  assigneeId?: string | null;
  /** Show only active (incomplete) tasks. Defaults to true. */
  activeOnly?: boolean;
  /** Hide parent-record links on each task (when rendered ON the parent). */
  hideParentLinks?: boolean;
  /** Header title. Defaults to "Tasks". */
  title?: string;
  /** Hide the quick-add form. */
  hideQuickAdd?: boolean;
  /** Empty-state copy. */
  emptyDescription?: string;
  /** Max tasks to load. */
  limit?: number;
}

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  due_at: string | null;
  created_at: string;
  contact_id: string | null;
  opportunity_id: string | null;
  contact: { id: string; first_name: string; last_name: string | null } | null;
  opportunity: { id: string; name: string } | null;
}

export default async function TaskList({
  contactId,
  opportunityId,
  assigneeId,
  activeOnly = true,
  hideParentLinks = false,
  title = "Tasks",
  hideQuickAdd = false,
  emptyDescription = "No open tasks. Add one above to keep momentum.",
  limit = 30,
}: TaskListProps) {
  const supabase = await createClient();

  let query = supabase
    .from("tasks")
    .select(`
      id, title, description, type, priority, due_at, created_at,
      contact_id, opportunity_id,
      contact:contacts!contact_id(id, first_name, last_name),
      opportunity:opportunities!opportunity_id(id, name)
    `)
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (activeOnly) query = query.is("completed_at", null);
  if (contactId) query = query.eq("contact_id", contactId);
  if (opportunityId) query = query.eq("opportunity_id", opportunityId);
  if (assigneeId) query = query.eq("assignee_id", assigneeId);

  const { data: tasksRaw } = await query;
  const tasks = (tasksRaw ?? []) as unknown as TaskRow[];

  // Bucket by due-ness for the assignee view (Today / Overdue / Later)
  const now = Date.now();
  const startOfTomorrow = new Date();
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  startOfTomorrow.setHours(0, 0, 0, 0);

  const overdue: TaskRow[] = [];
  const today: TaskRow[] = [];
  const later: TaskRow[] = [];
  const undated: TaskRow[] = [];

  for (const t of tasks) {
    if (!t.due_at) {
      undated.push(t);
      continue;
    }
    const due = new Date(t.due_at).getTime();
    if (due < now) overdue.push(t);
    else if (due < startOfTomorrow.getTime()) today.push(t);
    else later.push(t);
  }

  // For "Today's Plays" (assignee view), use bucketed sections.
  // For embedded views (contact/opportunity), use a flat list.
  const useBuckets = !contactId && !opportunityId;

  return (
    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <p className="text-[11px] text-slate-500">
            {tasks.length === 0
              ? "All clear."
              : `${tasks.length} open · ${overdue.length} overdue · ${today.length} due today`}
          </p>
        </div>
      </div>

      {!hideQuickAdd && (
        <TaskQuickAdd
          contactId={contactId ?? null}
          opportunityId={opportunityId ?? null}
        />
      )}

      {tasks.length === 0 ? (
        <div className="p-5 text-center text-sm text-slate-400 italic">{emptyDescription}</div>
      ) : useBuckets ? (
        <div>
          {overdue.length > 0 && (
            <div>
              <div className="px-5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50/50">
                Overdue ({overdue.length})
              </div>
              <div className="divide-y divide-slate-100">
                {overdue.map((t) => (
                  <TaskItem key={t.id} task={t} hideParentLinks={hideParentLinks} />
                ))}
              </div>
            </div>
          )}
          {today.length > 0 && (
            <div>
              <div className="px-5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50/50">
                Due today ({today.length})
              </div>
              <div className="divide-y divide-slate-100">
                {today.map((t) => (
                  <TaskItem key={t.id} task={t} hideParentLinks={hideParentLinks} />
                ))}
              </div>
            </div>
          )}
          {later.length > 0 && (
            <div>
              <div className="px-5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Coming up ({later.length})
              </div>
              <div className="divide-y divide-slate-100">
                {later.map((t) => (
                  <TaskItem key={t.id} task={t} hideParentLinks={hideParentLinks} />
                ))}
              </div>
            </div>
          )}
          {undated.length > 0 && (
            <div>
              <div className="px-5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                No due date ({undated.length})
              </div>
              <div className="divide-y divide-slate-100">
                {undated.map((t) => (
                  <TaskItem key={t.id} task={t} hideParentLinks={hideParentLinks} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {tasks.map((t) => (
            <TaskItem key={t.id} task={t} hideParentLinks={hideParentLinks} />
          ))}
        </div>
      )}
    </section>
  );
}
