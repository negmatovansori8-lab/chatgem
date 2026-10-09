/** Music search is a Pro feature. Admins keep it without paying. */
export function musicSearchAllowed(input: { role?: string | null; planId?: string | null }) {
  if (input.role === "ADMIN" || input.role === "SUPER_ADMIN") return true;
  return input.planId === "pro" || input.planId === "business";
}
