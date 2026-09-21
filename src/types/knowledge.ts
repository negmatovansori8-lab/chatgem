import { z } from "zod";

export const projectCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  instructions: z.string().max(20000).optional(),
});

export const projectUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  instructions: z.string().max(20000).nullable().optional(),
});

export type ProjectRecord = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  instructions: string | null;
  fileIds: string[];
  chatIds: string[];
  knowledgeBaseIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type FileRecord = {
  id: string;
  userId: string;
  name: string;
  mimeType: string;
  size: number;
  storageKey: string;
  status: "uploaded" | "extracted" | "failed";
  extractedText: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeBaseRecord = {
  id: string;
  userId: string;
  projectId: string | null;
  name: string;
  description: string | null;
  itemIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeItemRecord = {
  id: string;
  knowledgeBaseId: string;
  fileId: string | null;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type MemoryRecord = {
  id: string;
  userId: string;
  content: string;
  category: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SearchResult = {
  title: string;
  domain: string;
  url: string;
  snippet: string;
};

export const knowledgeCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  projectId: z.string().nullable().optional(),
});

export const knowledgeItemSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(100000),
  fileId: z.string().nullable().optional(),
});

export const memoryCreateSchema = z.object({
  content: z.string().min(1).max(5000),
  category: z.string().max(80).optional(),
});

export const memoryUpdateSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  category: z.string().max(80).nullable().optional(),
  enabled: z.boolean().optional(),
});

export const searchSchema = z.object({
  query: z.string().min(1).max(500),
});
