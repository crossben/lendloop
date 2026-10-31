import { v } from "convex/values";

import { query, mutation } from "./_generated/server";
import { getViewer, requireAdmin, requireAdminForMutation, requireUserForMutation } from "./lib/auth";
import { appError } from "./lib/errors";
import { userRoleValidator } from "./lib/constants";

/**
 * Called by the client after Clerk sign-in. Also invoked implicitly by every
 * mutation, so a user record always exists before any write is accepted.
 */
export const sync = mutation({
  args: {},
  returns: v.object({
    userId: v.id("users"),
    role: userRoleValidator,
    trustedLender: v.boolean(),
  }),
  handler: async (ctx) => {
    const user = await requireUserForMutation(ctx);
    return {
      userId: user._id,
      role: user.role,
      trustedLender: user.trustedLender,
    };
  },
});

export const me = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("users"),
      firstName: v.string(),
      lastName: v.optional(v.string()),
      email: v.string(),
      imageUrl: v.optional(v.string()),
      role: userRoleValidator,
      trustedLender: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const user = await getViewer(ctx);
    if (!user) return null;
    return {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      imageUrl: user.imageUrl,
      role: user.role,
      trustedLender: user.trustedLender,
    };
  },
});

/** Admin-only: grant or revoke the "Trusted Lender" badge. */
export const setTrustedLender = mutation({
  args: {
    userId: v.id("users"),
    trusted: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminForMutation(ctx);
    const target = await ctx.db.get(args.userId);
    if (!target) {
      throw appError("NOT_FOUND", "That neighbor no longer exists.");
    }
    await ctx.db.patch(args.userId, {
      trustedLender: args.trusted,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const listForAdmin = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      firstName: v.string(),
      lastName: v.optional(v.string()),
      email: v.string(),
      role: userRoleValidator,
      trustedLender: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    return users
      .sort((a, b) => a.firstName.localeCompare(b.firstName))
      .map((user) => ({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        trustedLender: user.trustedLender,
      }));
  },
});
