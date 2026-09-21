import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { resolveAppUrl } from "@/server/auth/app-url";

/**
 * Dev-only: open the real system browser (Chrome/Edge/default).
 * Cursor Simple Browser cannot complete Google OAuth (Error 400).
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only available in development" } },
      { status: 403 },
    );
  }

  const base = resolveAppUrl(request);
  if (!/localhost|127\.0\.0\.1/i.test(base)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Localhost only" } },
      { status: 403 },
    );
  }

  let path = "/login";
  try {
    const body = (await request.json().catch(() => null)) as {
      path?: string;
    } | null;
    if (body?.path === "/api/auth/oauth/google" || body?.path === "/login") {
      path = body.path;
    }
  } catch {
    // default /login
  }

  const target = `${base}${path}`;

  await new Promise<void>((resolve) => {
    const done = () => resolve();
    try {
      if (process.platform === "win32") {
        // Prefer Chrome, then Edge, then default handler
        execFile(
          "cmd",
          ["/c", "start", "", "chrome", target],
          { windowsHide: true },
          (err) => {
            if (!err) return done();
            execFile(
              "cmd",
              ["/c", "start", "", "msedge", target],
              { windowsHide: true },
              (err2) => {
                if (!err2) return done();
                execFile(
                  "cmd",
                  ["/c", "start", "", target],
                  { windowsHide: true },
                  () => done(),
                );
              },
            );
          },
        );
      } else if (process.platform === "darwin") {
        execFile("open", ["-a", "Google Chrome", target], (err) => {
          if (!err) return done();
          execFile("open", [target], () => done());
        });
      } else {
        execFile("xdg-open", [target], () => done());
      }
    } catch {
      done();
    }
  });

  return NextResponse.json({ ok: true, opened: target });
}
