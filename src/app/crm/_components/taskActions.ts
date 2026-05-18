"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type TaskType = "call" | "sms" | "email" | "follow_up" | "meeting" | "custom";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

interface CreateTaskInput {
  title: string;
  type?: TaskType;
  priority?: TaskPriority;
  dueAt?: string | null;          // ISO datetime
  description?: string | null;
  contactId?: string | null;
  opportunityId?: string | null;
  assigneeId?: string | null;      // defaults to current user
}

export async function createTask(input: CreateTaskInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  if (!input.title?.trim()) {
    return { ok: false, error: "Task title is required." };
  }

  const payload: Record<string, unknown> = {
    title: input.title.trim(),
    type: input.type ?? "follow_up",
    priority: input.priority ?? "normal",
    due_at: input.dueAt ?? null,
    description: input.description?.trim() || null,
    contact_id: input.contactId ?? null,
    opportunity_id: input.opportunityId ?? null,
    assignee_id: input.assigneeId ?? user.id,
    source: "manual",
    created_by: user.id,
  };

  const { error } = await supabase.from("tasks").insert(payload);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/crm");
  if (input.contactId) revalidatePath(`/crm/contacts/${input.contactId}`);
  if (input.opportunityId) revalidatePath(`/crm/opportunities/${input.opportunityId}`);

  return { ok: true };
}

export async function completeTask(taskId: string, result?: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  // Capture parent IDs for revalidation
  const { data: task } = await supabase
    .from("tasks")
    .select("id, contact_id, opportunity_id")
    .eq("id", taskId)
    .single();

  const { error } = await supabase
    .from("tasks")
    .update({
      completed_at: new Date().toISOString(),
      completed_by: user.id,
      result: result?.trim() || null,
    })
    .eq("id", taskId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/crm");
  if (task?.contact_id) revalidatePath(`/crm/contacts/${task.contact_id}`);
  if (task?.opportunity_id) revalidatePath(`/crm/opportunities/${task.opportunity_id}`);

  return { ok: true };
}

export async function snoozeTask(taskId: string, snoozeUntil: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data: task } = await supabase
    .from("tasks")
    .select("id, contact_id, opportunity_id")
    .eq("id", taskId)
    .single();

  const { error } = await supabase
    .from("tasks")
    .update({ due_at: snoozeUntil })
    .eq("id", taskId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/crm");
  if (task?.contact_id) revalidatePath(`/crm/contacts/${task.contact_id}`);
  if (task?.opportunity_id) revalidatePath(`/crm/opportunities/${task.opportunity_id}`);

  return { ok: true };
}

export async function deleteTask(taskId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data: task } = await supabase
    .from("tasks")
    .select("id, contact_id, opportunity_id, created_by, assignee_id")
    .eq("id", taskId)
    .single();

  if (!task) return { ok: false, error: "Task not found." };

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/crm");
  if (task.contact_id) revalidatePath(`/crm/contacts/${task.contact_id}`);
  if (task.opportunity_id) revalidatePath(`/crm/opportunities/${task.opportunity_id}`);

  return { ok: true };
}
