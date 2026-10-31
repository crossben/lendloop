import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  requireAdmin,
  requireAdminForMutation,
  requireToolOwner,
  requireUser,
  requireUserForMutation,
} from "./lib/auth";
import {
  MAX_TOOL_DESCRIPTION_LENGTH,
  MAX_TOOL_NAME_LENGTH,
  MIN_TOOL_DESCRIPTION_LENGTH,
  toolCategoryValidator,
  toolConditionValidator,
} from "./lib/constants";
import { todayUtc } from "./lib/dates";
import { appError } from "./lib/errors";

type ToolAvailability = {
  isAvailableNow: boolean;
  currentLoanEndsOn: string | null;
  upcomingLoanStart: string | null;
};

async function getAvailability(
  ctx: QueryCtx | MutationCtx,
  toolId: Id<"tools">,
  today: string,
): Promise<ToolAvailability> {
  const approved = await ctx.db
    .query("loans")
    .withIndex("by_tool_and_status", (q) => q.eq("toolId", toolId).eq("status", "approved"))
    .collect();

  const current = approved
    .filter((loan) => loan.startDate <= today && loan.endDate >= today)
    .sort((a, b) => a.endDate.localeCompare(b.endDate))[0];

  const upcoming = approved
    .filter((loan) => loan.startDate > today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

  return {
    isAvailableNow: !current,
    currentLoanEndsOn: current?.endDate ?? null,
    upcomingLoanStart: upcoming?.startDate ?? null,
  };
}

function validateToolFields(input: {
  name: string;
  description: string;
}): { name: string; description: string } {
  const name = input.name.trim();
  const description = input.description.trim();

  if (name.length < 2 || name.length > MAX_TOOL_NAME_LENGTH) {
    throw appError(
      "INVALID_ARGUMENT",
      `Give the tool a name between 2 and ${MAX_TOOL_NAME_LENGTH} characters.`,
    );
  }
  if (
    description.length < MIN_TOOL_DESCRIPTION_LENGTH ||
    description.length > MAX_TOOL_DESCRIPTION_LENGTH
  ) {
    throw appError(
      "INVALID_ARGUMENT",
      `Add a short description (${MIN_TOOL_DESCRIPTION_LENGTH}–${MAX_TOOL_DESCRIPTION_LENGTH} characters).`,
    );
  }

  return { name, description };
}

async function removeToolAndDeclineRequests(
  ctx: MutationCtx,
  tool: Doc<"tools">,
  removedBy: Id<"users">,
): Promise<void> {
  const now = Date.now();
  await ctx.db.patch(tool._id, {
    status: "removed",
    removedAt: now,
    removedBy,
    updatedAt: now,
  });

  const pending = await ctx.db
    .query("loans")
    .withIndex("by_tool_and_status", (q) =>
      q.eq("toolId", tool._id).eq("status", "requested"),
    )
    .collect();

  for (const loan of pending) {
    await ctx.db.patch(loan._id, {
      status: "declined",
      decidedAt: now,
      updatedAt: now,
    });
    // The borrower still deserves a notification that the listing is gone.
    await ctx.scheduler.runAfter(0, internal.notifications.notifyLoanEvent, {
      loanId: loan._id,
      event: "declined",
    });
  }
}

/**
 * Public, signed-out catalogue. Deliberately returns ONLY name + category:
 * no tool owner id, name, email, description, condition or loan data can ever
 * be serialized to an anonymous visitor.
 */
export const listPublic = query({
  args: {},
  returns: v.array(
    v.object({
      name: v.string(),
      category: toolCategoryValidator,
    }),
  ),
  handler: async (ctx) => {
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    return tools
      .map((tool) => ({ name: tool.name, category: tool.category }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

/** Signed-in catalogue with availability and the trusted-lender badge. */
export const list = query({
  args: {
    category: v.optional(toolCategoryValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const today = todayUtc();

    const tools = args.category
      ? await ctx.db
          .query("tools")
          .withIndex("by_status_and_category", (q) =>
            q.eq("status", "active").eq("category", args.category!),
          )
          .collect()
      : await ctx.db
          .query("tools")
          .withIndex("by_status", (q) => q.eq("status", "active"))
          .collect();

    const results = [];
    for (const tool of tools.sort((a, b) => b._creationTime - a._creationTime)) {
      const owner = await ctx.db.get(tool.ownerId);
      const availability = await getAvailability(ctx, tool._id, today);

      results.push({
        _id: tool._id,
        name: tool.name,
        category: tool.category,
        condition: tool.condition,
        description: tool.description,
        isOwner: tool.ownerId === user._id,
        ownerFirstName: owner?.firstName ?? "Neighbor",
        ownerTrustedLender: owner?.trustedLender ?? false,
        isAvailableNow: availability.isAvailableNow,
        currentLoanEndsOn: availability.currentLoanEndsOn,
        upcomingLoanStart: availability.upcomingLoanStart,
      });
    }

    return results;
  },
});

export const myListings = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const today = todayUtc();
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();

    const results = [];
    for (const tool of tools.filter((item) => item.status === "active")) {
      const loans = await ctx.db
        .query("loans")
        .withIndex("by_tool", (q) => q.eq("toolId", tool._id))
        .collect();
      const availability = await getAvailability(ctx, tool._id, today);

      results.push({
        _id: tool._id,
        name: tool.name,
        category: tool.category,
        condition: tool.condition,
        description: tool.description,
        pendingRequests: loans.filter((loan) => loan.status === "requested").length,
        activeLoans: loans.filter(
          (loan) =>
            loan.status === "approved" &&
            loan.startDate <= today &&
            loan.endDate >= today,
        ).length,
        isAvailableNow: availability.isAvailableNow,
        currentLoanEndsOn: availability.currentLoanEndsOn,
      });
    }

    return results.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    category: toolCategoryValidator,
    condition: toolConditionValidator,
    description: v.string(),
  },
  returns: v.id("tools"),
  handler: async (ctx, args) => {
    const user = await requireUserForMutation(ctx);
    const fields = validateToolFields(args);
    const now = Date.now();

    return await ctx.db.insert("tools", {
      ownerId: user._id,
      name: fields.name,
      category: args.category,
      condition: args.condition,
      description: fields.description,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    toolId: v.id("tools"),
    name: v.string(),
    category: toolCategoryValidator,
    condition: toolConditionValidator,
    description: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { tool } = await requireToolOwner(ctx, args.toolId);
    const fields = validateToolFields(args);

    await ctx.db.patch(tool._id, {
      name: fields.name,
      category: args.category,
      condition: args.condition,
      description: fields.description,
      updatedAt: Date.now(),
    });
    return null;
  },
});

/** Owner deletes their own listing. Pending requests are declined atomically. */
export const remove = mutation({
  args: {
    toolId: v.id("tools"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, tool } = await requireToolOwner(ctx, args.toolId);
    await removeToolAndDeclineRequests(ctx, tool, user._id);
    return null;
  },
});

/** Admin moderation: remove any listing, with the same decline semantics. */
export const adminRemove = mutation({
  args: {
    toolId: v.id("tools"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdminForMutation(ctx);
    const tool = await ctx.db.get(args.toolId);
    if (!tool) {
      throw appError("NOT_FOUND", "That listing no longer exists.");
    }
    if (tool.status === "removed") return null;
    await removeToolAndDeclineRequests(ctx, tool, admin._id);
    return null;
  },
});

export const listForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const tools = await ctx.db.query("tools").collect();
    const results = [];

    for (const tool of tools.sort((a, b) => b._creationTime - a._creationTime)) {
      const owner = await ctx.db.get(tool.ownerId);
      results.push({
        _id: tool._id,
        name: tool.name,
        category: tool.category,
        condition: tool.condition,
        description: tool.description,
        status: tool.status,
        ownerFirstName: owner?.firstName ?? "Unknown",
        ownerEmail: owner?.email ?? "",
        ownerTrustedLender: owner?.trustedLender ?? false,
        createdAt: tool.createdAt,
      });
    }

    return results;
  },
});
