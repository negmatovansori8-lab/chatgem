export type Role = "USER" | "ADMIN" | "SUPER_ADMIN";
export type PlanTier = "FREE" | "PRO" | "BUSINESS";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "PROVIDER_NOT_CONFIGURED"
  | "USAGE_EXCEEDED"
  | "RATE_LIMITED";

export interface ApiError {
  code: ApiErrorCode;
  message: string;
}
