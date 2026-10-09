/** Image generation provider contracts — UI stays provider-agnostic. */

export type ImageKind = "logo" | "photo" | "general";

export type ImageAspect = "1:1" | "16:9" | "9:16" | "3:2" | "2:3" | "4:3" | "3:4";

export type ImageQuality = "standard" | "hd";

/** Styles that only append real prompt guidance (never fake UI knobs). */
export type ImageStyle =
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
  | "scifi";

export type ImageGenRequest = {
  prompt: string;
  kind?: ImageKind | "auto";
  aspect?: ImageAspect;
  style?: ImageStyle;
  negativePrompt?: string;
  quality?: ImageQuality;
  /** Number of images to generate (1–4), each with a distinct seed/variation. */
  variants?: number;
  /** When true, nudge composition for a variation of the same subject. */
  variation?: boolean;
  /** Skip LLM prompt enhancement (studio already enhanced). */
  skipEnhance?: boolean;
  signal?: AbortSignal;
};

export type ImageGenSuccess = {
  ok: true;
  url: string;
  provider: string;
  kind: ImageKind;
  /** Enhanced prompt actually sent to the model */
  prompt: string;
  /** User-facing subject / original intent */
  subject: string;
  originalPrompt: string;
  aspect: ImageAspect;
  style: ImageStyle;
  width: number;
  height: number;
  warning?: string;
  /** Short caption in the user's language. */
  title?: string;
  /** What the prompt engine understood: logo, icon, map, flag, poster, photo… */
  briefKind?: string;
  /** Additional variants when variants > 1 */
  images?: Array<{
    url: string;
    width: number;
    height: number;
    provider: string;
  }>;
};

export type ImageGenFailure = {
  ok: false;
  detail: string;
  status?: number;
  code?: "VALIDATION" | "AUTH" | "QUOTA" | "RATE_LIMIT" | "TIMEOUT" | "NETWORK" | "PROVIDER" | "UNKNOWN";
};

export type ImageGenResult = ImageGenSuccess | ImageGenFailure;

export type ImageProvider = {
  id: string;
  /** Whether secrets/env for this provider are present */
  available: () => boolean;
  generate: (req: {
    prompt: string;
    kind: ImageKind;
    aspect: ImageAspect;
    signal?: AbortSignal;
    quality?: ImageQuality;
    seed?: number;
    negativePrompt?: string;
    /** Prompt is already written for this model — send it unchanged. */
    exact?: boolean;
  }) => Promise<
    | { ok: true; url: string; provider: string; width: number; height: number }
    | { ok: false; detail: string; status?: number }
  >;
};

export function aspectToSize(aspect: ImageAspect): { width: number; height: number; openai: string } {
  switch (aspect) {
    case "16:9":
      return { width: 1536, height: 1024, openai: "1536x1024" };
    case "9:16":
      return { width: 1024, height: 1536, openai: "1024x1536" };
    case "3:2":
      return { width: 1536, height: 1024, openai: "1536x1024" };
    case "2:3":
      return { width: 1024, height: 1536, openai: "1024x1536" };
    case "4:3":
      return { width: 1365, height: 1024, openai: "1536x1024" };
    case "3:4":
      return { width: 1024, height: 1365, openai: "1024x1536" };
    case "1:1":
    default:
      return { width: 1024, height: 1024, openai: "1024x1024" };
  }
}

export function stylePromptSuffix(style: ImageStyle, kind: ImageKind): string {
  if (kind === "logo") {
    return "award-winning brand identity, flat vector logo mark, centered, crisp edges, limited solid colours, plain background, no mockup, no photo";
  }
  if (style === "auto") {
    if (kind === "photo") {
      return "photorealistic, natural light, sharp detail, high dynamic range";
    }
    return "highly detailed, balanced composition, professional visual quality";
  }
  const map: Record<Exclude<ImageStyle, "auto">, string> = {
    photo:
      "ultra-sharp professional photography, natural color, realistic materials, depth of field",
    cinematic:
      "cinematic still, dramatic lighting, anamorphic feel, film grain subtle, rich contrast, magazine cover quality",
    illustration:
      "polished digital illustration, clean shapes, intentional color palette, art-directed",
    "3d":
      "premium 3D render, soft studio lighting, crisp materials, octane-quality detail",
    product:
      "product photography, softbox lighting, clean backdrop, commercial catalog quality",
    concept:
      "concept art, imaginative environment, painterly detail, strong focal subject",
    poster:
      "graphic poster composition, bold hierarchy, intentional negative space, print-ready",
    anime:
      "high-quality anime artwork, clean linework, expressive lighting, studio animation still",
    fantasy:
      "epic fantasy art, rich atmosphere, intricate detail, magical lighting, masterpiece finish",
    scifi:
      "sci-fi concept art, futuristic design, volumetric light, ultra-detailed materials, cinematic scale",
  };
  return map[style];
}
