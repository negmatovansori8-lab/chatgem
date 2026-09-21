import type { Role } from "@/types";

export type AuthProviderId = "google" | "github" | "apple";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  provider: "guest" | "credentials" | AuthProviderId;
  planId: "free" | "pro" | "business";
  role: Role;
  createdAt: string;
};

export type OAuthProviderStatus = {
  id: AuthProviderId;
  name: string;
  configured: boolean;
  authUrl: string;
};

export function getOAuthProviderStatus(): OAuthProviderStatus[] {
  return [
    {
      id: "google",
      name: "Google",
      configured: Boolean(
        process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim(),
      ),
      authUrl: "/api/auth/oauth/google",
    },
    {
      id: "github",
      name: "GitHub",
      configured: Boolean(
        process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET,
      ),
      authUrl: "/api/auth/oauth/github",
    },
    {
      id: "apple",
      name: "Apple",
      configured: Boolean(
        process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET,
      ),
      authUrl: "/api/auth/oauth/apple",
    },
  ];
}
