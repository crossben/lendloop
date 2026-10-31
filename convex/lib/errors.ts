import { ConvexError } from "convex/values";

export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "ACCOUNT_NOT_READY"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_ARGUMENT"
  | "INVALID_DATES"
  | "INVALID_TRANSITION"
  | "DATES_UNAVAILABLE"
  | "OWN_TOOL"
  | "ALREADY_RETURNED";

export type AppErrorData = {
  code: AppErrorCode;
  message: string;
};

/**
 * User-safe application error. The Convex client only ever receives the
 * structured `{ code, message }` payload, never a stack trace or database row.
 */
export function appError(code: AppErrorCode, message: string): ConvexError<AppErrorData> {
  return new ConvexError({ code, message });
}
