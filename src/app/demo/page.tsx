import Link from "next/link";

export const metadata = {
  title: "Demo — Salta",
  description: "Live demo of the Salta platform — dealer portal and manufacturer network dashboard.",
};

export default function DemoGatewayPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background: "radial-gradient(ellipse at top, #0F2038 0%, #010F21 70%)",
      }}
    >
      <div className="w-full max-w-5xl">
        <div className="text-center mb-10">
          <div className="inline-block px-4 py-1.5 rounded-full bg-white/10 text-white/80 text-xs uppercase tracking-[0.3em] mb-4">
            Live Demo Environment
          </div>
          <h1 className="text-white text-4xl md:text-5xl font-black tracking-tight mb-3">
            Salta Platform Demo
          </h1>
          <p className="text-white/60 max-w-2xl mx-auto">
            Explore how Salta works from two perspectives — the dealer platform running
            a real spa retailer&apos;s daily operations, and the manufacturer network
            dashboard built to aggregate activity across every dealer in the network.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <DemoCard
            badge="For Dealers"
            badgeColor="#00929C"
            title="Atlas Spas Dealer Portal"
            subtitle="Real operating platform · live data"
            bullets={[
              "Contracts, quotes, show sales, inventory, delivery",
              "Running live on Atlas Spas & Swim Spas right now",
              "Signed in as the platform admin — full access",
            ]}
            ctaLabel="Enter Dealer Demo →"
            ctaHref="/dealer/login"
            accentBg="#024452"
            credsLabel="Demo credentials"
            credsEmail="demo@atlasspas.com"
            credsPassword="demo2026"
          />

          <DemoCard
            badge="For Manufacturers"
            badgeColor="#DC2626"
            title="Master Spas Network Portal"
            subtitle="Manufacturer dashboard · live Atlas data + network sample"
            bullets={[
              "Network-wide sell-through, inventory, leaderboard",
              "Atlas appears as a real dealer with real Supabase data",
              "Command Center big-screen mode for dealer meetings",
            ]}
            ctaLabel="Enter Manufacturer Demo →"
            ctaHref="/manufacturer/login"
            accentBg="#0B1929"
            credsLabel="Demo credentials"
            credsEmail="kevin.richards@masterspas.com"
            credsPassword="(any password)"
          />
        </div>

        <div className="mt-10 text-center">
          <p className="text-white/40 text-xs max-w-2xl mx-auto">
            This is a demo environment. Data in the manufacturer view is a realistic
            sample network plus Atlas&apos;s live records. Dealer portal runs on real
            Atlas Spas data — numbers are intentionally small because our team is still
            onboarding to the platform.
          </p>
        </div>
      </div>
    </div>
  );
}

function DemoCard({
  badge,
  badgeColor,
  title,
  subtitle,
  bullets,
  ctaLabel,
  ctaHref,
  accentBg,
  credsLabel,
  credsEmail,
  credsPassword,
}: {
  badge: string;
  badgeColor: string;
  title: string;
  subtitle: string;
  bullets: string[];
  ctaLabel: string;
  ctaHref: string;
  accentBg: string;
  credsLabel: string;
  credsEmail: string;
  credsPassword: string;
}) {
  return (
    <div
      className="rounded-2xl p-6 flex flex-col"
      style={{
        background: `linear-gradient(180deg, ${accentBg} 0%, rgba(0,0,0,0.4) 100%)`,
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <span
        className="inline-block w-fit px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-white mb-3"
        style={{ backgroundColor: badgeColor }}
      >
        {badge}
      </span>
      <h2 className="text-white text-2xl font-black tracking-tight">{title}</h2>
      <p className="text-white/60 text-sm mt-1">{subtitle}</p>

      <ul className="mt-5 space-y-2 text-sm text-white/80">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2">
            <span className="text-white/50 mt-0.5">·</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 rounded-lg p-3 bg-black/30 border border-white/10">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1.5">
          {credsLabel}
        </p>
        <p className="text-sm text-white font-mono">{credsEmail}</p>
        <p className="text-sm text-white/70 font-mono">{credsPassword}</p>
      </div>

      <Link
        href={ctaHref}
        className="mt-6 block text-center py-3 rounded-lg text-white font-bold text-sm uppercase tracking-wide transition-all hover:scale-[1.02]"
        style={{ backgroundColor: badgeColor }}
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
