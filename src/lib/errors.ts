import { ConvexError } from "convex/values";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Only structured ConvexError data is surfaced to the user. Unexpected errors
 * keep a generic message so stack traces and internals never leak into the UI.
 */
export function getErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (error instanceof ConvexError) {
    if (typeof error.data === "string") return error.data;
    if (isRecord(error.data) && typeof error.data.message === "string") {
      return error.data.message;
    }
  }

  if (error instanceof Error) {
    if (/not authenticated|unauthenticated/i.test(error.message)) {
      return "Sign in to continue.";
    }
    if (/failed to fetch|network/i.test(error.message)) {
      return "Could not reach the server. Check your connection and try again.";
    }
  }

  return fallback;
}
