"use client";
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DealerLoginForm } from "@/components/login/DealerLoginForm";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#010F21]" />}>
      <LoginWithParams />
    </Suspense>
  );
}

function LoginWithParams() {
  const searchParams = useSearchParams();
  const demoMode = searchParams.get("demo") === "1";
  return <DealerLoginForm demoMode={demoMode} />;
}
