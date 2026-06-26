"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

// ─── Animation Variants ───────────────

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
};

const cardHover = {
  rest: { y: 0 },
  hover: { y: -4, transition: { duration: 0.2 } },
};

// ─── Data ─────────────────────────────

const FEATURES = [
  {
    emoji: "🤖",
    title: "40+ Service Domains",
    description:
      "Expert-level knowledge across SEO, Google Ads, Meta Ads, Social Media, Content, Development, Voice AI, and 30+ more disciplines.",
  },
  {
    emoji: "🧠",
    title: "Per-Client Memory",
    description:
      "ORACLE remembers every client's preferences, history, and context across conversations. Gets smarter with every interaction.",
  },
  {
    emoji: "⚡",
    title: "10 AI Providers",
    description:
      "Smart routing across OpenAI, Anthropic, Groq, Google, and 6 more. Auto-failover, cost optimization, and streaming responses.",
  },
  {
    emoji: "📋",
    title: "55+ Expert Prompts",
    description:
      "Ready-to-use prompts for SEO audits, ad campaigns, email sequences, proposals, content calendars, and more.",
  },
  {
    emoji: "📊",
    title: "Quality Scoring",
    description:
      "Every response is scored on 5 dimensions — completeness, specificity, actionability, India context, and client readiness.",
  },
  {
    emoji: "🔄",
    title: "Multi-Agent Orchestration",
    description:
      "Decompose complex tasks across researcher, writer, developer, and analyst agents for enterprise-grade deliverables.",
  },
  {
    emoji: "📄",
    title: "Proposals & Invoices",
    description:
      "Generate GST-compliant invoices and client proposals with INR pricing, all from within the platform.",
  },
  {
    emoji: "🌐",
    title: "RAG & Web Search",
    description:
      "Upload documents, search the web in real-time, and get context-aware responses grounded in your knowledge base.",
  },
];

const DOMAINS = [
  "SEO", "Google Ads", "Meta Ads", "Social Media", "Email Marketing",
  "WhatsApp Marketing", "Content Marketing", "Website Development",
  "SaaS Development", "Mobile Apps", "Voice Agents", "AI Chatbots",
  "Brand Identity", "Lead Generation", "CRM Setup", "Data Analytics",
];

const PRICING = [
  {
    name: "Starter",
    price: "Free",
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
    href: "/app",
    popular: false,
  },
  {
    name: "Pro",
    price: "₹2,999",
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
    href: "/app",
    popular: true,
  },
  {
    name: "Agency",
    price: "₹9,999",
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
    href: "/app",
    popular: false,
  },
];

const TESTIMONIALS = [
  {
    quote: "ORACLE helped me close 3 new clients in my first month. The proposal generator alone is worth the subscription.",
    name: "Rajesh Kumar",
    role: "Founder, DigitalKraft Agency",
    city: "Mumbai",
  },
  {
    quote: "I used to spend 4 hours on SEO audits. Now ORACLE does it in 10 minutes with better depth than my team.",
    name: "Priya Sharma",
    role: "SEO Lead, BrandWave",
    city: "Delhi",
  },
  {
    quote: "The client memory feature is a game-changer. ORACLE remembers every conversation and builds on previous context.",
    name: "Amit Patel",
    role: "CEO, GrowthFirst Digital",
    city: "Bangalore",
  },
];

// ─── Components ────────────────────────



