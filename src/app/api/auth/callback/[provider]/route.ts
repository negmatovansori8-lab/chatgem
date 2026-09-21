import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createLocalUser,
  encodeSession,
  sessionCookieOptions,
} from "@/server/auth/session";
import type { AuthProviderId } from "@/server/auth/providers";
import { resolveAppUrl, trimEnv } from "@/server/auth/app-url";

type Params = { params: Promise<{ provider: string }> };

async function exchangeGoogle(code: string, redirectUri: string) {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: trimEnv(process.env.GOOGLE_CLIENT_ID),
      client_secret: trimEnv(process.env.GOOGLE_CLIENT_SECRET),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    const detail = await tokenRes.text().catch(() => "");
    throw new Error(
      `Google token exchange failed (${tokenRes.status}). Check redirect URI in Google Console matches: ${redirectUri}. ${detail.slice(0, 120)}`,
    );
  }
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) throw new Error("Google access token missing");

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!profileRes.ok) throw new Error("Google profile fetch failed");
  const profile = (await profileRes.json()) as {
    email?: string;
    name?: string;
    picture?: string;
  };
  if (!profile.email) throw new Error("Google email missing");
  return {
    email: profile.email,
    name: profile.name,
    image: profile.picture ?? null,
  };
}

async function exchangeGithub(code: string, redirectUri: string) {
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenRes.ok) throw new Error("GitHub token exchange failed");
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) throw new Error("GitHub access token missing");

  const profileRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!profileRes.ok) throw new Error("GitHub profile fetch failed");
  const profile = (await profileRes.json()) as {
    email?: string | null;
    name?: string | null;
    login?: string;
    avatar_url?: string;
  };

  let email = profile.email;
  if (!email) {
    const emailsRes = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (emailsRes.ok) {
      const emails = (await emailsRes.json()) as Array<{
        email: string;
        primary?: boolean;
        verified?: boolean;
      }>;
      email =
        emails.find((e) => e.primary && e.verified)?.email ||
        emails.find((e) => e.verified)?.email ||
        emails[0]?.email;
    }
  }

  if (!email) throw new Error("GitHub email missing");
  return {
    email,
    name: profile.name || profile.login || email.split("@")[0],
    image: profile.avatar_url ?? null,
  };
}

export async function GET(request: Request, { params }: Params) {
  const { provider } = await params;
  const base = resolveAppUrl(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const jar = await cookies();
  const expectedState = jar.get("nj_oauth_state")?.value;

  if (oauthError) {
    return NextResponse.redirect(
      new URL(
        `/login?oauth_error=${encodeURIComponent(`Google: ${oauthError}`)}`,
        base,
      ),
    );
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(
      new URL(`/login?oauth_error=${encodeURIComponent("OAuth state mismatch")}`, base),
    );
  }

  const redirectUri = `${base}/api/auth/callback/${provider}`;

  try {
    let profile: { email: string; name?: string | null; image?: string | null };
    if (provider === "google") {
      profile = await exchangeGoogle(code, redirectUri);
    } else if (provider === "github") {
      profile = await exchangeGithub(code, redirectUri);
    } else {
      return NextResponse.redirect(
        new URL(`/login?oauth_error=${encodeURIComponent("Unsupported provider")}`, base),
      );
    }

    const user = createLocalUser({
      email: profile.email,
      name: profile.name || undefined,
      image: profile.image ?? null,
      provider: provider as AuthProviderId,
    });

    const res = NextResponse.redirect(new URL("/app/chat", base));
    res.cookies.set("nj_session", encodeSession(user), sessionCookieOptions());
    res.cookies.delete("nj_oauth_state");
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth failed";
    return NextResponse.redirect(
      new URL(`/login?oauth_error=${encodeURIComponent(message)}`, base),
    );
  }
}
