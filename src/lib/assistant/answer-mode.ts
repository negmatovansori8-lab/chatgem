/**
 * Picks the response shape for a chat message (ready prompt, product spec,
 * code, design, how-to, short answer) and the system instructions that make
 * the model deliver a usable result instead of generic advice.
 */

export type AnswerMode = "prompt" | "build" | "code" | "design" | "technical" | "simple";

export type AnswerPlan = {
  mode: AnswerMode;
  /** Tool the prompt is meant for ("Cursor", "ChatGPT", …). */
  tool?: string;
  /** Prompt for an image model (different structure than a software prompt). */
  imagePrompt?: boolean;
  /** Only an idea was given — expand it with explicit assumptions. */
  ideaOnly?: boolean;
  /** The message is phrased as «can you …?» — the answer must start with yes/no. */
  askedAbility?: boolean;
  /** Only «can you make a prompt / build an app?» with no task yet — answer yes/no, do not deliver. */
  capability?: "prompt" | "build";
};

export const PROMPT_SECTIONS = [
  "ROLE",
  "GOAL",
  "CONTEXT",
  "REQUIREMENTS",
  "FEATURES",
  "DESIGN REQUIREMENTS",
  "TECHNICAL REQUIREMENTS",
  "USER EXPERIENCE",
  "ERROR HANDLING",
  "SECURITY",
  "PERFORMANCE",
  "RESPONSIVE REQUIREMENTS",
  "EXPECTED OUTPUT",
  "FINAL CHECKLIST",
] as const;

/** Word boundary that also works for Cyrillic (JS `\b` is ASCII-only). */
const w = (body: string) => new RegExp(`(?<![\\p{L}\\d])(?:${body})(?![\\p{L}\\d])`, "iu");

const PROMPT_RE = w(
  "пр[оа]мп?т\\p{L}*|prompt\\p{L}*|тз|т\\.з|техзадани\\p{L}*|техническ\\p{L}*\\s+задани\\p{L}*|техникӣ\\s+супориш\\p{L}*|супориши\\s+техникӣ",
);
const IMAGE_RE = w(
  "midjourney|dall-?e|stable\\s+diffusion|flux|leonardo|сурат\\p{L}*|расм\\p{L}*|тасвир\\p{L}*|image\\p{L}*|photo\\p{L}*|фото\\p{L}*|логотип\\p{L}*|логатип\\p{L}*|logo\\p{L}*|картин\\p{L}*|изображени\\p{L}*|постер\\p{L}*|poster\\p{L}*|banner|баннер\\p{L}*",
);
const PRODUCT_RE = w(
  "сайт\\p{L}*|вебсайт\\p{L}*|веб-сайт\\p{L}*|website\\p{L}*|web\\s*app\\p{L}*|app|apps|апп\\p{L}*|приложени\\p{L}*|барнома\\p{L}*|лендинг\\p{L}*|landing\\p{L}*|магазин\\p{L}*|online\\s+store|shop|бот\\p{L}*|bot|платформ\\p{L}*|platform\\p{L}*|dashboard|дашборд\\p{L}*|crm|saas|портал\\p{L}*|marketplace|маркетплейс\\p{L}*|игр[аыу]|game|project|проект\\p{L}*|лоиҳа\\p{L}*",
);
const MAKE_RE = w(
  "соз\\p{L}*|сохт\\p{L}*|бисоз\\p{L}*|сделай\\p{L}*|сделать|созда\\p{L}*|разработ\\p{L}*|build|create|make|develop|мехоҳ\\p{L}*|мехох\\p{L}*|хочу|нужен|нужно|need|want|лозим",
);
const CODE_RE = w(
  "код\\p{L}*|code|script|скрипт\\p{L}*|функци\\p{L}*|function|api|endpoint|bug|баг\\p{L}*|debug|react|next\\.?js|vue|angular|svelte|python|javascript|typescript|js|ts|html|css|tailwind|sql|java|php|laravel|django|flask|node(?:\\.?js)?|express|flutter|dart|kotlin|swift|c\\+\\+|c#|golang|rust|regex",
);
const WRITE_RE = w(
  "навис\\p{L}*|напиши\\p{L}*|написать|write|fix|ислоҳ\\p{L}*|ислох\\p{L}*|исправ\\p{L}*|соз\\p{L}*|сделай\\p{L}*|созда\\p{L}*|implement|refactor|рефактор\\p{L}*|optimi[sz]e|оптимиз\\p{L}*|debug|кор\\s+намекунад|не\\s+работает|doesn'?t\\s+work|error|ошибк\\p{L}*|хато\\p{L}*",
);
const DESIGN_RE = w("дизайн\\p{L}*|design\\p{L}*|ui|ux|ui/ux|интерфейс\\p{L}*|interface|макет\\p{L}*|mockup|figma|layout|верстк\\p{L}*");
const HOWTO_RE = w(
  "чӣ\\s+тавр|чи\\s+тавр|чӣ\\s+хел|чи\\s+хел|чӣ\\s+гуна|как(?:им\\s+образом)?|how\\s+(?:to|do|can|should)|install|насб\\p{L}*|установ\\p{L}*|настро\\p{L}*|setup|set\\s+up|танзим\\p{L}*|deploy\\p{L}*|деплой\\p{L}*|қадам\\s+ба\\s+қадам|пошагов\\p{L}*|step\\s+by\\s+step",
);

