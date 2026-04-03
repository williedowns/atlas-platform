export const dynamic = "force-dynamic";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CheckInForm from "./CheckInForm";

export default async function CheckInPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: show } = await supabase
    .from("shows")
    .select("id, name, venue_name, city, state")
    .eq("id", id)
    .single();

  if (!show) notFound();

  return <CheckInForm show={show} />;
}
