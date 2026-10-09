/**
 * ChatGPT-class creative briefs — short user ideas → world-class image prompts.
 * Unique ChatGem craft (not a clone of any named service).
 */

export type CreativeMode =
  | "general"
  | "logo"
  | "photo"
  | "poster"
  | "banner"
  | "illustration"
  | "icon"
  | "sticker"
  | "product"
  | "social"
  | "edit";

const MODE_CRAFT: Record<CreativeMode, string> = {
  general:
    "premium art-directed still, balanced composition, intentional lighting, gallery-ready finish",
  logo:
    "award-winning brand identity mark, flat vector geometry, scalable silhouette, centered on solid or transparent-friendly field, no mockup, no photo texture, no 3D phone frame, crisp edges",
  photo:
    "photorealistic DSLR capture, natural color science, tack-sharp focus, magazine editorial quality, believable materials and depth of field",
  poster:
    "print-ready poster layout, bold visual hierarchy, intentional negative space, high contrast focal subject, campaign-ready",
  banner:
    "wide cinematic banner, strong left-to-right flow, hero subject clear at small sizes, marketing-ready",
  illustration:
    "polished digital illustration, clean shapes, deliberate palette, art-directed storytelling",
  icon:
    "app icon mark, simple memorable silhouette, high contrast, reads at 32px, flat or soft-3D glyph, centered",
  sticker:
    "die-cut sticker style, bold outline, playful but clean, transparent-friendly edges, merch-ready",
  product:
    "commercial product photography, softbox lighting, accurate materials, catalog white or lifestyle set, retail-ready",
  social:
    "social-first visual, scroll-stopping focal point, clear subject, optimized for feed thumbnails",
  edit:
    "faithful edit of the provided scene, preserve identity and composition unless asked to change, seamless photoreal result",
};

/** Expand a short idea into a professional English prompt (sync, no LLM). */
const MODE_FORMAT: Partial<Record<CreativeMode, string>> = {
  logo: "logo",
  icon: "app icon",
  poster: "poster",
  banner: "banner",
  photo: "photo",
  product: "product photo",
  illustration: "illustration",
  sticker: "illustration",
};

/** Prefix the studio mode as a format word the prompt engine understands, unless the user already named one. */
export function withModeFormat(idea: string, mode: CreativeMode): string {
  const format = MODE_FORMAT[mode];
  const text = idea.trim();
  if (!format || new RegExp(`(?<![\\p{L}])${format.split(" ").pop()}`, "iu").test(text)) return text;
  return `${format}: ${text}`;
}

export function craftCreativeBrief(
  idea: string,
  mode: CreativeMode,
  extras?: { brand?: string; industry?: string; styleHint?: string },
): string {
  const raw = idea.trim().replace(/\s+/g, " ");
  if (!raw) return "";

  const craft = MODE_CRAFT[mode];
  const bits: string[] = [];

  if (mode === "logo") {
    const brand = extras?.brand?.trim() || raw;
    bits.push(
      `Professional logo for "${brand}"`,
      extras?.industry ? `industry: ${extras.industry}` : "",
      extras?.styleHint || "",
      "primary mark + optional clean wordmark",
      "iconic, timeless, distinctive negative space",
      craft,
      "no watermark, no stock-photo clutter, no random letters",
    );
  } else if (mode === "edit") {
    bits.push(
      `Edit the image: ${raw}`,
      craft,
      "keep original subject identity unless the edit requires change",
      "no watermark",
    );
  } else {
    bits.push(raw, craft, extras?.styleHint || "", "no watermark, no UI chrome");
  }

  return bits.filter((b) => Boolean(b && b.trim())).join(". ").slice(0, 1100);
}

/** System prompt for LLM enhance — ChatGPT-level craft. */
export function creativeEnhanceSystem(mode: CreativeMode): string {
  return [
    "You are a world-class creative director writing prompts for DALL·E / GPT Image.",
    "Output ONLY one English image prompt (max 500 characters). No preamble.",
    "Turn short messy ideas into premium professional results.",
    "Keep the user's subject EXACT — never replace with unrelated people/phones/mockups.",
    `Mode craft: ${MODE_CRAFT[mode]}`,
    "Include: subject, composition, lighting, materials, camera/lens or design craft, color direction.",
    "Forbid: watermark, UI frames, low-res blur, gibberish typography, C03-style random letters.",
    mode === "logo"
      ? "Logo mode: vector brand mark, centered, plain field, optional brand name once if provided."
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function mapModeToKind(
  mode: CreativeMode,
): "logo" | "photo" | "general" {
  if (mode === "logo" || mode === "icon") return "logo";
  if (mode === "photo" || mode === "product") return "photo";
  return "general";
}

export function mapModeToStyle(
  mode: CreativeMode,
):
  | "auto"
  | "photo"
  | "cinematic"
  | "illustration"
  | "3d"
  | "product"
  | "concept"
  | "poster"
  | "anime"
  | "fantasy"
  | "scifi" {
  switch (mode) {
    case "logo":
    case "icon":
    case "sticker":
      return "illustration";
    case "photo":
      return "photo";
    case "product":
      return "product";
    case "poster":
    case "banner":
    case "social":
      return "poster";
    case "illustration":
      return "illustration";
    default:
      return "auto";
  }
}
