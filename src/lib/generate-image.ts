/**
 * @deprecated Prefer `@/providers/images` — kept as a thin re-export for chat/API.
 */
export {
  generateImageFromPrompt,
  runImageGeneration,
  aspectToSize,
} from "@/providers/images";
export type {
  ImageAspect,
  ImageStyle,
  ImageKind,
  ImageGenResult,
} from "@/providers/images/types";
