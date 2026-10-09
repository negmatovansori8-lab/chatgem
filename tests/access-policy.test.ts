import { describe, expect, it } from "vitest";
import { freeLimitApplies } from "@/lib/access-policy";

const now = new Date("2026-10-03T12:00:00.000Z");

describe("freeLimitApplies", () => {
  it("lets the admin use everything without paying", () => {
    expect(
      freeLimitApplies({
        role: "SUPER_ADMIN",
        planId: "free",
        createdAt: "2026-01-01T00:00:00.000Z",
        now,
      }),
    ).toBe(false);
    expect(freeLimitApplies({ role: "ADMIN", planId: "free", createdAt: "2026-01-01T00:00:00.000Z", now })).toBe(
      false,
    );
  });

  it("lets a paid plan through", () => {
    expect(
      freeLimitApplies({
        role: "USER",
        planId: "pro",
        createdAt: "2026-01-01T00:00:00.000Z",
        now,
      }),
    ).toBe(false);
  });

  it("waits one month, then limits people who did not buy", () => {
    expect(
      freeLimitApplies({
        role: "USER",
        planId: "free",
        createdAt: "2026-09-28T00:00:00.000Z",
        now,
      }),
    ).toBe(false);
    expect(
      freeLimitApplies({
        role: "USER",
        planId: "free",
        createdAt: "2026-08-01T00:00:00.000Z",
        now,
      }),
    ).toBe(true);
  });
});
