import {
  CAMPAIGNS,
  REVIEWS,
  marketingStats,
  channelPerformance,
  recentRoutedLeads,
  dealerLeadPerformance,
  type CampaignStatus,
} from "@/lib/manufacturer/mock-data";
import MarketingClient from "./MarketingClient";

export default async function MarketingPage() {
  const stats = marketingStats();
  const channels = channelPerformance();
  const recentLeads = recentRoutedLeads(15);
  const dealerPerfRaw = dealerLeadPerformance(10);

  const dealerPerformance = dealerPerfRaw.map((d) => ({
    dealer: {
      id: d.dealer.id,
      name: d.dealer.name,
      city: d.dealer.city,
      state: d.dealer.state,
      tier: d.dealer.tier,
    },
    routed: d.routed,
    contacted: d.contacted,
    converted: d.converted,
    avgTimeToContact: d.avgTimeToContact,
    conversionRate: d.conversionRate,
  }));

  const statusCounts: Record<CampaignStatus, number> = {
    planned: 0, active: 0, paused: 0, completed: 0,
  };
  for (const c of CAMPAIGNS) statusCounts[c.status]++;

  return (
    <MarketingClient
      campaigns={CAMPAIGNS}
      stats={stats}
      channels={channels}
      recentLeads={recentLeads}
      dealerPerformance={dealerPerformance}
      reviews={REVIEWS}
      statusCounts={statusCounts}
    />
  );
}
