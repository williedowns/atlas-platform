import { DealerLoginForm } from "@/components/login/DealerLoginForm";

// Clean, shareable URL for the dealer platform demo. Mirrors /manufacturer/login.
// Demo credentials are pre-filled automatically.
export default function DealerLoginDemoPage() {
  return <DealerLoginForm demoMode={true} />;
}
