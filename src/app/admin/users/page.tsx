export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { InviteUserButton } from "@/components/admin/InviteUserButton";
import { UserRoleEditor } from "@/components/admin/UserRoleEditor";
import { GetLoginLinkButton } from "@/components/admin/GetLoginLinkButton";
import { SetPasswordButton } from "@/components/admin/SetPasswordButton";

function Initials({ name, email }: { name?: string | null; email?: string | null }) {
  const src = name || email || "?";
  const letters = src
    .split(" ")
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
  return (
    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
      <span className="text-sm font-semibold text-slate-600">{letters || "?"}</span>
    </div>
  );
}

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-slate-800 text-white",
  manager: "bg-amber-100 text-amber-800",
  sales_rep: "bg-emerald-100 text-emerald-800",
  bookkeeper: "bg-slate-100 text-slate-700",
  field_crew: "bg-blue-100 text-blue-800",
};

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name");

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      {/* Header */}
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/admin" className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Users</h1>
            <p className="text-white/60 text-xs">{profiles?.length ?? 0} team members</p>
          </div>
          <InviteUserButton />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-3">

        {profiles?.map((p) => {
          const roleLabel = p.role?.replace("_", " ") ?? "unknown";
          const badgeClass = ROLE_BADGE[p.role ?? ""] ?? "bg-slate-100 text-slate-600";

          return (
            <div
              key={p.id}
              className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex items-center gap-3"
            >
              {/* Avatar */}
              <Initials name={p.full_name} email={p.email} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">
                  {p.full_name || <span className="text-slate-400 italic">No name</span>}
                </p>
                <p className="text-xs text-slate-500 truncate">{p.email}</p>
              </div>

              {/* Role + Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <UserRoleEditor
                  userId={p.id}
                  currentRole={p.role ?? "sales_rep"}
                  currentUserId={user.id}
                />
                <SetPasswordButton
                  userId={p.id}
                  userName={p.full_name || p.email}
                  currentUserId={user.id}
                />
                <GetLoginLinkButton
                  email={p.email}
                  userId={p.id}
                  currentUserId={user.id}
                />
              </div>
            </div>
          );
        })}

        {(!profiles || profiles.length === 0) && (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <p className="text-slate-500">No users yet.</p>
            <p className="text-slate-400 text-sm mt-1">Use the Invite button to add your first team member.</p>
          </div>
        )}

      </main>
    </div>
  );
}
