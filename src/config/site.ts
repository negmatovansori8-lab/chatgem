export const brand = {
  name: "ChatGem",
  shortName: "ChatGem",
  tagline: "From one idea — to a whole world",
  description:
    "Chat, agents, tools, projects, knowledge, coding, learning, voice, and image — one workspace built for serious teams and creators.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  sloganTg: "Аз як идея — ба як ҷаҳон",
  sloganRu: "От одной идеи — к целому миру",
  sloganEn: "From one idea — to a whole world",
} as const;

export const plans = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: "month",
    description: "Explore the workspace and core chat experience.",
    features: [
      "Live AI chat (unlimited)",
      "Agents, projects, knowledge",
      "Google sign-in & full workspace",
      "No feature locks on Free",
    ],
    cta: "Sign in",
    highlighted: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: 9,
    period: "month",
    description: "Stronger AI for 1 month via Visa.",
    features: [
      "Everything in Free",
      "GPT OSS 120B answers",
      "More accurate replies",
      "Visa · 1 month",
    ],
    cta: "Buy Pro with Visa",
    highlighted: true,
  },
  {
    id: "business",
    name: "Business",
    price: 19,
    period: "month",
    description: "Team seats and admin — when payments go live.",
    features: [
      "Everything in Pro",
      "Organization seats",
      "Shared knowledge",
      "Admin analytics",
    ],
    cta: "Talk to sales",
    highlighted: false,
  },
] as const;

import { isPaymentsConfigured } from "@/lib/lemon-squeezy";

export const featureFlags = {
  aiProvidersConfigured:
    process.env.AI_PROVIDERS_CONFIGURED === "true" ||
    Boolean(process.env.OPENAI_API_KEY?.trim() || process.env.GROQ_API_KEY?.trim()),
  /** Stripe and/or Lemon Squeezy. */
  paymentsConfigured: isPaymentsConfigured(),
  /** DuckDuckGo works without keys; Tavily when key present. */
  webSearchConfigured: true,
  voiceConfigured:
    process.env.VOICE_PROVIDERS_CONFIGURED !== "false" &&
    Boolean(process.env.OPENAI_API_KEY?.trim() || process.env.DEEPGRAM_API_KEY?.trim()),
  imageConfigured: true,
} as const;
