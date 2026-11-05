import { NextResponse } from "next/server";
import { z } from "zod";
import { userRepository } from "@/repositories/user-repository";
import { getSessionUser, setSessionUser } from "@/server/auth/session";

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

  try {
    const user =
      parsed.data.mode === "register"
        ? await userRepository.register({
            email: parsed.data.email,
            password: parsed.data.password,
            name: parsed.data.name,
          })
        : await userRepository.login({
            email: parsed.data.email,
            password: parsed.data.password,
          });
    await setSessionUser(user);
    return NextResponse.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sign-in failed";
    const taken = /аллакай/i.test(message);
    return NextResponse.json(
      { error: { code: taken ? "CONFLICT" : "AUTH_ERROR", message } },
      { status: taken ? 409 : 401 },
    );
  }
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
