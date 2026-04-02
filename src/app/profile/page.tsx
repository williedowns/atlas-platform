"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <h1 className="text-lg font-bold">Profile</h1>
      </header>

      <main className="px-5 py-6 space-y-4 max-w-2xl mx-auto pb-24">
        {/* Avatar + Info */}
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#00929C] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-2xl font-bold">{initials}</span>
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{profile?.full_name ?? "Loading..."}</p>
              <p className="text-slate-500 text-sm">{profile?.email}</p>
              {profile?.role && (
                <Badge variant={ROLE_COLORS[profile.role] ?? "secondary"} className="mt-2 capitalize">
                  {profile.role.replace(/_/g, " ")}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

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

        <p className="text-center text-slate-400 text-xs mt-4">Atlas Spas Platform v1.0</p>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex">
        <Link href="/dashboard" className="flex-1 flex flex-col items-center py-3 text-slate-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          <span className="text-xs mt-1">Home</span>
        </Link>
        <Link href="/contracts" className="flex-1 flex flex-col items-center py-3 text-slate-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          <span className="text-xs mt-1">Contracts</span>
        </Link>
        <Link href="/shows" className="flex-1 flex flex-col items-center py-3 text-slate-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <span className="text-xs mt-1">Shows</span>
        </Link>
        <Link href="/profile" className="flex-1 flex flex-col items-center py-3 text-[#00929C]">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          <span className="text-xs mt-1 font-medium">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
