"use client";

import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PROVIDERS } from "@/data/providers";
import { useRouterStore } from "@/stores/router.store";

// ─── Types ────────────────────────────

interface AgencyProfile {
  agencyName: string;
  ownerName: string;
  city: string;
  services: string[];
}

type Step = "welcome" | "provider" | "ready";

// ─── Service Options ──────────────────

const SERVICE_OPTIONS = [
  { id: "seo", label: "SEO", emoji: "🔍" },
  { id: "google-ads", label: "Google Ads", emoji: "📊" },
  { id: "meta-ads", label: "Meta Ads", emoji: "📱" },
  { id: "social-media", label: "Social Media", emoji: "💬" },
  { id: "content", label: "Content Marketing", emoji: "✍️" },
  { id: "web-dev", label: "Website Development", emoji: "💻" },
  { id: "saas", label: "SaaS Development", emoji: "🚀" },
  { id: "mobile", label: "Mobile Apps", emoji: "📲" },
  { id: "email", label: "Email Marketing", emoji: "📧" },
  { id: "whatsapp", label: "WhatsApp Marketing", emoji: "💬" },
  { id: "branding", label: "Brand Identity", emoji: "🎨" },
  { id: "analytics", label: "Data Analytics", emoji: "📈" },
];

// ─── Recommended Providers ────────────

const RECOMMENDED_PROVIDERS = [
  "groq",       // 14,400 req/day free
  "google",     // 1M tokens/day free
  "openrouter", // 200+ free models
  "cerebras",   // 600 req/min free
];

// ─── Animation Variants ───────────────

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
  }),
};

// ─── Main Component ───────────────────

