"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AppShell from "@/components/layout/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";

type Profile = {
  full_name: string;
  email: string;
  role: string;
};

const ROLE_COLORS: Record<string, "default" | "success" | "warning" | "secondary"> = {
  admin: "default",
  manager: "warning",
  sales_rep: "success",
  bookkeeper: "secondary",
  field_crew: "secondary",
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      supabase.from("profiles").select("*").eq("id", user.id).single()
        .then(({ data }) => setProfile(data));
    });
  }, [router]);

  async function handleSignOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const initials = profile
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <AppShell role={profile?.role} userName={profile?.full_name}>
      <AppHeader title="Profile" backHref="/dashboard" />

      <main className="px-5 py-6 space-y-4 max-w-2xl mx-auto pb-24">
        {/* Hero identity card */}
        <div
          className="rounded-2xl p-6 text-white shadow-lg relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #010F21 0%, #00929C 180%)" }}
        >
          <div className="relative z-10 flex items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0 shadow-inner">
              <span className="text-white text-3xl font-black tracking-tight">{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-2xl font-black leading-tight truncate">
                {profile?.full_name ?? "Loading…"}
              </p>
              <p className="text-white/70 text-sm truncate">{profile?.email}</p>
              {profile?.role && (
                <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full bg-white/15 border border-white/20 text-[10px] font-bold uppercase tracking-widest">
                  {profile.role.replace(/_/g, " ")}
                </span>
              )}
            </div>
          </div>
          <div className="absolute right-4 bottom-2 text-7xl font-black text-white/5 select-none">
            {initials}
          </div>
        </div>

        {/* Admin link */}
        {profile?.role === "admin" && (
          <Link href="/admin" className="block">
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#00929C]/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-[#00929C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <span className="font-medium text-slate-900">Admin Panel</span>
                </div>
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Sign Out */}
        <Button
          variant="destructive"
          size="xl"
          className="w-full"
          onClick={handleSignOut}
          loading={loading}
        >
          Sign Out
        </Button>

        <p className="text-center text-slate-400 text-xs mt-4">Powered by {process.env.NEXT_PUBLIC_PLATFORM_NAME ?? "Salta"}</p>
      </main>

    </AppShell>
  );
}
