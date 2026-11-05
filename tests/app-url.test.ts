import { afterEach, describe, expect, it } from "vitest";
import { resolveAppUrl } from "@/server/auth/app-url";

const env = process.env as Record<string, string | undefined>;
const prevEnv = env.NODE_ENV;
const prevApp = process.env.NEXT_PUBLIC_APP_URL;
const prevAuth = process.env.NEXTAUTH_URL;

afterEach(() => {
  env.NODE_ENV = prevEnv;
  if (prevApp === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = prevApp;
  if (prevAuth === undefined) delete process.env.NEXTAUTH_URL;
  else process.env.NEXTAUTH_URL = prevAuth;
});

function request(host: string) {
  return new Request(`http://127.0.0.1:10000/api/auth/oauth/google`, {
    headers: {
      host: "127.0.0.1:10000",
      "x-forwarded-host": host,
      "x-forwarded-proto": "https",
    },
  });
}

describe("resolveAppUrl", () => {
  it("uses the live Render host when the env URL is still localhost", () => {
    env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    delete process.env.NEXTAUTH_URL;
    expect(resolveAppUrl(request("chatgem-b8ho.onrender.com"))).toBe(
      "https://chatgem-b8ho.onrender.com",
    );
  });

  it("prefers the custom domain when Render's host is onrender.com", () => {
    env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    delete process.env.NEXTAUTH_URL;
    const req = new Request("http://127.0.0.1:10000/api/auth/oauth/google", {
      headers: {
        host: "chatgem-b8hc.onrender.com",
        "x-forwarded-host": "chatgem.pp.ua",
        "x-forwarded-proto": "https",
      },
    });
    expect(resolveAppUrl(req)).toBe("https://chatgem.pp.ua");
  });

  it("keeps the public site when the request arrived on the Render hostname", () => {
    env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_APP_URL = "https://chatgem.pp.ua";
    delete process.env.NEXTAUTH_URL;
    expect(resolveAppUrl(request("chatgem-b8hc.onrender.com"))).toBe("https://chatgem.pp.ua");
  });

  it("keeps localhost in development", () => {
    env.NODE_ENV = "development";
    process.env.NEXT_PUBLIC_APP_URL = "https://chatgem-b8ho.onrender.com";
    expect(resolveAppUrl(request("localhost:3000"))).toBe("https://localhost:3000");
  });
});
