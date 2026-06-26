import type { Metadata } from "next";
import { PricingPage } from "@/components/pricing/PricingPage";

export const metadata: Metadata = {
  title: "Pricing — ORACLE | AI Operating System for Agencies",
  description:
    "Simple, transparent pricing for Indian digital agencies. Start free, upgrade when ready. Free/Pro/Agency tiers with Razorpay payments.",
  openGraph: {
    title: "Pricing — ORACLE",
    description:
      "Simple, transparent pricing for Indian digital agencies. Start free, upgrade when ready.",
    url: "https://oracle.app/pricing",
    siteName: "ORACLE",
    type: "website",
  },
};

export default function PricingRoute() {
  return <PricingPage />;
}
