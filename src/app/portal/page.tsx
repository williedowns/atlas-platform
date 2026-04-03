import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function PortalRootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/portal/dashboard");
  redirect("/portal/login");
}
