import type { NextConfig } from "next";

// Cache-bust marker: 2026-05-22 — Vercel Production build cache poisoned, forcing rebuild
const nextConfig: NextConfig = {
  // Reduce JS bundle size by tree-shaking large package imports
  experimental: {
    optimizePackageImports: [
      "@supabase/supabase-js",
      "@supabase/ssr",
      "lucide-react",
      "date-fns",
    ],
  },

  // Remove X-Powered-By header (minor security + perf hygiene)
  poweredByHeader: false,

  // Image optimization — allow Supabase storage domain for future <Image> usage
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  // Service worker must never be edge-cached — clients need the latest fetch
  // handler immediately so offline queueing rules stay current.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
