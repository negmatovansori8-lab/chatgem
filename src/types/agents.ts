import { z } from "zod";

export const agentCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  instructions: z.string().min(1).max(20000),
  tools: z.array(z.string()).max(20).optional(),
});

export const agentRunSchema = z.object({
  input: z.string().min(1).max(20000),
});

export type AgentRecord = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  instructions: string;
  tools: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AgentRunRecord = {
  id: string;
  agentId: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELED";
  input: string;
  output: string | null;
  progress: Array<{ step: string; detail: string }>;
  createdAt: string;
  updatedAt: string;
};
