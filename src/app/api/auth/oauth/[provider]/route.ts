import { NextResponse } from "next/server";
import { getOAuthProviderStatus } from "@/server/auth/providers";
import { resolveAppUrl, trimEnv } from "@/server/auth/app-url";

type Params = { params: Promise<{ provider: string }> };

export async function GET(request: Request, { params }: Params) {
  const { provider } = await params;
  const status = getOAuthProviderStatus().find((p) => p.id === provider);
  const base = resolveAppUrl(request);

  if (!status) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Unknown provider" } },
      { status: 404 },
    );
  }

  if (!status.configured) {
    return NextResponse.redirect(
      new URL(
        `/login?oauth_error=${encodeURIComponent(`${status.name} is not configured. Add client ID/secret in .env`)}`,
        base,
      ),
    );
  }

  // Google OAuth in Electron Simple Browser often returns Error 400 —
  // clients should open Chrome via /api/auth/open-browser. We still issue
  // the Google redirect so that Chrome session can complete the flow.

  const redirectUri = `${base}/api/auth/callback/${provider}`;
  const state = crypto.randomUUID();

  if (provider === "google") {
    const clientId = trimEnv(process.env.GOOGLE_CLIENT_ID);
    if (!clientId) {
      return NextResponse.redirect(
        new URL(
          `/login?oauth_error=${encodeURIComponent("GOOGLE_CLIENT_ID missing in .env")}`,
          base,
        ),
      );
    }

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("access_type", "online");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("prompt", "select_account");
    url.searchParams.set("state", state);

    const res = NextResponse.redirect(url.toString());
    res.cookies.set("nj_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
      secure: base.startsWith("https://"),
    });
    res.headers.set("x-oauth-redirect-uri", redirectUri);
    return res;
  }

  if (provider === "github") {
    const clientId = trimEnv(process.env.GITHUB_CLIENT_ID);
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "read:user user:email");
    url.searchParams.set("state", state);
    const res = NextResponse.redirect(url.toString());
    res.cookies.set("nj_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
      secure: base.startsWith("https://"),
    });
    return res;
  }

  return NextResponse.redirect(
    new URL(
      `/login?oauth_error=${encodeURIComponent("Apple Sign In wiring is prepared but not enabled yet.")}`,
      base,
    ),
  );
}
