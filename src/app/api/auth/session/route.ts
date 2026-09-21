import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createLocalUser,
  getSessionUser,
  setSessionUser,
} from "@/server/auth/session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(120).optional(),
  mode: z.enum(["login", "register"]).default("login"),
});

const profileSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  image: z.string().url().nullable().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 },
    );
  }

  // Local credentials session for product UX.
  // Password is accepted but not persisted until a real auth DB is wired.
  const user = createLocalUser({
    email: parsed.data.email,
    name: parsed.data.name,
    provider: "credentials",
  });
  await setSessionUser(user);

  return NextResponse.json({
    user,
    notice:
      parsed.data.mode === "register"
        ? "Account session created locally. Connect PostgreSQL + email verification for production auth."
        : "Signed in locally. OAuth providers activate when client IDs are configured.",
  });
}

export async function PATCH(request: Request) {
  const current = await getSessionUser();
  if (!current) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not signed in" } },
      { status: 401 },
    );
  }
  const body = await request.json().catch(() => ({}));
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 },
    );
  }
  const next = {
    ...current,
    name: parsed.data.name ?? current.name,
    image: parsed.data.image === undefined ? current.image : parsed.data.image,
  };
  await setSessionUser(next);
  return NextResponse.json({ user: next });
}
