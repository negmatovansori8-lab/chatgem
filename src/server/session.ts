import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";

const GUEST_COOKIE = "nj_guest_id";
const GUEST_MAX_AGE = 60 * 60 * 24 * 365;

function guestCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: GUEST_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  };
}

/**
 * Prefer signed-in auth user; otherwise stable guest cookie.
 */
export async function getRequestUserId(): Promise<string> {
  const session = await getSessionUser();
  if (session?.id) return session.id;

  const jar = await cookies();
  const existing = jar.get(GUEST_COOKIE)?.value;
  if (existing) return existing;

  const id = `guest_${crypto.randomUUID()}`;
  try {
    jar.set(GUEST_COOKIE, id, guestCookieOptions());
  } catch {
    // Read-only cookie contexts — API routes should attach via withGuestCookie.
  }
  return id;
}

export function withGuestCookie(response: NextResponse, userId: string) {
  if (!userId.startsWith("guest_")) return response;
  response.cookies.set(GUEST_COOKIE, userId, guestCookieOptions());
  return response;
}

export function appendGuestCookie(headers: Headers, userId: string) {
  if (!userId.startsWith("guest_")) return headers;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  headers.append(
    "Set-Cookie",
    `${GUEST_COOKIE}=${userId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${GUEST_MAX_AGE}${secure}`,
  );
  return headers;
}
