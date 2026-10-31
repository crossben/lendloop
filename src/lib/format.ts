import type {
  LoanStatus,
  NotificationEvent,
  ToolCategory,
  ToolCondition,
} from "../../convex/lib/constants";

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  "power-tools": "Power tools",
  garden: "Garden",
  kitchen: "Kitchen",
  camping: "Camping",
  cleaning: "Cleaning",
  other: "Other",
};

export const CONDITION_LABELS: Record<ToolCondition, string> = {
  new: "New",
  good: "Good",
  fair: "Fair",
  worn: "Worn",
};

export const STATUS_LABELS: Record<LoanStatus, string> = {
  requested: "Pending",
  approved: "Approved",
  declined: "Declined",
  returned: "Returned",
};

export const EVENT_LABELS: Record<NotificationEvent, string> = {
  requested: "Request",
  approved: "Approval",
  declined: "Decline",
  returned: "Return",
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function formatDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return dateFormatter.format(parsed);
}

export function formatShortDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return shortDateFormatter.format(parsed);
}

export function formatDateRange(startDate: string, endDate: string): string {
  if (startDate === endDate) return formatDate(startDate);
  return `${formatDate(startDate)} → ${formatDate(endDate)}`;
}

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function addDaysIso(date: string, days: number): string {
  const parsed = Date.parse(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed)) return date;
  return new Date(parsed + days * 86_400_000).toISOString().slice(0, 10);
}

export function relativeTime(timestamp: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 7 * 86_400) return `${Math.floor(seconds / 86_400)}d ago`;
  return dateFormatter.format(new Date(timestamp));
}

export type Activity = {
  kind: "notification" | "reminder";
  status: "sent" | "failed";
  event: NotificationEvent | null;
  at: number;
};

export function activityLabel(activity: Activity): string {
  const when = relativeTime(activity.at);
  if (activity.kind === "reminder") {
    return activity.status === "sent"
      ? `Reminder sent ${when}`
      : `Reminder failed ${when}`;
  }
  const event = activity.event ? `${EVENT_LABELS[activity.event].toLowerCase()} ` : "";
  return activity.status === "sent"
    ? `${event}notification sent ${when}`
    : `${event}notification failed ${when}`;
}
