import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import {
  requireAdmin,
  requireLoanParty,
  requireLoanPartyRead,
  requireUser,
  requireUserForMutation,
} from "./lib/auth";
import {
  loanStatusValidator,
  MAX_LOAN_MESSAGE_LENGTH,
  notificationEventValidator,
} from "./lib/constants";
import { daysBetween, isValidDateString, todayUtc } from "./lib/dates";
import { appError } from "./lib/errors";
import {
  assertTransition,
  rangesOverlap,
  validateLoanRange,
} from "./lib/loans";

async function findApprovedOverlap(
  ctx: QueryCtx | MutationCtx,
  toolId: Id<"tools">,
  startDate: string,
  endDate: string,
  excludeLoanId?: Id<"loans">,
): Promise<Doc<"loans"> | null> {
  const approved = await ctx.db
    .query("loans")
    .withIndex("by_tool_and_status", (q) =>
      q.eq("toolId", toolId).eq("status", "approved"),
    )
    .collect();

  return (
    approved.find(
      (loan) =>
        loan._id !== excludeLoanId &&
        rangesOverlap(startDate, endDate, loan.startDate, loan.endDate),
    ) ?? null
  );
}

type Activity = {
  kind: "notification" | "reminder";
  status: "sent" | "failed";
  event: "requested" | "approved" | "declined" | "returned" | null;
  at: number;
};

async function getRecentActivity(
  ctx: QueryCtx,
  loanId: Id<"loans">,
): Promise<Activity[]> {
  const notifications = await ctx.db
    .query("notifications")
    .withIndex("by_loan_and_createdAt", (q) => q.eq("loanId", loanId))
    .order("desc")
    .take(5);

  const reminders = await ctx.db
    .query("reminders")
    .withIndex("by_loan_and_createdAt", (q) => q.eq("loanId", loanId))
    .order("desc")
    .take(5);

  return [
    ...notifications.map((notification) => ({
      kind: "notification" as const,
      status: notification.status,
      event: notification.event,
      at: notification.createdAt,
    })),
    ...reminders.map((reminder) => ({
      kind: "reminder" as const,
      status: reminder.status,
      event: null,
      at: reminder.createdAt,
    })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 5);
}

async function getLatestActivity(
  ctx: QueryCtx,
  loanId: Id<"loans">,
): Promise<Activity | null> {
  const activities = await getRecentActivity(ctx, loanId);
  return activities[0] ?? null;
}

/** Borrower asks for a tool. Never waits on n8n: the webhook is scheduled. */
export const request = mutation({
  args: {
    toolId: v.id("tools"),
    startDate: v.string(),
    endDate: v.string(),
    message: v.optional(v.string()),
  },
  returns: v.id("loans"),
  handler: async (ctx, args) => {
    const user = await requireUserForMutation(ctx);
    const tool = await ctx.db.get(args.toolId);

    if (!tool || tool.status === "removed") {
      throw appError("NOT_FOUND", "That tool is no longer available.");
    }
    if (tool.ownerId === user._id) {
      throw appError("OWN_TOOL", "You cannot request your own tool.");
    }

    const range = validateLoanRange(args);
    const message = args.message?.trim() ?? "";
    if (message.length > MAX_LOAN_MESSAGE_LENGTH) {
      throw appError(
        "INVALID_ARGUMENT",
        `Keep your note under ${MAX_LOAN_MESSAGE_LENGTH} characters.`,
      );
    }

    if (await findApprovedOverlap(ctx, tool._id, range.startDate, range.endDate)) {
      throw appError(
        "DATES_UNAVAILABLE",
        "Those dates overlap an approved loan for this tool. Try another range.",
      );
    }

    const now = Date.now();
    const loanId = await ctx.db.insert("loans", {
      toolId: tool._id,
      lenderId: tool.ownerId,
      borrowerId: user._id,
      startDate: range.startDate,
      endDate: range.endDate,
      message: message || undefined,
      status: "requested",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.notifications.notifyLoanEvent, {
      loanId,
      event: "requested",
    });

    return loanId;
  },
});

/** Lender approves or declines a pending request. */
export const decide = mutation({
  args: {
    loanId: v.id("loans"),
    decision: v.union(v.literal("approve"), v.literal("decline")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { loan, isLender } = await requireLoanParty(ctx, args.loanId);

    // Admins can inspect loans, but only the lender decides. This keeps the
    // "act only on your own tools" rule intact even for moderation.
    if (!isLender) {
      throw appError("FORBIDDEN", "Only the lender can respond to this request.");
    }

    const nextStatus = args.decision === "approve" ? "approved" : "declined";
    assertTransition(loan.status, nextStatus);

    if (nextStatus === "approved") {
      const overlap = await findApprovedOverlap(
        ctx,
        loan.toolId,
        loan.startDate,
        loan.endDate,
        loan._id,
      );
      if (overlap) {
        throw appError(
          "DATES_UNAVAILABLE",
          "Another approved loan now covers those dates. Decline this request instead.",
        );
      }
    }

    const now = Date.now();
    await ctx.db.patch(loan._id, {
      status: nextStatus,
      decidedAt: now,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.notifications.notifyLoanEvent, {
      loanId: loan._id,
      event: nextStatus,
    });

    return null;
  },
});

/** Lender marks an approved loan as returned. */
export const markReturned = mutation({
  args: {
    loanId: v.id("loans"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { loan, isLender } = await requireLoanParty(ctx, args.loanId);

    if (!isLender) {
      throw appError("FORBIDDEN", "Only the lender can mark this loan as returned.");
    }

    assertTransition(loan.status, "returned");

    const now = Date.now();
    await ctx.db.patch(loan._id, {
      status: "returned",
      returnedAt: now,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.notifications.notifyLoanEvent, {
      loanId: loan._id,
      event: "returned",
    });

    return null;
  },
});

/** Borrower's requests, newest first. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_borrower_and_createdAt", (q) => q.eq("borrowerId", user._id))
      .order("desc")
      .take(100);

    const results = [];
    for (const loan of loans) {
      const tool = await ctx.db.get(loan.toolId);
      const lender = await ctx.db.get(loan.lenderId);
      results.push({
        _id: loan._id,
        toolName: tool?.name ?? "Removed listing",
        toolCategory: tool?.category ?? null,
        toolStatus: tool?.status ?? null,
        lenderFirstName: lender?.firstName ?? "Neighbor",
        startDate: loan.startDate,
        endDate: loan.endDate,
        status: loan.status,
        message: loan.message,
        createdAt: loan.createdAt,
        activity: await getLatestActivity(ctx, loan._id),
      });
    }
    return results;
  },
});

/** Lender's incoming requests, newest first. */
export const listIncoming = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_lender_and_createdAt", (q) => q.eq("lenderId", user._id))
      .order("desc")
      .take(100);

    const results = [];
    for (const loan of loans) {
      const tool = await ctx.db.get(loan.toolId);
      const borrower = await ctx.db.get(loan.borrowerId);
      results.push({
        _id: loan._id,
        toolName: tool?.name ?? "Removed listing",
        toolCategory: tool?.category ?? null,
        toolStatus: tool?.status ?? null,
        borrowerFirstName: borrower?.firstName ?? "Neighbor",
        startDate: loan.startDate,
        endDate: loan.endDate,
        status: loan.status,
        message: loan.message,
        createdAt: loan.createdAt,
        activity: await getLatestActivity(ctx, loan._id),
      });
    }
    return results;
  },
});

/** Admin view across every loan. */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_createdAt")
      .order("desc")
      .take(200);

    const results = [];
    for (const loan of loans) {
      const tool = await ctx.db.get(loan.toolId);
      const lender = await ctx.db.get(loan.lenderId);
      const borrower = await ctx.db.get(loan.borrowerId);
      results.push({
        _id: loan._id,
        toolName: tool?.name ?? "Removed listing",
        toolStatus: tool?.status ?? null,
        lenderFirstName: lender?.firstName ?? "Unknown",
        borrowerFirstName: borrower?.firstName ?? "Unknown",
        startDate: loan.startDate,
        endDate: loan.endDate,
        status: loan.status,
        createdAt: loan.createdAt,
        activity: await getLatestActivity(ctx, loan._id),
      });
    }
    return results;
  },
});