export function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<Step>("welcome");
  const [direction, setDirection] = useState(1);
  const [profile, setProfile] = useState<AgencyProfile>({
    agencyName: "",
    ownerName: "",
    city: "",
    services: [],
  });
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { setByokKey, setSelectedModel, configuredProviders } = useRouterStore();

  // Auto-complete if user already has API keys (existing users)
  useEffect(() => {
    if (configuredProviders.length > 0) {
      onComplete();
    }
  }, [configuredProviders, onComplete]);

  const goNext = useCallback(() => {
    setDirection(1);
    if (step === "welcome") setStep("provider");
    else if (step === "provider") setStep("ready");
  }, [step]);

  const goBack = useCallback(() => {
    setDirection(-1);
    if (step === "provider") setStep("welcome");
    else if (step === "ready") setStep("provider");
  }, [step]);

  // Save agency profile to localStorage
  const saveProfile = useCallback(() => {
    localStorage.setItem(
      "oracle-agency-profile",
      JSON.stringify({
        agencyName: profile.agencyName,
        ownerName: profile.ownerName,
        city: profile.city,
        services: profile.services.join(", "),
      })
    );
  }, [profile]);

  // Test and save API key
  const handleTestAndSave = useCallback(async () => {
    if (!selectedProvider || !apiKey) return;
    setTesting(true);
    setTestResult(null);

    try {
      await setByokKey(selectedProvider, apiKey);

      const proxyResponse = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: 'Say "ok" in one word.' }],
          stream: false,
          maxTokens: 10,
        }),
      });

      if (!proxyResponse.ok) {
        throw new Error("Test failed");
      }

      setTestResult("success");

      const provider = PROVIDERS.find((p) => p.id === selectedProvider);
      if (provider?.models[0]) {
        setSelectedModel(selectedProvider, provider.models[0].id);
      }
    } catch {
      setTestResult("error");
    } finally {
      setTesting(false);
    }
  }, [selectedProvider, apiKey, setByokKey, setSelectedModel]);

  // Skip provider step (use free models)
  const handleSkipProvider = useCallback(() => {
    const groqProvider = PROVIDERS.find((p) => p.id === "groq");
    if (groqProvider?.models[0]) {
      setSelectedModel("groq", groqProvider.models[0].id);
    }
    // Advance to next step
    setDirection(1);
    setStep("ready");
  }, [setSelectedModel]);

  // Complete onboarding
  const handleComplete = useCallback(async () => {
    setIsSaving(true);
    try {
      saveProfile();
      onComplete();
    } finally {
      setIsSaving(false);
    }
  }, [saveProfile, onComplete]);

  // Toggle service selection
  const toggleService = useCallback((serviceId: string) => {
    setProfile((prev) => ({
      ...prev,
      services: prev.services.includes(serviceId)
        ? prev.services.filter((s) => s !== serviceId)
        : [...prev.services, serviceId],
    }));
  }, []);

  const canProceedFromProvider = testResult === "success" || !apiKey;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--oracle-bg)]">
      <div className="pointer-events-none fixed inset-0 oracle-bg-radial" aria-hidden="true" />

      <div className="relative z-10 w-full max-w-lg px-4">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            {(["welcome", "provider", "ready"] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold transition-all ${
                    step === s
                      ? "oracle-gradient-bg text-white scale-110"
                      : (s === "welcome" || (s === "provider" && step === "ready"))
                      ? "bg-[var(--oracle-success)]/20 text-[var(--oracle-success)]"
                      : "bg-[var(--oracle-surface-2)] text-[var(--oracle-text-muted)]"
                  }`}
                >
                  {i + 1}
                </div>
                {i < 2 && (
                  <div
                    className={`ml-3 h-0.5 w-12 sm:w-20 transition-colors ${
                      (s === "welcome" && (step === "provider" || step === "ready")) ||
                      (s === "provider" && step === "ready")
                        ? "bg-[var(--oracle-success)]"
                        : "bg-[var(--oracle-surface-3)]"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[11px] text-[var(--oracle-text-muted)]">
            <span>Welcome</span>
            <span>Connect AI</span>
            <span>Ready!</span>
          </div>
        </div>

        {/* Step Content */}
        <div className="overflow-hidden rounded-2xl oracle-glass oracle-card-shadow">
          <AnimatePresence mode="wait" custom={direction}>
            {step === "welcome" && (
              <motion.div
                key="welcome"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="p-6 sm:p-8"
              >
                <WelcomeStep
                  profile={profile}
                  setProfile={setProfile}
                  toggleService={toggleService}
                  onNext={goNext}
                />
              </motion.div>
            )}

            {step === "provider" && (
              <motion.div
                key="provider"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="p-6 sm:p-8"
              >
                <ProviderStep
                  selectedProvider={selectedProvider}
                  setSelectedProvider={setSelectedProvider}
                  apiKey={apiKey}
                  setApiKey={setApiKey}
                  testing={testing}
                  testResult={testResult}
                  onTest={handleTestAndSave}
                  onSkip={handleSkipProvider}
                  onBack={goBack}
                  onNext={goNext}
                  canProceed={canProceedFromProvider}
                />
              </motion.div>
            )}

            {step === "ready" && (
              <motion.div
                key="ready"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="p-6 sm:p-8"
              >
                <ReadyStep
                  profile={profile}
                  selectedProvider={selectedProvider}
                  isSaving={isSaving}
                  onBack={goBack}
                  onComplete={handleComplete}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Skip for now */}
        <div className="mt-6 text-center">
          <button
            onClick={onComplete}
            className="text-[12px] text-[var(--oracle-text-muted)] underline transition-colors hover:text-[var(--oracle-text-2)]"
          >
            Skip for now — explore the app first
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Step 1: Welcome ──────────────────

function WelcomeStep({
  profile,
  setProfile,
  toggleService,
  onNext,
}: {
  profile: AgencyProfile;
  setProfile: React.Dispatch<React.SetStateAction<AgencyProfile>>;
  toggleService: (id: string) => void;
  onNext: () => void;
}) {
  const isValid = profile.agencyName.trim().length > 0;

  return (
    <div>
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl oracle-gradient-bg oracle-glow">
          <span className="text-2xl">⚡</span>
        </div>
        <h2 className="text-[20px] font-bold text-[var(--oracle-text-1)]">
          Welcome to ORACLE
        </h2>
        <p className="mt-1 text-[13px] text-[var(--oracle-text-muted)]">
          Let&apos;s set up your agency in 30 seconds
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-[var(--oracle-text-3)]">
            Agency name <span className="text-[var(--oracle-error)]">*</span>
          </label>
          <input
            value={profile.agencyName}
            onChange={(e) => setProfile((p) => ({ ...p, agencyName: e.target.value }))}
            placeholder="e.g. DigitalKraft Agency"
            className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-3 text-[14px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none transition-colors focus:border-[var(--oracle-primary)] focus:ring-1 focus:ring-[var(--oracle-primary)]/30"
            autoFocus
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-[var(--oracle-text-3)]">
            Your name
          </label>
          <input
            value={profile.ownerName}
            onChange={(e) => setProfile((p) => ({ ...p, ownerName: e.target.value }))}
            placeholder="e.g. Rajesh Kumar"
            className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-3 text-[14px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none transition-colors focus:border-[var(--oracle-primary)] focus:ring-1 focus:ring-[var(--oracle-primary)]/30"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-[var(--oracle-text-3)]">
            City
          </label>
          <input
            value={profile.city}
            onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))}
            placeholder="e.g. Mumbai"
            className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-3 text-[14px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none transition-colors focus:border-[var(--oracle-primary)] focus:ring-1 focus:ring-[var(--oracle-primary)]/30"
          />
        </div>

        <div>
          <label className="mb-2 block text-[12px] font-medium text-[var(--oracle-text-3)]">
            What services do you offer?
          </label>
          <div className="flex flex-wrap gap-2">
            {SERVICE_OPTIONS.map((service) => (
              <button
                key={service.id}
                onClick={() => toggleService(service.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${
                  profile.services.includes(service.id)
                    ? "oracle-gradient-bg text-white"
                    : "border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] text-[var(--oracle-text-3)] hover:border-[var(--oracle-primary)] hover:text-[var(--oracle-text-1)]"
                }`}
              >
                <span>{service.emoji}</span>
                <span>{service.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {profile.agencyName && (
        <div className="mt-4 rounded-xl bg-[var(--oracle-surface-2)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--oracle-text-muted)]">
            Preview
          </p>
          <p className="mt-1 text-[12px] text-[var(--oracle-text-2)]">
            My agency is{" "}
            <strong className="text-[var(--oracle-text-1)]">
              {profile.agencyName}
            </strong>{" "}
            based in{" "}
            <strong className="text-[var(--oracle-text-1)]">
              {profile.city || "..."}
            </strong>
            {profile.services.length > 0 && (
              <>
                {" "}
                specialising in{" "}
                <strong className="text-[var(--oracle-text-1)]">
                  {profile.services
                    .map((s) => SERVICE_OPTIONS.find((opt) => opt.id === s)?.label || s)
                    .join(", ")}
                </strong>
              </>
            )}
            . This context helps ORACLE tailor responses to your agency.
          </p>
        </div>
      )}

      <div className="mt-6">
        <button
          onClick={onNext}
          disabled={!isValid}
          className="w-full rounded-xl oracle-gradient-bg py-3 text-[14px] font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

// ─── Step 2: Connect AI Provider ──────

function ProviderStep({
  selectedProvider,
  setSelectedProvider,
  apiKey,
  setApiKey,
  testing,
  testResult,
  onTest,
  onSkip,
  onBack,
  onNext,
  canProceed,
}: {
  selectedProvider: string | null;
  setSelectedProvider: (id: string | null) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  testing: boolean;
  testResult: "success" | "error" | null;
  onTest: () => void;
  onSkip: () => void;
  onBack: () => void;
  onNext: () => void;
  canProceed: boolean;
}) {
  return (
    <div>
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--oracle-primary)]/10">
          <span className="text-2xl">🔌</span>
        </div>
        <h2 className="text-[20px] font-bold text-[var(--oracle-text-1)]">
          Connect an AI Provider
        </h2>
        <p className="mt-1 text-[13px] text-[var(--oracle-text-muted)]">
          Add one API key to get started. You can add more later.
        </p>
      </div>

      <div className="space-y-2 mb-4">
        {RECOMMENDED_PROVIDERS.map((providerId) => {
          const provider = PROVIDERS.find((p) => p.id === providerId);
          if (!provider) return null;
          const isSelected = selectedProvider === providerId;
          const hasFreeModels = provider.models.some((m) => m.isFree);

          return (
            <button
              key={providerId}
              onClick={() => setSelectedProvider(isSelected ? null : providerId)}
              className={`w-full rounded-xl p-3 text-left transition-all ${
                isSelected
                  ? "border-2 border-[var(--oracle-primary)] bg-[var(--oracle-primary)]/5"
                  : "border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] hover:border-[var(--oracle-primary)]/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${provider.color}20` }}
                  >
                    <span className="text-[11px] font-bold" style={{ color: provider.color }}>
                      {provider.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[var(--oracle-text-1)]">
                      {provider.name}
                    </p>
                    <p className="text-[10px] text-[var(--oracle-text-muted)]">
                      {provider.freeLimit}
                    </p>
                  </div>
                </div>
                {hasFreeModels && (
                  <span className="rounded-full bg-[var(--oracle-success)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--oracle-success)]">
                    FREE
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selectedProvider && (
        <div className="mt-4 rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[12px] font-medium text-[var(--oracle-text-1)]">
              {PROVIDERS.find((p) => p.id === selectedProvider)?.name} API Key
            </p>
            <a
              href={PROVIDERS.find((p) => p.id === selectedProvider)?.signupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[var(--oracle-info)] underline"
            >
              Get Free Key →
            </a>
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                PROVIDERS.find((p) => p.id === selectedProvider)?.keyLabel || "Enter API key"
              }
              className="flex-1 rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-surface-3)] px-3 py-2 font-mono text-[11px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]"
            />
            {apiKey && (
              <button
                onClick={onTest}
                disabled={testing}
                className="rounded-lg bg-[var(--oracle-success)]/10 px-3 py-2 text-[11px] font-medium text-[var(--oracle-success)] hover:bg-[var(--oracle-success)]/20 disabled:opacity-50"
              >
                {testing ? "⟳ Testing..." : "Test & Save"}
              </button>
            )}
          </div>
          {testResult && (
            <p
              className={`mt-2 text-[11px] ${
                testResult === "success"
                  ? "text-[var(--oracle-success)]"
                  : "text-[var(--oracle-error)]"
              }`}
            >
              {testResult === "success"
                ? "✓ Key verified and saved securely!"
                : "✗ Invalid key or connection failed. You can try again or skip."}
            </p>
          )}
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          onClick={onBack}
          className="rounded-xl border border-[var(--oracle-border)] px-4 py-3 text-[13px] font-medium text-[var(--oracle-text-3)] transition-colors hover:bg-[var(--oracle-surface-2)]"
        >
          ← Back
        </button>
        {apiKey && testResult !== "success" ? (
          <button
            onClick={onSkip}
            className="flex-1 rounded-xl border border-[var(--oracle-border)] py-3 text-[13px] font-medium text-[var(--oracle-text-3)] transition-colors hover:bg-[var(--oracle-surface-2)]"
          >
            Skip — use free models
          </button>
        ) : (
          <button
            onClick={onNext}
            disabled={!canProceed}
            className="flex-1 rounded-xl oracle-gradient-bg py-3 text-[14px] font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue →
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Step 3: Ready! ───────────────────

function ReadyStep({
  profile,
  selectedProvider,
  isSaving,
  onBack,
  onComplete,
}: {
  profile: AgencyProfile;
  selectedProvider: string | null;
  isSaving: boolean;
  onBack: () => void;
  onComplete: () => void;
}) {
  const providerName = selectedProvider
    ? PROVIDERS.find((p) => p.id === selectedProvider)?.name || "AI Provider"
    : "Free models (Groq)";

  const serviceSummary =
    profile.services.length > 0
      ? profile.services.length + " services"
      : "";

  const detailParts = [profile.city, serviceSummary].filter(Boolean);

  return (
    <div>
      <div className="mb-6 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--oracle-success)]/10"
        >
          <span className="text-3xl">🎉</span>
        </motion.div>
        <h2 className="text-[20px] font-bold text-[var(--oracle-text-1)]">
          You&apos;re all set!
        </h2>
        <p className="mt-1 text-[13px] text-[var(--oracle-text-muted)]">
          ORACLE is configured for your agency
        </p>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl bg-[var(--oracle-surface-2)] p-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">🏢</span>
            <div>
              <p className="text-[12px] font-semibold text-[var(--oracle-text-1)]">
                {profile.agencyName || "Your Agency"}
              </p>
              <p className="text-[11px] text-[var(--oracle-text-muted)]">
                {detailParts.join(" · ")}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-[var(--oracle-surface-2)] p-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">🤖</span>
            <div>
              <p className="text-[12px] font-semibold text-[var(--oracle-text-1)]">
                {providerName}
              </p>
              <p className="text-[11px] text-[var(--oracle-text-muted)]">
                {selectedProvider
                  ? "Connected and verified"
                  : "Free tier — no API key needed"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-[var(--oracle-surface-2)] p-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">🧠</span>
            <div>
              <p className="text-[12px] font-semibold text-[var(--oracle-text-1)]">
                40+ Service Domains
              </p>
              <p className="text-[11px] text-[var(--oracle-text-muted)]">
                Expert-level AI across SEO, Ads, Content, Dev & more
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--oracle-primary)]/20 bg-[var(--oracle-primary)]/5 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--oracle-primary-l)]">
          What you can do now
        </p>
        <ul className="mt-2 space-y-1.5">
          {[
            { icon: "💬", text: "Chat with ORACLE about any client task" },
            { icon: "📋", text: "Use 55+ expert prompts for instant output" },
            { icon: "📊", text: "Get quality scores on every response" },
            { icon: "📄", text: "Generate proposals & GST invoices" },
          ].map((item) => (
            <li
              key={item.text}
              className="flex items-center gap-2 text-[12px] text-[var(--oracle-text-2)]"
            >
              <span>{item.icon}</span>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={onBack}
          className="rounded-xl border border-[var(--oracle-border)] px-4 py-3 text-[13px] font-medium text-[var(--oracle-text-3)] transition-colors hover:bg-[var(--oracle-surface-2)]"
        >
          ← Back
        </button>
        <button
          onClick={onComplete}
          disabled={isSaving}
          className="flex-1 rounded-xl oracle-gradient-bg py-3 text-[14px] font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
        >
          {isSaving ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Saving...
            </span>
          ) : (
            "Start Using ORACLE →"
          )}
        </button>
      </div>
    </div>
  );
}
