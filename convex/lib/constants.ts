import { v } from "convex/values";

/** Values shared by the Convex backend and the Next.js client. */
export const TOOL_CATEGORIES = [
  "power-tools",
  "garden",
  "kitchen",
  "camping",
  "cleaning",
  "other",
] as const;

export const TOOL_CONDITIONS = ["new", "good", "fair", "worn"] as const;

export const LOAN_STATUSES = [
  "requested",
  "approved",
  "declined",
  "returned",
] as const;

export const NOTIFICATION_EVENTS = [
  "requested",
  "approved",
  "declined",
  "returned",
] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number];
export type ToolCondition = (typeof TOOL_CONDITIONS)[number];
export type LoanStatus = (typeof LOAN_STATUSES)[number];
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export const MAX_TOOL_NAME_LENGTH = 80;
export const MAX_TOOL_DESCRIPTION_LENGTH = 500;
export const MIN_TOOL_DESCRIPTION_LENGTH = 10;
export const MAX_LOAN_MESSAGE_LENGTH = 280;

export const toolCategoryValidator = v.union(
  v.literal("power-tools"),
  v.literal("garden"),
  v.literal("kitchen"),
  v.literal("camping"),
  v.literal("cleaning"),
  v.literal("other"),
);

export const toolConditionValidator = v.union(
  v.literal("new"),
  v.literal("good"),
  v.literal("fair"),
  v.literal("worn"),
);

export const loanStatusValidator = v.union(
  v.literal("requested"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("returned"),
);

export const notificationEventValidator = v.union(
  v.literal("requested"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("returned"),
);

export const userRoleValidator = v.union(
  v.literal("user"),
  v.literal("admin"),
);

export const toolStatusValidator = v.union(
  v.literal("active"),
  v.literal("removed"),
);
