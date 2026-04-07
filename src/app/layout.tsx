import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], weight: ["400", "600", "700"] });

const platformName = process.env.NEXT_PUBLIC_PLATFORM_NAME ?? "Salta";
const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME ?? "Atlas Spas";

export const metadata: Metadata = {
  title: {
    default: `${companyName} · ${platformName}`,
    template: `%s · ${platformName}`,
  },
  description: "Sales & Operations Platform",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: platformName,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#010F21",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className={`${figtree.className} bg-slate-50 antialiased`}>
        {children}
      </body>
    </html>
  );
}
