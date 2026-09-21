export type PluginDef = {
  id: string;
  name: string;
  description: string;
  color: string;
  letter: string;
  section: "popular" | "productivity" | "creativity" | "education" | "security" | "finance" | "business";
  /** AI skill works in chat without external OAuth */
  skill: string;
  /** Needs real OAuth/API for full product features */
  needsOAuth?: boolean;
};

export const PLUGIN_CATALOG: PluginDef[] = [
  // Popular / general
  {
    id: "dropbox",
    name: "Dropbox",
    description: "Find, create, and take action",
    color: "#0061ff",
    letter: "Db",
    section: "popular",
    skill: "Help the user organize files, folders, and sharing plans as if using Dropbox. Give clear steps and folder structures.",
    needsOAuth: true,
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Insights to action in HubSpot",
    color: "#ff7a59",
    letter: "H",
    section: "popular",
    skill: "Act as a HubSpot CRM assistant: pipelines, contacts, emails, and CRM best practices.",
    needsOAuth: true,
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Accept payments. Grow revenue.",
    color: "#635bff",
    letter: "S",
    section: "popular",
    skill: "Help with Stripe payments, checkout, subscriptions, and payouts. Prefer ChatGem billing when relevant.",
    needsOAuth: false,
  },
  {
    id: "canva",
    name: "Canva",
    description: "Create, review, edit designs",
    color: "#00c4cc",
    letter: "C",
    section: "creativity",
    skill: "Help design layouts, captions, color palettes, and Canva-style creative briefs.",
    needsOAuth: true,
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Письма и черновики",
    color: "#ea4335",
    letter: "M",
    section: "popular",
    skill: "Draft, rewrite, and organize emails in a Gmail style. Do not claim you sent mail.",
    needsOAuth: true,
  },
  {
    id: "gdrive",
    name: "Google Drive",
    description: "Файлы и документы",
    color: "#4285f4",
    letter: "D",
    section: "popular",
    skill: "Help structure Drive folders, docs, and file workflows. Do not claim access to real Drive files.",
    needsOAuth: true,
  },
  {
    id: "github",
    name: "GitHub",
    description: "Репозитории и issues",
    color: "#24292f",
    letter: "G",
    section: "popular",
    skill: "Help with GitHub issues, PRs, README, and git workflows.",
    needsOAuth: true,
  },
  {
    id: "outlook",
    name: "Outlook Email",
    description: "Почта Microsoft",
    color: "#0078d4",
    letter: "O",
    section: "popular",
    skill: "Draft Outlook emails and meeting notes. Do not claim you sent mail.",
    needsOAuth: true,
  },

  // Productivity
  {
    id: "notion",
    name: "Notion",
    description: "Notion docs and workflows",
    color: "#111111",
    letter: "N",
    section: "productivity",
    skill: "Create Notion-style pages, databases, and workflows as markdown templates.",
    needsOAuth: true,
  },
  {
    id: "gcal",
    name: "Google Calendar",
    description: "Manage Google Calendar events",
    color: "#1a73e8",
    letter: "31",
    section: "productivity",
    skill: "Plan schedules and events. Output calendar-ready event lists. Do not claim you created real calendar events.",
    needsOAuth: true,
  },
  {
    id: "outlook-cal",
    name: "Outlook Calendar",
    description: "Manage Outlook schedules",
    color: "#0078d4",
    letter: "O",
    section: "productivity",
    skill: "Plan Outlook-style meetings and agendas. Do not claim you booked real meetings.",
    needsOAuth: true,
  },
  {
    id: "monday",
    name: "monday.com",
    description: "Manage projects, tasks & CRM",
    color: "#ff3d57",
    letter: "m",
    section: "productivity",
    skill: "Build monday.com style boards, columns, and task plans.",
    needsOAuth: true,
  },
  {
    id: "slack",
    name: "Slack",
    description: "Read and manage Slack",
    color: "#4a154b",
    letter: "#",
    section: "productivity",
    skill: "Draft Slack messages, channel plans, and standups. Do not claim you posted to Slack.",
    needsOAuth: true,
  },
  {
    id: "superhuman",
    name: "Superhuman Mail",
    description: "Best email+calendar assistant",
    color: "#5b4cff",
    letter: "S",
    section: "productivity",
    skill: "Act as a fast email+calendar assistant: short, sharp drafts and prioritization.",
    needsOAuth: true,
  },
  {
    id: "teams",
    name: "Teams",
    description: "Summarize Teams and follow up",
    color: "#5059c9",
    letter: "T",
    section: "productivity",
    skill: "Summarize meeting notes and write Teams follow-ups.",
    needsOAuth: true,
  },
  {
    id: "hostinger-mail",
    name: "Hostinger Mail",
    description: "Use Hostinger Mail",
    color: "#673de6",
    letter: "H",
    section: "productivity",
    skill: "Help with Hostinger email setup and professional email writing.",
    needsOAuth: true,
  },

  // Creativity
  {
    id: "higgsfield",
    name: "Higgsfield",
    description: "Every image and video model",
    color: "#7c3aed",
    letter: "H",
    section: "creativity",
    skill: "Write strong image/video generation prompts and creative direction.",
    needsOAuth: true,
  },
  {
    id: "runway",
    name: "Runway",
    description: "Generate with every AI model",
    color: "#0a0a0a",
    letter: "R",
    section: "creativity",
    skill: "Help with Runway-style video prompts, shots, and editing plans.",
    needsOAuth: true,
  },
  {
    id: "figma",
    name: "Figma",
    description: "Create designs, ship to code",
    color: "#a259ff",
    letter: "F",
    section: "creativity",
    skill: "Describe UI layouts, components, and Figma-to-code structure.",
    needsOAuth: true,
  },

  // Education
  {
    id: "consensus",
    name: "Consensus",
    description: "Explore scientific research",
    color: "#0f766e",
    letter: "C",
    section: "education",
    skill: "Help explore scientific topics carefully. Cite uncertainty; do not invent papers.",
    needsOAuth: true,
  },
  {
    id: "explain-video",
    name: "Explain Video Generator",
    description: "Free AI explainer video maker",
    color: "#f59e0b",
    letter: "E",
    section: "education",
    skill: "Write explainer video scripts, scenes, and voiceover text.",
    needsOAuth: false,
  },
  {
    id: "tarteel",
    name: "Tarteel",
    description: "Explore Quranic resources",
    color: "#166534",
    letter: "ط",
    section: "education",
    skill: "Help with respectful Quranic study guidance and learning plans. Be accurate and humble.",
    needsOAuth: true,
  },
  {
    id: "scispace",
    name: "SciSpace",
    description: "For science and research",
    color: "#1d4ed8",
    letter: "S",
    section: "education",
    skill: "Explain scientific concepts clearly and help structure research notes.",
    needsOAuth: true,
  },
  {
    id: "boltz",
    name: "Boltz",
    description: "Predict structures, screen molecules",
    color: "#0ea5e9",
    letter: "B",
    section: "education",
    skill: "Explain molecular structure concepts at a high level. Do not invent lab results.",
    needsOAuth: true,
  },

  // Security
  {
    id: "codex-security",
    name: "Codex Security",
    description: "Security scanning for your codebase",
    color: "#111827",
    letter: "C",
    section: "security",
    skill: "Review code for security issues and suggest safe fixes. Never provide exploit steps.",
    needsOAuth: false,
  },
  {
    id: "malwarebytes",
    name: "Malwarebytes",
    description: "Verify links, domains, phones.",
    color: "#004cff",
    letter: "M",
    section: "security",
    skill: "Advise on phishing and suspicious links safety practices. Do not claim live scans.",
    needsOAuth: true,
  },
  {
    id: "privacyhawk",
    name: "PrivacyHawk",
    description: "Protect your personal data",
    color: "#7c3aed",
    letter: "P",
    section: "security",
    skill: "Give practical privacy tips for accounts, passwords, and data sharing.",
    needsOAuth: true,
  },
  {
    id: "purevpn",
    name: "PureVPN Privacy Assistant",
    description: "Secure Browsing Guidance",
    color: "#e11d48",
    letter: "V",
    section: "security",
    skill: "Explain VPN basics and secure browsing habits. Do not claim live VPN control.",
    needsOAuth: true,
  },

  // Finance
  {
    id: "ibkr",
    name: "Interactive Brokers (IBKR)",
    description: "Analyze global markets",
    color: "#d97706",
    letter: "IB",
    section: "finance",
    skill: "Explain markets and portfolio concepts educationally. Not financial advice.",
    needsOAuth: true,
  },
];

export const PLUGIN_SECTIONS: Array<{ id: PluginDef["section"]; labelKey: string }> = [
  { id: "popular", labelKey: "plugins.popular" },
  { id: "productivity", labelKey: "plugins.productivity" },
  { id: "creativity", labelKey: "plugins.creativity" },
  { id: "education", labelKey: "plugins.education" },
  { id: "security", labelKey: "plugins.security" },
  { id: "finance", labelKey: "plugins.finance" },
  { id: "business", labelKey: "plugins.business" },
];

export function getPlugin(id: string) {
  return PLUGIN_CATALOG.find((p) => p.id === id);
}

export function pluginSystemPrompt(id: string) {
  const p = getPlugin(id);
  if (!p) return "";
  return [
    `PLUGIN MODE: ${p.name}`,
    p.skill,
    "Be useful immediately. If real account access is needed, say so clearly — never fake connected accounts.",
  ].join("\n");
}
