import {
  COURSES,
  CERTIFICATIONS,
  CONTENT_ASSETS,
  trainingStats,
  certificationStatusByDealer,
  expiringCertifications,
  recentEnrollments,
  type CourseCategory,
} from "@/lib/manufacturer/mock-data";
import TrainingClient from "./TrainingClient";

export default async function TrainingPage() {
  const stats = trainingStats();
  const dealerCertRaw = certificationStatusByDealer();
  const expiringRepCerts = expiringCertifications(15);
  const recent = recentEnrollments(15);

  const dealerCertStatus = dealerCertRaw.map((d) => ({
    dealer: {
      id: d.dealer.id,
      name: d.dealer.name,
      city: d.dealer.city,
      state: d.dealer.state,
      tier: d.dealer.tier,
    },
    totalReps: d.totalReps,
    fullyCertifiedReps: d.fullyCertifiedReps,
    expiringReps: d.expiringReps,
    expiredReps: d.expiredReps,
  }));

  const categoryCounts: Record<CourseCategory, number> = {
    onboarding: 0, product: 0, sales: 0, service: 0, compliance: 0, brand: 0,
  };
  for (const c of COURSES) categoryCounts[c.category]++;

  return (
    <TrainingClient
      courses={COURSES}
      stats={stats}
      certifications={CERTIFICATIONS}
      dealerCertStatus={dealerCertStatus}
      expiringRepCerts={expiringRepCerts}
      recentEnrollments={recent}
      contentAssets={CONTENT_ASSETS}
      categoryCounts={categoryCounts}
    />
  );
}
