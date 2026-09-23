import { z } from "zod";

export const createChatSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  modelId: z.string().min(1).max(120).optional(),
});

export const updateChatSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
  modelId: z.string().min(1).max(120).nullable().optional(),
});

export const chatAttachmentSchema = z.object({
  name: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  size: z.number().int().positive().max(25 * 1024 * 1024),
  /** Base64 data URL for images — used for vision, not persisted long-term. */
  dataUrl: z.string().min(20).max(7_000_000).optional(),
});

export const chatMessageSchema = z
  .object({
    chatId: z.string().min(1).optional(),
    content: z.string().max(32000).default(""),
    modelId: z.string().min(1).max(120).optional(),
    locale: z.string().min(2).max(16).optional(),
    pluginId: z.string().min(1).max(64).optional(),
    agentInstructions: z.string().min(1).max(8000).optional(),
    /** Force image generation for this turn (ChatGem image mode). */
    forceImage: z.boolean().optional(),
    attachments: z.array(chatAttachmentSchema).max(5).optional(),
  })
  .refine(
    (v) => Boolean(v.content?.trim()) || Boolean(v.attachments?.length),
    { message: "Message text or attachment required" },
  );

export type ChatRecord = {
  id: string;
  userId: string;
  title: string;
  modelId: string | null;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MessageRecord = {
  id: string;
  chatId: string;
  role: "USER" | "ASSISTANT" | "SYSTEM" | "TOOL";
  content: string;
  modelId: string | null;
  createdAt: string;
  attachments?: Array<{
    name: string;
    mimeType: string;
    size: number;
  }>;
};

export type ChatAttachment = z.infer<typeof chatAttachmentSchema>;

export type UsageRecord = {
  userId: string;
  metric: string;
  amount: number;
  periodKey: string;
};
