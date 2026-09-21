export const brand = {
  name: "ChatGem",
  shortName: "ChatGem",
  tagline: "Multi-model intelligence for real work",
  description:
    "Chat, agents, tools, projects, knowledge, coding, learning, voice, and image — one workspace built for serious teams and creators.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;

export const navigation = {
  marketing: [] as { href: string; labelKey: string }[],
  app: [
    { href: "/app", labelKey: "sidebar.home", icon: "home" },
    { href: "/app/chat", labelKey: "sidebar.newChat", icon: "message" },
    { href: "/app/chats", labelKey: "sidebar.chats", icon: "history" },
    { href: "/app/tools", labelKey: "sidebar.tools", icon: "wrench" },
    { href: "/app/projects", labelKey: "sidebar.projects", icon: "folder" },
    { href: "/app/files", labelKey: "sidebar.files", icon: "file" },
    { href: "/app/knowledge", labelKey: "sidebar.knowledge", icon: "book" },
    { href: "/app/search", labelKey: "sidebar.search", icon: "search" },
    { href: "/app/learn", labelKey: "sidebar.learn", icon: "graduation" },
    { href: "/app/code", labelKey: "sidebar.code", icon: "code" },
    { href: "/app/images", labelKey: "sidebar.images", icon: "image" },
    { href: "/app/voice", labelKey: "sidebar.voice", icon: "mic" },
    { href: "/app/agents", labelKey: "sidebar.agents", icon: "bot" },
    { href: "/app/memory", labelKey: "sidebar.memory", icon: "brain" },
    { href: "/app/billing", labelKey: "sidebar.billing", icon: "credit" },
    { href: "/app/team", labelKey: "sidebar.team", icon: "users" },
    { href: "/app/growth", labelKey: "sidebar.growth", icon: "chart" },
    { href: "/app/admin", labelKey: "sidebar.admin", icon: "shield" },
    { href: "/app/profile", labelKey: "sidebar.profile", icon: "user" },
    { href: "/app/settings", labelKey: "sidebar.settings", icon: "settings" },
  ],
  mobile: [
    { href: "/app", labelKey: "mobile.home", icon: "home" },
    { href: "/app/chat", labelKey: "mobile.chat", icon: "message" },
    { href: "/app/tools", labelKey: "mobile.tools", icon: "wrench" },
    { href: "/app/projects", labelKey: "mobile.projects", icon: "folder" },
    { href: "/app/profile", labelKey: "mobile.profile", icon: "user" },
  ],
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
    cta: "Start Free",
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

export const featureFlags = {
  aiProvidersConfigured: process.env.AI_PROVIDERS_CONFIGURED === "true",
  /** Real charges only when Stripe secret key is present. */
  paymentsConfigured: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
  webSearchConfigured: process.env.WEB_SEARCH_CONFIGURED === "true",
  voiceConfigured: process.env.VOICE_PROVIDERS_CONFIGURED === "true",
  imageConfigured: process.env.IMAGE_PROVIDERS_CONFIGURED === "true",
} as const;
