import type { Role } from "@/types";

const DEFAULT_ADMIN_EMAILS = [
  "negmatovansori8@gmail.com",
  "nurjahonismoilov531@gmail.com",
];

/** Emails listed in ADMIN_EMAILS (comma-separated) are ADMIN/SUPER_ADMIN. */
export function adminEmailList(): string[] {
  const fromEnv = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const merged = new Set([...DEFAULT_ADMIN_EMAILS.map((e) => e.toLowerCase()), ...fromEnv]);
  return [...merged];
}

export function resolveRole(email: string | null | undefined): Role {
  if (!email) return "USER";
  const normalized = email.trim().toLowerCase();
  if (!adminEmailList().includes(normalized)) return "USER";
  // First configured owner emails are SUPER_ADMIN
  if (
    normalized === "negmatovansori8@gmail.com" ||
    normalized === "nurjahonismoilov531@gmail.com"
  ) {
    return "SUPER_ADMIN";
  }
  return "ADMIN";
}

export function isAdminRole(role: Role | null | undefined) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function isAdminEmail(email: string | null | undefined) {
  return isAdminRole(resolveRole(email));
}
