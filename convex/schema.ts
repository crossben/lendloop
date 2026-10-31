import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import {
  loanStatusValidator,
  notificationEventValidator,
  toolCategoryValidator,
  toolConditionValidator,
  toolStatusValidator,
  userRoleValidator,
} from "./lib/constants";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    firstName: v.string(),
    lastName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    role: userRoleValidator,
    trustedLender: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),

  tools: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    category: toolCategoryValidator,
    condition: toolConditionValidator,
    description: v.string(),
    status: toolStatusValidator,
    removedAt: v.optional(v.number()),
    removedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_status_and_category", ["status", "category"])
    .index("by_owner", ["ownerId"]),

  loans: defineTable({
    toolId: v.id("tools"),
    lenderId: v.id("users"),
    borrowerId: v.id("users"),
    startDate: v.string(),
    endDate: v.string(),
    message: v.optional(v.string()),
    status: loanStatusValidator,
    decidedAt: v.optional(v.number()),
    returnedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tool", ["toolId"])
    .index("by_tool_and_status", ["toolId", "status"])
    .index("by_lender_and_createdAt", ["lenderId", "createdAt"])
    .index("by_borrower_and_createdAt", ["borrowerId", "createdAt"])
    .index("by_status_and_endDate", ["status", "endDate"])
    .index("by_createdAt", ["createdAt"]),

  notifications: defineTable({
    key: v.string(),
    loanId: v.id("loans"),
    event: notificationEventValidator,
    recipientUserId: v.id("users"),
    status: v.union(v.literal("sent"), v.literal("failed")),
    attempts: v.number(),
    error: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_loan_and_createdAt", ["loanId", "createdAt"]),

  reminders: defineTable({
    idempotencyKey: v.string(),
    loanId: v.id("loans"),
    reminderDate: v.string(),
    status: v.union(v.literal("sent"), v.literal("failed")),
    channel: v.string(),
    recipientUserId: v.id("users"),
    providerMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_loan_and_createdAt", ["loanId", "createdAt"]),
});
