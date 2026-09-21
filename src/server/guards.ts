/**
 * Server utilities placeholder.
 * Auth sessions, rate limiting, and secure headers expand in later phases.
 */
export function assertServerOnly() {
  if (typeof window !== "undefined") {
    throw new Error("This module is server-only.");
  }
}
