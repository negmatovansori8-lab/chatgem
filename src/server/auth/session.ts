import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { SessionUser } from "@/server/auth/providers";
import { resolveRole } from "@/server/auth/roles";

const COOKIE = "nj_session";

function secret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "nurjahon-dev-secret-change-me";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(user: SessionUser) {
  const payload = Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(token: string): SessionUser | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const user = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionUser;
    return { ...user, role: resolveRole(user.email) };
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  return decode(raw);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  };
}

export function encodeSession(user: SessionUser) {
  return encode({ ...user, role: resolveRole(user.email) });
}

export async function setSessionUser(user: SessionUser) {
  const jar = await cookies();
  jar.set(COOKIE, encode({ ...user, role: resolveRole(user.email) }), sessionCookieOptions());
}

export async function clearSessionUser() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export function createLocalUser(input: {
  email: string;
  name?: string;
  image?: string | null;
  provider?: SessionUser["provider"];
}): SessionUser {
  const email = input.email.trim().toLowerCase();
  return {
    id: crypto.randomUUID(),
    email,
    name: input.name?.trim() || email.split("@")[0] || "User",
    image: input.image ?? null,
    provider: input.provider ?? "credentials",
    planId: "free",
    role: resolveRole(email),
    createdAt: new Date().toISOString(),
  };
}
