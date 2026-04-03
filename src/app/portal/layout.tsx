import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Customer Portal — Atlas Spas",
  description: "View your contract, track your order, and make payments.",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      {children}
    </div>
  );
}
