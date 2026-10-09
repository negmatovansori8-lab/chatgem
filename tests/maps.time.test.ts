import { describe, expect, it } from "vitest";
import {
  formatArrivalClock,
  formatArrivalRelative,
  formatDuration,
} from "@/lib/maps/geo";

describe("route time formatting", () => {
  it("formats minutes and hours in RU", () => {
    expect(formatDuration(18 * 60, "ru")).toBe("18 минут");
    expect(formatDuration(80 * 60, "ru")).toBe("1 час 20 минут");
    expect(formatDuration(195 * 60, "ru")).toBe("3 часа 15 минут");
  });

  it("formats relative arrival from real duration", () => {
    expect(formatArrivalRelative(25 * 60, "ru")).toBe("через 25 минут");
    expect(formatArrivalRelative(18 * 60, "en")).toBe("in 18 minutes");
  });

  it("computes clock arrival = now + duration", () => {
    const now = new Date("2026-09-26T15:30:00");
    expect(formatArrivalClock(25 * 60, "ru", now)).toBe("примерно в 15:55");
  });
});
