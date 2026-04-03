export const dynamic = "force-dynamic";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LeadDetailClient from "./LeadDetailClient";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: lead, error } = await supabase
    .from("leads")
    .select(`
      id, first_name, last_name, phone, email, interest, status, notes, created_at, updated_at,
      show:shows(id, name),
      assigned_to_profile:profiles!assigned_to(full_name)
    `)
    .eq("id", id)
    .single();

  if (error || !lead) notFound();

  return <LeadDetailClient lead={lead as any} />;
}