const TOOLS: [RegExp, string][] = [
  [w("cursor|курсор\\p{L}*"), "Cursor"],
  [w("chat\\s*gpt|чат\\s*гпт|чатгпт|gpt"), "ChatGPT"],
  [w("gemini|гемини|джемини|ҷемини"), "Gemini"],
  [w("claude|клод\\p{L}*"), "Claude"],
  [w("lovable"), "Lovable"],
  [w("v0"), "v0"],
  [w("bolt(?:\\.new)?"), "Bolt"],
  [w("windsurf"), "Windsurf"],
  [w("replit"), "Replit"],
  [w("midjourney"), "Midjourney"],
];

function detectTool(text: string): string | undefined {
  return TOOLS.find(([re]) => re.test(text))?.[1];
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** «Can you …?» phrasing: метавонӣ / метонӣ / можешь / can you … */
const ABILITY_RE = w(
  "мет(?:а|о)?вон\\p{L}*|метон\\p{L}*|можешь|можете|сможешь|сможете|умеешь|умеете|can\\s+you|could\\s+you|are\\s+you\\s+able",
);
/** A reply that continues after the assistant asked what the prompt / app is for. */
const FOLLOW_UP_RE = w(
  "ҳа|ха|бале|хуб|майлаш|деҳ|дех|диҳ\\p{L}*|дих\\p{L}*|навис\\p{L}*|барои|да|давай|хорошо|пиши|напиши|для|yes|ok|okay|sure|go|write|for",
);
/** Longer «can you …» messages already describe the task and get the deliverable. */
const CAPABILITY_MAX_WORDS = 8;

type PlanOptions = { ignoreAbility?: boolean };

export function detectAnswerPlan(raw: string, options: PlanOptions = {}): AnswerPlan {
  const text = raw.trim();
  const words = wordCount(text);
  const tool = detectTool(text);
  const product = PRODUCT_RE.test(text);
  const askedAbility = !options.ignoreAbility && ABILITY_RE.test(text);
  const capabilityOnly = askedAbility && words <= CAPABILITY_MAX_WORDS;

  if (PROMPT_RE.test(text)) {
    if (capabilityOnly) return { mode: "simple", capability: "prompt", askedAbility, tool };
    const imagePrompt = IMAGE_RE.test(text) && !product && tool !== "Cursor";
    return {
      mode: "prompt",
      tool: tool ?? (imagePrompt ? undefined : "Cursor"),
      imagePrompt,
      ideaOnly: words < 30,
      askedAbility,
    };
  }
  const howTo = HOWTO_RE.test(text);
  const code = CODE_RE.test(text) && WRITE_RE.test(text);
  if (product && MAKE_RE.test(text) && !howTo && !code) {
    if (capabilityOnly) return { mode: "simple", capability: "build", askedAbility, tool };
    return { mode: "build", tool: tool ?? "Cursor", ideaOnly: words < 30, askedAbility };
  }
  if (code) return { mode: "code" };
  if (DESIGN_RE.test(text)) return { mode: "design" };
  if (howTo) return { mode: "technical" };
  return { mode: "simple" };
}

/**
 * After a yes/no capability answer, the next short reply («ҳа, деҳ», «барои сайтам») is the
 * go-ahead: plan it together with the earlier question so the deliverable is produced.
 */
export function detectAnswerPlanInContext(text: string, previousUserMessage?: string): AnswerPlan {
  const plan = detectAnswerPlan(text);
  if (plan.mode !== "simple" || plan.capability || !previousUserMessage?.trim()) return plan;
  const previous = detectAnswerPlan(previousUserMessage);
  if (!previous.capability) return plan;
  const continues =
    FOLLOW_UP_RE.test(text) || PRODUCT_RE.test(text) || DESIGN_RE.test(text) || Boolean(detectTool(text));
  if (!continues) return plan;
  return detectAnswerPlan(`${previousUserMessage.trim()}\n${text.trim()}`, { ignoreAbility: true });
}

function capabilityBlock(plan: AnswerPlan): string {
  const what =
    plan.capability === "prompt"
      ? `write a ready prompt${plan.tool ? ` for ${plan.tool}` : ""}`
      : "build this (website / app / bot)";
  const offer =
    plan.capability === "prompt"
      ? "you can give a ready, professional prompt they can paste into Cursor, ChatGPT or another AI"
      : "you can plan it and write the ТЗ, structure, code and a ready prompt for Cursor";
  const examples =
    plan.capability === "prompt"
      ? "e.g. a prompt to build or upgrade a website / app, write code, design a UI, or create an image / logo"
      : "e.g. a landing page, an online store, a Telegram bot or a mobile app";
  const question =
    plan.capability === "prompt"
      ? "«Фақат бигӯ: промт барои кадом кор лозим?» / «Просто скажи: для какой задачи нужен промпт?» / «Just tell me: what do you need the prompt for?»"
      : "«Фақат бигӯ: чӣ сохтан мехоҳӣ?» / «Просто скажи: что хочешь сделать?» / «Just tell me: what would you like to build?»";
  return [
    `${OVERRIDE} ANSWER MODE — YES/NO CAPABILITY QUESTION. The user only asked whether you CAN ${what}; they have not asked for it yet.`,
    "Reply warmly and naturally, like a helpful friend — three short paragraphs, no headings, no lists:",
    `1) A clear yes as the FIRST words (e.g. «Ҳа, албатта!» / «Да, конечно!» / «Yes, of course!»; one fitting emoji is fine), then one sentence saying ${offer}.`,
    `2) One sentence with concrete examples of what it could be for (${examples}). Never invent facts about the user's own project.`,
    `3) One short question asking what they need, phrased naturally in the reply language — never translate word by word, e.g. ${question}.`,
    "Mirror the user's form of address (ту / шумо; ты / вы). Do NOT write the prompt, a ТЗ, code or a code block now. Never start with «Албатта. Ин prompt-ро…».",
  ].join("\n");
}

const ABILITY_INTRO =
  "The user phrased this as «can you …?»: the intro line MUST start with a clear yes in the reply language (e.g. «Ҳа, метавонам.» / «Да, могу.» / «Yes, I can.»), then deliver.";

const LANGUAGE_NAMES: Record<string, string> = {
  tg: "Tajik (Cyrillic)",
  ru: "Russian",
  en: "English",
  uz: "Uzbek",
  fa: "Persian",
  tr: "Turkish",
};

function languageName(locale: string) {
  return LANGUAGE_NAMES[locale.split("-")[0]?.toLowerCase() ?? ""] ?? "the user's language";
}

/** Shows the expected density — models copy the shape of an example far better than word counts. */
const SECTION_EXAMPLE = [
  "Density example for ONE section (content language adapts to the user):",
  "PERFORMANCE",
  "- Lighthouse Performance ≥ 90 on mobile; LCP < 2.5s, CLS < 0.1, INP < 200ms.",
  "- next/image with explicit sizes, AVIF/WebP, lazy-load below the fold.",
  "- Route-level code splitting; dynamic import for heavy widgets (charts, maps, editors).",
  "- Cache API responses (revalidate / SWR); debounce search inputs (300ms).",
  "- Remove unused dependencies; keep the initial JS bundle < 200 KB gzip.",
  "- Measure before/after and report the numbers.",
].join("\n");

const SHARED_PROMPT_RULES = (tool: string, language: string) =>
  [
    `Prompt body structure — use EXACTLY these headings, in this order, each alone on its own line followed by its bullets: ${PROMPT_SECTIONS.join(" / ")}.`,
    `- LANGUAGE INSIDE THE PROMPT: headings stay in English exactly as written; ALL bullet text and the text around the block in ${language}, keeping technical terms (Next.js, API, responsive…) in English. This overrides the «do not mix languages» rule.`,
    "- LENGTH IS MANDATORY: ROLE = 3–4 sentences; EXACTLY 6 specific bullets in every other section — the last sections (ERROR HANDLING … EXPECTED OUTPUT) get the same care as the first; FINAL CHECKLIST = 12 «- [ ]» items. A good prompt is 1000–1800 words. Sections with 1–3 generic bullets are a failure.",
    SECTION_EXAMPLE,
    "- Specific, not generic: name concrete pages/components, states, metrics (e.g. Lighthouse ≥ 90, LCP < 2.5s), breakpoints (<640 / 640–1024 / >1024px), tools and checks. No empty placeholders like «[insert here]» — make smart, explicitly stated assumptions instead.",
    "- CONTEXT lists the assumptions when details are missing (platform, audience, stack). Sensible modern defaults: Next.js (App Router) + TypeScript + Tailwind CSS for web; React Native/Expo or Flutter for mobile.",
    "- DESIGN REQUIREMENTS: modern UI/UX, clear visual hierarchy, typography scale, 4/8px spacing grid, color tokens, dark/light mode, animations and hover/focus states, professional look.",
    "- RESPONSIVE REQUIREMENTS: mobile, tablet and desktop breakpoints with concrete behavior for each.",
    "- SECURITY: secrets only in server-side environment variables (.env, never in frontend or git), provide .env.example, input validation, auth/rate limiting where relevant.",
    "- FINAL CHECKLIST: verifiable «- [ ]» items covering every requirement.",
    `- Written for ${tool}: imperative, unambiguous instructions it can execute end-to-end.`,
    ...(/cursor|windsurf|replit|bolt|lovable|v0/i.test(tool)
      ? [
          `- The prompt MUST tell ${tool} to: (1) first analyze the existing project structure and code; (2) propose and create the project structure; (3) create the files and write complete, working code — no TODO stubs; (4) not rewrite working code without need; (5) fix all errors, type and lint issues; (6) improve the design; (7) test the whole project — build, typecheck, lint, key user flows, mobile/tablet/desktop, console errors — and fix what fails; (8) finish with a short report of what changed.`,
        ]
      : []),
  ].join("\n");

const OVERRIDE = "THIS SECTION OVERRIDES ALL EARLIER LENGTH AND FORMAT RULES.";

function promptBlock(plan: AnswerPlan, language: string): string {
  const tool = plan.tool ?? "any AI (ChatGPT, Gemini, Claude)";
  if (plan.imagePrompt) {
    return [
      `${OVERRIDE} ANSWER MODE — READY IMAGE PROMPT${plan.tool ? ` for ${plan.tool}` : ""}. The user wants a prompt to paste into an image model; do NOT describe how to write prompts.`,
      `Format: one short intro line in ${language} → ONE \`\`\`text block with the prompt → 2 short variations (one line each).`,
      "Inside the block (English works best for image models): Subject · Style · Composition · Lighting · Color palette · Materials/details · Camera & lens (photo) or design rules (logo: vector, simple, scalable, no mockup text) · Aspect ratio · Negative prompt.",
      "World-class craft: specific, visual, no vague phrases like «nice abstract symbol».",
      plan.askedAbility ? ABILITY_INTRO : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    `${OVERRIDE} ANSWER MODE — READY-TO-USE PROMPT for ${tool}. The user will copy it straight into ${tool}. Deliver the prompt itself, never generic advice or a marketing plan.`,
    "Understand first: fix typos from context («дех» = «деҳ», «сатхи чахони» = «сатҳи ҷаҳонӣ» = WORLD-CLASS QUALITY, not global marketing). «Барномаи ман / маро» = the user's existing app → the prompt must make the tool analyze that codebase first and upgrade it everywhere (architecture, code quality, UI/UX, performance, security, tests).",
    "Never invent facts about the user's project (domain, features, audience). When they are unknown, CONTEXT tells the tool to discover them from the codebase (stack, features, structure, weak spots) and to preserve existing functionality; FEATURES then describes upgrades that apply to any app.",
    "ROLE starts with «You are …» / «Ту …» — a senior expert persona matching the task (e.g. senior full-stack engineer + product designer).",
    plan.ideaOnly
      ? "The user gave only an idea: expand it into a complete specification inside the prompt, stating assumptions in CONTEXT."
      : "Keep every requirement the user listed — do not drop any.",
    `Format (strict): 1) one intro line in ${language}, e.g. «Албатта. Ин prompt-ро бевосита ба ${tool} гузор:»; 2) ONE fenced block with language tag \`text\` containing the WHOLE prompt; 3) after it 2–4 short bullets in ${language} on how to use it and one line offering to tailor it (stack, features).`,
    plan.askedAbility ? ABILITY_INTRO : "",
    SHARED_PROMPT_RULES(tool, language),
  ]
    .filter(Boolean)
    .join("\n");
}

function buildBlock(plan: AnswerPlan, language: string): string {
  const tool = plan.tool ?? "Cursor";
  return [
    `${OVERRIDE} ANSWER MODE — BUILD A PRODUCT (website / app / bot). Give a practical, ready result, not tips. Write in ${language}.`,
    "Structure (headings in the user's language):",
    "## 1. Understanding — what they want in 2–3 lines + stated assumptions.",
    "## 2. ТЗ (technical specification) — goal, audience, pages/screens, features (MVP vs later), design direction, tech stack, data model, integrations, security, performance, responsive behavior.",
    "## 3. Project structure — file tree in a ```text block.",
    `## 4. Prompt for ${tool} — ONE \`\`\`text block with the full prompt.`,
    "## 5. Next steps — 3–5 bullets.",
    plan.ideaOnly ? "Only an idea was given: fill the gaps with sensible, explicit assumptions — do not stop to ask." : "",
    plan.askedAbility ? ABILITY_INTRO : "",
    SHARED_PROMPT_RULES(tool, language),
  ]
    .filter(Boolean)
    .join("\n");
}

const MODE_BLOCKS: Record<Exclude<AnswerMode, "prompt" | "build">, string> = {
  code: [
    "ANSWER MODE — CODE.",
    "1) Requirements — short analysis: inputs, outputs, constraints, assumptions.",
    "2) Structure — file tree when more than one file.",
    "3) Code — every file COMPLETE and runnable, each in its own fenced block with a language tag, preceded by its path as a heading (### src/app/page.tsx). No «...» placeholders, no TODOs.",
    "4) Run — exact install / run commands.",
    "5) Edge cases — which errors and inputs the code already guards against.",
    "Bug reports: root cause first, then the fixed code, then how to verify the fix.",
  ].join("\n"),
  design: [
    "ANSWER MODE — DESIGN. Concrete, professional, implementable:",
    "- Layout per breakpoint: mobile (<640px), tablet (640–1024px), desktop (>1024px).",
    "- Design tokens: colors with hex, typography scale (sizes/weights/line-heights), 4/8px spacing, radius, shadows, dark/light.",
    "- Components with states: hover, focus-visible, active, disabled, loading, empty, error.",
    "- Motion: 150–300ms, easing, respect prefers-reduced-motion.",
    "- Accessibility: WCAG AA contrast, keyboard navigation.",
    "- When asked to implement, give full code (Tailwind/CSS).",
  ].join("\n"),
  technical: [
    "ANSWER MODE — STEP-BY-STEP HOW-TO.",
    "Numbered steps; each step has the exact command, code or setting. Mention OS differences only if relevant. End with «how to verify» and the 2–3 most common errors with fixes.",
  ].join("\n"),
  simple: [
    "ANSWER MODE — GENERAL QUESTION: match the depth to the question.",
    "- Simple fact / short question → direct answer first, 1–4 clear sentences, no headings.",
    "- «Explain / фаҳмон / шарҳ деҳ / объясни / what is X» → short definition first, then a structured mini-lesson (key points + one example).",
  ].join("\n"),
};

export function answerModeBlock(plan: AnswerPlan, replyLocale: string): string {
  const language = languageName(replyLocale);
  if (plan.capability) return capabilityBlock(plan);
  if (plan.mode === "prompt") return promptBlock(plan, language);
  if (plan.mode === "build") return buildBlock(plan, language);
  return MODE_BLOCKS[plan.mode];
}

/**
 * Short reminder on the model's copy of the user turn (the stored message is
 * untouched) — the user turn outweighs a long system prompt.
 */
export function withDeliverableReminder(prompt: string, plan: AnswerPlan, replyLocale: string): string {
  if (plan.mode !== "prompt" && plan.mode !== "build") return prompt;
  const language = languageName(replyLocale);
  const what = plan.imagePrompt
    ? "a detailed image prompt in one ```text block"
    : `the COMPLETE prompt in one \`\`\`text block — all ${PROMPT_SECTIONS.length} sections (${PROMPT_SECTIONS[0]} … ${PROMPT_SECTIONS[PROMPT_SECTIONS.length - 1]}), exactly 6 specific bullets in each section, 12 checklist items`;
  const yes = plan.askedAbility ? "Start with a clear yes to the «can you» question, then deliver " : "Deliver ";
  return `${prompt}\n\n[${yes}${what}${plan.mode === "build" ? ", after the ТЗ and project structure" : ""}. Bullet text and explanations in ${language}.]`;
}

/** Larger output budget for long deliverables (Cyrillic text costs ~2–3 tokens per word). */
export function answerMaxTokens(plan: AnswerPlan): number | undefined {
  return plan.mode === "prompt" || plan.mode === "build" || plan.mode === "code" ? 8192 : undefined;
}

function largestFence(reply: string): string | null {
  const fenced = [...reply.matchAll(/```[^\n]*\n([\s\S]*?)(?:```|$)/g)].map((m) => m[1] ?? "");
  return fenced.length ? fenced.reduce((a, b) => (b.length > a.length ? b : a), "") : null;
}

/** Rough quality of a prompt deliverable: sections present, bullets, size. Higher is better. */
export function deliverableScore(reply: string): number {
  const block = largestFence(reply.trim());
  if (block == null) return 0;
  const upper = block.toUpperCase();
  const present = PROMPT_SECTIONS.filter((s) => upper.includes(s)).length;
  const bullets = block.split("\n").filter((l) => /^\s*(?:[-*•]|\d+[.)])\s+\S/.test(l)).length;
  return present * 10 + bullets + Math.min(block.length, 8000) / 400;
}

