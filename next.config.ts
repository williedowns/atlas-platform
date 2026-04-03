import type { NextConfig } from "next";

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
};

export default nextConfig;
