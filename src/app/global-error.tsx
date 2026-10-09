"use client";

import { useEffect } from "react";

/** Root-layout crash: no providers or global CSS here, so styles are inline. */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="tg">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: "max(2rem, env(safe-area-inset-top)) 24px max(2rem, env(safe-area-inset-bottom))",
          background: "#09090b",
          color: "#fafafa",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          textAlign: "center",
        }}
      >
        <title>ChatGem</title>
        <h1 style={{ fontSize: 24, margin: 0 }}>Хатогӣ рух дод · Something went wrong</h1>
        <p style={{ margin: 0, maxWidth: 360, color: "#a1a1aa", lineHeight: 1.5 }}>
          Барнома бор нашуд. Аз нав кӯшиш кунед. · The app failed to load. Please try again.
        </p>
        <button
          type="button"
          onClick={() => retry()}
          style={{
            marginTop: 16,
            minHeight: 48,
            padding: "0 28px",
            borderRadius: 14,
            border: 0,
            background: "#14b8a6",
            color: "#042f2e",
            fontSize: 16,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Аз нав · Try again
        </button>
      </body>
    </html>
  );
}
