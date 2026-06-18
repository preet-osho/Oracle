"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
} from "@/lib/razorpay";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

// ─── Animation Variants ───────────────

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } },
};

// ─── Types ────────────────────────────

type CheckoutStatus = "idle" | "creating" | "redirecting" | "verifying" | "success" | "error";

// ─── Pricing Data ─────────────────────

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 0,
    priceLabel: "Free",
    period: "",
    description: "Perfect for exploring ORACLE's capabilities",
    features: [
      "50 AI responses per day",
      "5 service domains",
      "10 curated prompts",
      "Basic quality scoring",
      "Community support",
    ],
    cta: "Start Free",
    popular: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: 2999,
    priceLabel: "₹2,999",
    period: "/month",
    description: "Everything an agency needs to deliver exceptional work",
    features: [
      "Unlimited AI responses",
      "All 40+ service domains",
      "All 55+ expert prompts",
      "Per-client memory & RAG",
      "Quality scoring & analytics",
      "Proposals & invoicing",
      "Priority support",
    ],
    cta: "Start Pro Trial",
    popular: true,
  },
  {
    id: "agency",
    name: "Agency",
    price: 9999,
    priceLabel: "₹9,999",
    period: "/month",
    description: "For teams managing multiple clients",
    features: [
      "Everything in Pro",
      "5 team seats included",
      "Multi-client management",
      "Custom prompt library",
      "White-label proposals",
      "Dedicated account manager",
      "API access",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

const FAQ = [
  {
    q: "Can I switch plans later?",
    a: "Yes, you can upgrade or downgrade at any time. Changes take effect at the start of your next billing cycle.",
  },
  {
    q: "Do I need to bring my own AI API keys?",
    a: "The Starter plan includes limited free usage. Pro and Agency plans include generous AI usage. You can also connect your own API keys for additional capacity.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept UPI, credit/debit cards, net banking, and wallets through Razorpay — India's most trusted payment gateway.",
  },
  {
    q: "Is there a free trial for Pro?",
    a: "Yes! Start with our Free tier and upgrade to Pro anytime. No credit card required to get started.",
  },
  {
    q: "What about GST?",
    a: "All prices are exclusive of 18% GST. GST invoices are automatically generated for all payments.",
  },
];



// ─── Razorpay Checkout Hook ───────────

function useRazorpayCheckout() {
  const [status, setStatus] = useState<CheckoutStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const startCheckout = useCallback(async (plan: typeof PLANS[number]) => {
    // Free plan — just redirect to app
    if (plan.price === 0) {
      window.location.href = "/app";
      return;
    }

    setStatus("creating");
    setError(null);

    try {
      // 1. Create order server-side
      const order = await createRazorpayOrder(
        plan.price,
        "INR",
        `orc_${plan.id}_${Date.now()}`,
        { plan: plan.id, planName: plan.name }
      );

      setStatus("redirecting");

      // 2. Load Razorpay script and open checkout
      const loadScript = () =>
        new Promise<boolean>((resolve) => {
          if (typeof window === "undefined") { resolve(false); return; }
          const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
          if (existing) { resolve(true); return; }
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.head.appendChild(script);
        });

      // Razorpay key ID for client-side checkout (public key, safe to expose)
      const scriptLoaded = await loadScript();
      if (!scriptLoaded || !window.Razorpay) {
        throw new Error("Failed to load Razorpay SDK. Check your internet connection.");
      }

      const razorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!razorpayKeyId) {
        throw new Error("Razorpay key not configured. Please contact support.");
      }

      const result = await new Promise<{
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }>((resolve, reject) => {
        const rzp = new window.Razorpay!({
          key: razorpayKeyId,
          amount: order.amount,
          currency: order.currency,
          name: "ORACLE",
          description: `${plan.name} Plan — ₹${plan.price}/month`,
          order_id: order.orderId,
          prefill: { name: "", email: "", contact: "" },
          theme: { color: "#6366f1" },
          handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
            resolve(response);
          },
          modal: {
            ondismiss: () => reject(new Error("Payment cancelled")),
            confirm_close: true,
          },
        });
        rzp.open();
      });

      // 3. Verify payment server-side
      setStatus("verifying");

      const verification = await verifyRazorpayPayment(
        result.razorpay_order_id,
        result.razorpay_payment_id,
        result.razorpay_signature
      );

      if (verification.verified) {
        setStatus("success");
      } else {
        throw new Error("Payment verification failed. Please contact support.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment failed";
      if (message === "Payment cancelled") {
        setStatus("idle");
        return;
      }
      setError(message);
      setStatus("error");
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
  }, []);

  return { status, error, startCheckout, reset };
}

// ─── Main Pricing Page ────────────────

export function PricingPage() {
  const { status, error, startCheckout, reset } = useRazorpayCheckout();

  return (
    <div className="min-h-screen bg-[#020711]">
      <Navbar />

      <main className="pt-32 pb-20 md:pt-40 md:pb-28">
        {/* Header */}
        <section className="mx-auto max-w-6xl px-6 text-center">
          <motion.div
            initial="initial"
            animate="animate"
            variants={stagger}
            className="mx-auto max-w-3xl"
          >
            <motion.div
              variants={fadeUp}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/70"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Trusted by 50+ agencies across India
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-4xl font-extrabold leading-tight tracking-tight text-white md:text-5xl"
            >
              Simple, transparent{" "}
              <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
                pricing
              </span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/50"
            >
              Start free. Upgrade when you&apos;re ready. No hidden fees, no surprises.
              All payments powered by Razorpay.
            </motion.p>
          </motion.div>
        </section>

        {/* Pricing Cards */}
        <section className="mx-auto max-w-6xl px-6 mt-16">
          {/* Success State */}
          {status === "success" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mx-auto mb-12 max-w-md rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center"
            >
              <div className="mb-4 text-5xl">🎉</div>
              <h3 className="mb-2 text-xl font-bold text-white">Payment Successful!</h3>
              <p className="mb-6 text-sm text-white/50">
                Your Pro plan is now active. Welcome to ORACLE Pro!
              </p>
              <Link
                href="/app"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                Open ORACLE →
              </Link>
            </motion.div>
          )}

          {/* Error State */}
          {status === "error" && error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mx-auto mb-12 max-w-md rounded-2xl border border-red-500/30 bg-red-500/5 p-8 text-center"
            >
              <div className="mb-4 text-5xl">⚠️</div>
              <h3 className="mb-2 text-xl font-bold text-white">Payment Failed</h3>
              <p className="mb-6 text-sm text-white/50">{error}</p>
              <button
                onClick={reset}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 text-sm font-medium text-white/70 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
              >
                Try Again
              </button>
            </motion.div>
          )}

          <motion.div
            className="grid gap-6 lg:grid-cols-3"
            initial="initial"
            animate="animate"
            variants={stagger}
          >
            {PLANS.map((plan) => (
              <motion.div
                key={plan.id}
                variants={fadeUp}
                className={cn(
                  "relative rounded-2xl border p-8 transition-all",
                  plan.popular
                    ? "border-indigo-500/30 bg-indigo-600/5 shadow-lg shadow-indigo-600/10"
                    : "border-white/5 bg-white/[0.02] hover:border-white/10"
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-4 py-1 text-xs font-semibold text-white">
                    Most Popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-white">
                      {plan.priceLabel}
                    </span>
                    {plan.period && (
                      <span className="text-sm text-white/40">{plan.period}</span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-white/40">{plan.description}</p>
                </div>

                <ul className="mb-8 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <svg
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0",
                          plan.popular ? "text-indigo-400" : "text-white/30"
                        )}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-sm text-white/60">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => startCheckout(plan)}
                  disabled={status !== "idle" && status !== "error"}
                  className={cn(
                    "flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold transition",
                    plan.popular
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-500 disabled:opacity-50"
                      : "border border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10 hover:text-white disabled:opacity-50"
                  )}
                >
                  {status === "creating" && plan.price > 0 ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Creating order...
                    </span>
                  ) : status === "redirecting" && plan.price > 0 ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Opening checkout...
                    </span>
                  ) : status === "verifying" && plan.price > 0 ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Verifying...
                    </span>
                  ) : (
                    plan.cta
                  )}
                </button>
              </motion.div>
            ))}
          </motion.div>

          {/* Trust Badges */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-white/30">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Secure payments via Razorpay
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              SSL encrypted
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              UPI, Cards, Net Banking
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              GST invoices included
            </div>
          </div>
        </section>

        {/* Comparison Table */}
        <section className="mx-auto max-w-4xl px-6 mt-24">
          <h2 className="mb-8 text-center text-2xl font-extrabold tracking-tight text-white">
            Compare plans
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-white/5">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="px-6 py-4 font-medium text-white/60">Feature</th>
                  <th className="px-6 py-4 text-center font-medium text-white/60">Starter</th>
                  <th className="px-6 py-4 text-center font-medium text-indigo-400">Pro</th>
                  <th className="px-6 py-4 text-center font-medium text-white/60">Agency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  { label: "AI Responses", starter: "50/day", pro: "Unlimited", agency: "Unlimited" },
                  { label: "Service Domains", starter: "5", pro: "40+", agency: "40+" },
                  { label: "Expert Prompts", starter: "10", pro: "55+", agency: "55+ Custom" },
                  { label: "Client Memory", starter: "—", pro: "✓", agency: "✓" },
                  { label: "RAG & Web Search", starter: "—", pro: "✓", agency: "✓" },
                  { label: "Quality Scoring", starter: "Basic", pro: "Advanced", agency: "Advanced" },
                  { label: "Proposals & Invoices", starter: "—", pro: "✓", agency: "White-label" },
                  { label: "Team Seats", starter: "1", pro: "1", agency: "5" },
                  { label: "Priority Support", starter: "—", pro: "✓", agency: "Dedicated AM" },
                  { label: "API Access", starter: "—", pro: "—", agency: "✓" },
                ].map((row) => (
                  <tr key={row.label} className="hover:bg-white/[0.02]">
                    <td className="px-6 py-3 text-white/50">{row.label}</td>
                    <td className="px-6 py-3 text-center text-white/40">{row.starter}</td>
                    <td className="px-6 py-3 text-center font-medium text-white/70">{row.pro}</td>
                    <td className="px-6 py-3 text-center text-white/40">{row.agency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-6 mt-24">
          <h2 className="mb-8 text-center text-2xl font-extrabold tracking-tight text-white">
            Frequently asked questions
          </h2>
          <div className="space-y-4">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group rounded-xl border border-white/5 bg-white/[0.02] transition hover:border-white/10"
              >
                <summary className="flex cursor-pointer items-center justify-between px-6 py-4 text-sm font-medium text-white/70 marker:hidden list-none">
                  {item.q}
                  <svg
                    className="h-4 w-4 shrink-0 text-white/30 transition group-open:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-4 text-sm leading-relaxed text-white/40">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-6xl px-6 mt-24">
          <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-indigo-600/10 via-violet-600/5 to-purple-600/10 p-12 text-center md:p-16">
            <div className="absolute inset-0 -z-10">
              <div className="absolute top-0 left-1/2 h-[300px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/10 blur-[80px]" />
            </div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
                Ready to get started?
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-base text-white/40">
                Join 50+ agency founders using ORACLE to deliver exceptional work.
                Start free — no credit card required.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href="/app"
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-indigo-600 px-8 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500 hover:shadow-indigo-500/30"
                >
                  Get Started Free
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
