import { z } from "zod";

export type PlanId = "free" | "pro" | "business";

export type PlanDefinition = {
  id: PlanId;
  name: string;
  priceMonthly: number;
  features: string[];
  limits: {
    messages: number | null;
    projects: number | null;
    knowledgeBases: number | null;
    seats: number | null;
  };
};

export const PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    features: [
      "Чат с AI (базовая модель)",
      "Галерея и инструменты",
      "Агенты и проекты",
      "Вход через Google",
    ],
    limits: { messages: null, projects: null, knowledgeBases: null, seats: 1 },
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 9,
    features: [
      "Всё из Free",
      "Сильная модель GPT OSS 120B",
      "Более точные и полные ответы",
      "1 месяц после оплаты Visa",
    ],
    limits: { messages: null, projects: null, knowledgeBases: null, seats: 1 },
  },
  {
    id: "business",
    name: "Business",
    priceMonthly: 19,
    features: [
      "Всё из Pro",
      "Приоритет ответов",
      "Больше места в галерее",
      "1 месяц после оплаты Visa",
    ],
    limits: { messages: null, projects: null, knowledgeBases: null, seats: 5 },
  },
];

export type SubscriptionRecord = {
  userId: string;
  planId: PlanId;
  status: "ACTIVE" | "CANCELED" | "TRIALING" | "EXPIRED";
  updatedAt: string;
  /** ISO date when paid Pro/Business ends (1-month Visa window). */
  periodEnd?: string | null;
  /** Last 4 digits only — never full card. */
  cardLast4?: string | null;
};

export type OrganizationRecord = {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationMemberRecord = {
  id: string;
  organizationId: string;
  userId: string;
  email: string;
  role: "owner" | "admin" | "member";
  createdAt: string;
};

export type ReferralRecord = {
  id: string;
  userId: string;
  code: string;
  invites: number;
  conversions: number;
  createdAt: string;
};

export type AnalyticsSnapshot = {
  userId: string;
  chats: number;
  messages: number;
  projects: number;
  files: number;
  agents: number;
  periodKey: string;
};

export const orgCreateSchema = z.object({
  name: z.string().min(1).max(120),
});

export const orgMemberSchema = z.object({
  email: z.string().email().max(200),
  role: z.enum(["admin", "member"]).default("member"),
});

export const subscribeSchema = z.object({
  planId: z.enum(["free", "pro", "business"]),
});

export const visaCheckoutSchema = z.object({
  cardNumber: z.string().min(12).max(23),
  expiry: z.string().regex(/^\d{2}\/\d{2}$/),
  cvc: z.string().regex(/^\d{3,4}$/),
  planId: z.enum(["pro", "business"]).default("pro"),
});