/** True when a prompt/build answer is missing the deliverable itself. */
export function isWeakDeliverable(plan: AnswerPlan, reply: string): boolean {
  if (plan.mode !== "prompt" && plan.mode !== "build") return false;
  const block = largestFence(reply.trim());
  if (block == null) return true;
  if (plan.imagePrompt) return block.length < 300;
  const upper = block.toUpperCase();
  const present = PROMPT_SECTIONS.filter((s) => upper.includes(s)).length;
  const bullets = block.split("\n").filter((l) => /^\s*(?:[-*•]|\d+[.)])\s+\S/.test(l)).length;
  return present < PROMPT_SECTIONS.length - 2 || bullets < 60 || block.length < 3500;
}

export function deliverableRewriteInstruction(plan: AnswerPlan): string {
  if (plan.imagePrompt) {
    return "CRITICAL REWRITE: the previous draft did not contain a usable image prompt. Output one intro line, then ONE ```text block with a detailed image prompt (subject, style, composition, lighting, palette, details, camera/design rules, aspect ratio, negative prompt).";
  }
  return `CRITICAL REWRITE: the previous draft was too thin to be a professional, copy-ready prompt. Output the full deliverable now: one intro line, then ONE \`\`\`text block with ALL sections — ${PROMPT_SECTIONS.join(", ")}. ROLE 3–4 sentences, EXACTLY 6 specific bullets in every other section, FINAL CHECKLIST 12 «- [ ]» items; bullet text in the user's language. No generic advice.`;
}