function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-28">
      {/* Background Gradient */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/15 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[600px] translate-x-1/3 translate-y-1/3 rounded-full bg-violet-600/10 blur-[100px]" />
      </div>

      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          className="mx-auto max-w-3xl text-center"
          initial="initial"
          animate="animate"
          variants={stagger}
        >
          {/* Badge */}
          <motion.div variants={fadeUp} className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Built for Indian digital agencies
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeUp}
            className="text-4xl font-extrabold leading-tight tracking-tight text-white md:text-6xl"
          >
            Your agency&apos;s AI{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
              operating system
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={fadeUp}
            className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/50"
          >
            40+ service domains. 55+ expert prompts. 10 AI providers.
            One platform that helps you deliver exceptional work for every client.
          </motion.p>

          {/* CTAs */}
          <motion.div variants={fadeUp} className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/app"
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-indigo-600 px-8 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500 hover:shadow-indigo-500/30"
            >
              Start Free
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <a
              href="#features"
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 text-sm font-medium text-white/70 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              See Features
            </a>
          </motion.div>

          {/* Social Proof */}
          <motion.p variants={fadeUp} className="mt-8 text-xs text-white/30">
            No credit card required · Free tier included · Cancel anytime
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        {/* Section Header */}
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            Everything your agency needs
          </h2>
          <p className="mt-4 text-base text-white/40">
            From SEO audits to invoice generation — ORACLE handles the entire agency workflow.
          </p>
        </div>

        {/* Feature Grid */}
        <motion.div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger}
        >
          {FEATURES.map((feature) => (
            <motion.div
              key={feature.title}
              variants={fadeUp}
              whileHover="hover"
              initial="rest"
              animate="rest"
              className="group rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition-colors hover:border-white/10 hover:bg-white/[0.04]"
            >
              <motion.div variants={cardHover}>
                <div className="mb-4 text-3xl">{feature.emoji}</div>
                <h3 className="mb-2 text-sm font-semibold text-white">
                  {feature.title}
                </h3>
                <p className="text-xs leading-relaxed text-white/40">
                  {feature.description}
                </p>
              </motion.div>
            </motion.div>
          ))}
        </motion.div>

        {/* Domain Marquee */}
        <div className="mt-16 overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-6">
          <p className="mb-4 text-center text-xs font-medium uppercase tracking-wider text-white/30">
            Expert knowledge across 40+ disciplines
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {DOMAINS.map((domain) => (
              <span
                key={domain}
                className="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-xs text-white/50 transition hover:border-white/10 hover:text-white/70"
              >
                {domain}
              </span>
            ))}
            <span className="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-xs text-indigo-400/60">
              + 25 more
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      number: "01",
      title: "Describe your client",
      description:
        "Tell ORACLE about your client's business, industry, and goals. It remembers everything.",
    },
    {
      number: "02",
      title: "Get expert output",
      description:
        "ORACLE leverages 40+ domains, quality scoring, and multi-agent orchestration to deliver.",
    },
    {
      number: "03",
      title: "Deliver & invoice",
      description:
        "Export proposals, generate GST invoices, track payments — all from one platform.",
    },
  ];

  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            How it works
          </h2>
          <p className="mt-4 text-base text-white/40">
            Three steps from client brief to delivered work.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              className="relative"
            >
              <div className="mb-4 text-5xl font-black text-indigo-600/20">
                {step.number}
              </div>
              <h3 className="mb-2 text-lg font-semibold text-white">
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-white/40">
                {step.description}
              </p>
              {i < steps.length - 1 && (
                <div className="absolute top-8 right-0 hidden h-px w-12 bg-gradient-to-r from-white/10 to-transparent md:block" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section id="pricing" className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-base text-white/40">
            Start free. Upgrade when you&apos;re ready.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {PRICING.map((plan) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
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
                <h3 className="text-lg font-semibold text-white">
                  {plan.name}
                </h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-sm text-white/40">{plan.period}</span>
                  )}
                </div>
                <p className="mt-2 text-xs text-white/40">
                  {plan.description}
                </p>
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

              <Link
                href={plan.href}
                className={cn(
                  "flex h-11 items-center justify-center rounded-xl text-sm font-semibold transition",
                  plan.popular
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-500"
                    : "border border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10 hover:text-white"
                )}
              >
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section id="testimonials" className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            Trusted by agency founders
          </h2>
          <p className="mt-4 text-base text-white/40">
            See what agency owners are saying about ORACLE.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((testimonial, i) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl border border-white/5 bg-white/[0.02] p-6"
            >
              <div className="mb-4 flex gap-0.5">
                {[...Array(5)].map((_, j) => (
                  <svg
                    key={j}
                    className="h-4 w-4 text-amber-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="mb-4 text-sm leading-relaxed text-white/60">
                &ldquo;{testimonial.quote}&rdquo;
              </p>
              <div>
                <p className="text-sm font-semibold text-white">
                  {testimonial.name}
                </p>
                <p className="text-xs text-white/40">
                  {testimonial.role} · {testimonial.city}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-indigo-600/10 via-violet-600/5 to-purple-600/10 p-12 text-center md:p-16">
          {/* Background glow */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 left-1/2 h-[300px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/10 blur-[80px]" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
              Ready to supercharge your agency?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base text-white/40">
              Join agency founders using ORACLE to deliver exceptional work faster.
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
      </div>
    </section>
  );
}



// ─── Main Landing Page ─────────────────

export function LandingContent() {
  return (
    <div className="min-h-screen bg-[#020711]">
      <Navbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <PricingSection />
        <TestimonialsSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