/** Loan detail for the two parties (and admins). Includes automation history. */
export const get = query({
  args: {
    loanId: v.id("loans"),
  },
  handler: async (ctx, args) => {
    const { loan, isLender } = await requireLoanPartyRead(ctx, args.loanId);
    const tool = await ctx.db.get(loan.toolId);
    const lender = await ctx.db.get(loan.lenderId);
    const borrower = await ctx.db.get(loan.borrowerId);

    return {
      _id: loan._id,
      status: loan.status,
      startDate: loan.startDate,
      endDate: loan.endDate,
      message: loan.message,
      createdAt: loan.createdAt,
      toolName: tool?.name ?? "Removed listing",
      toolCategory: tool?.category ?? null,
      lenderFirstName: lender?.firstName ?? "Neighbor",
      borrowerFirstName: borrower?.firstName ?? "Neighbor",
      isLender,
      activity: await getRecentActivity(ctx, loan._id),
    };
  },
});

/**
 * Minimal notification payload for n8n. Only the recipient's first name and
 * email are included; no full user documents, addresses or IDs beyond the loan.
 */
export const notificationPayload = internalQuery({
  args: {
    loanId: v.id("loans"),
    event: notificationEventValidator,
  },
  returns: v.union(
    v.null(),
    v.object({
      loanId: v.id("loans"),
      event: notificationEventValidator,
      toolName: v.string(),
      status: loanStatusValidator,
      startDate: v.string(),
      endDate: v.string(),
      recipientUserId: v.id("users"),
      recipientFirstName: v.string(),
      recipientEmail: v.string(),
      counterpartyFirstName: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const loan = await ctx.db.get(args.loanId);
    if (!loan) return null;

    const tool = await ctx.db.get(loan.toolId);
    const lender = await ctx.db.get(loan.lenderId);
    const borrower = await ctx.db.get(loan.borrowerId);
    if (!tool || !lender || !borrower) return null;

    const recipient = args.event === "requested" ? lender : borrower;
    const counterparty = args.event === "requested" ? borrower : lender;

    return {
      loanId: loan._id,
      event: args.event,
      toolName: tool.name,
      status: loan.status,
      startDate: loan.startDate,
      endDate: loan.endDate,
      recipientUserId: recipient._id,
      recipientFirstName: recipient.firstName,
      recipientEmail: recipient.email,
      counterpartyFirstName: counterparty.firstName,
    };
  },
});

/**
 * Overdue feed consumed by the scheduled n8n workflow. Returns only what a
 * reminder needs.
 */
export const listOverdueForAutomation = internalQuery({
  args: {},
  returns: v.object({
    reminderDate: v.string(),
    loans: v.array(
      v.object({
        loanId: v.id("loans"),
        toolName: v.string(),
        startDate: v.string(),
        endDate: v.string(),
        daysOverdue: v.number(),
        borrowerFirstName: v.string(),
        borrowerEmail: v.string(),
      }),
    ),
  }),
  handler: async (ctx) => {
    const today = todayUtc();
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_status_and_endDate", (q) =>
        q.eq("status", "approved").lt("endDate", today),
      )
      .take(100);

    const rows = [];
    for (const loan of loans) {
      const tool = await ctx.db.get(loan.toolId);
      const borrower = await ctx.db.get(loan.borrowerId);
      if (!tool || !borrower) continue;
      rows.push({
        loanId: loan._id,
        toolName: tool.name,
        startDate: loan.startDate,
        endDate: loan.endDate,
        daysOverdue: daysBetween(loan.endDate, today),
        borrowerFirstName: borrower.firstName,
        borrowerEmail: borrower.email,
      });
    }

    return {
      reminderDate: today,
      loans: rows.sort((a, b) => b.daysOverdue - a.daysOverdue),
    };
  },
});

/**
 * Idempotent write-back from n8n. `loanId + reminderDate` is the key: retries
 * return the existing row instead of creating duplicate reminder records.
 */
export const recordReminder = internalMutation({
  args: {
    loanId: v.id("loans"),
    reminderDate: v.string(),
    status: v.union(v.literal("sent"), v.literal("failed")),
    channel: v.optional(v.string()),
    providerMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  returns: v.object({
    reminderId: v.id("reminders"),
    duplicate: v.boolean(),
  }),
  handler: async (ctx, args) => {
    if (!isValidDateString(args.reminderDate)) {
      throw appError("INVALID_ARGUMENT", "reminderDate must be YYYY-MM-DD.");
    }
    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      throw appError("NOT_FOUND", "That loan no longer exists.");
    }

    const channel = (args.channel ?? "n8n").trim();
    if (channel.length === 0 || channel.length > 40) {
      throw appError("INVALID_ARGUMENT", "channel must be 1–40 characters.");
    }
    const providerMessageId = args.providerMessageId?.trim();
    if (providerMessageId && providerMessageId.length > 100) {
      throw appError("INVALID_ARGUMENT", "providerMessageId is too long.");
    }
    const error = args.error?.trim();
    if (error && error.length > 300) {
      throw appError("INVALID_ARGUMENT", "error is too long.");
    }

    const idempotencyKey = `${args.loanId}:${args.reminderDate}`;
    const existing = await ctx.db
      .query("reminders")
      .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", idempotencyKey))
      .unique();

    if (existing) {
      return { reminderId: existing._id, duplicate: true };
    }

    const reminderId = await ctx.db.insert("reminders", {
      idempotencyKey,
      loanId: loan._id,
      reminderDate: args.reminderDate,
      status: args.status,
      channel,
      recipientUserId: loan.borrowerId,
      providerMessageId: providerMessageId || undefined,
      error: error || undefined,
      createdAt: Date.now(),
    });

    return { reminderId, duplicate: false };
  },
});

/** Idempotent notification audit log, keyed by loan + lifecycle event. */
export const recordNotification = internalMutation({
  args: {
    loanId: v.id("loans"),
    event: notificationEventValidator,
    recipientUserId: v.id("users"),
    status: v.union(v.literal("sent"), v.literal("failed")),
    attempts: v.number(),
    error: v.optional(v.string()),
  },
  returns: v.object({
    notificationId: v.id("notifications"),
    duplicate: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const key = `${args.loanId}:${args.event}`;
    const existing = await ctx.db
      .query("notifications")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();

    if (existing) {
      return { notificationId: existing._id, duplicate: true };
    }

    const notificationId = await ctx.db.insert("notifications", {
      key,
      loanId: args.loanId,
      event: args.event,
      recipientUserId: args.recipientUserId,
      status: args.status,
      attempts: Math.max(1, Math.floor(args.attempts)),
      error: args.error?.slice(0, 300),
      createdAt: Date.now(),
    });

    return { notificationId, duplicate: false };
  },
});
