import type { Metadata } from "next";

const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME ?? "Atlas Spas";
const platformName = process.env.NEXT_PUBLIC_PLATFORM_NAME ?? "Salta";

export const metadata: Metadata = {
  title: `Customer Portal — ${companyName}`,
  description: `View your contract, track your order, and make payments. Powered by ${platformName}.`,
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      {children}
    </div>
  );
}
