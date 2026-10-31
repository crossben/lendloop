import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import type { ToolCategory, ToolCondition } from "./lib/constants";
import { addDaysUtc, todayUtc } from "./lib/dates";

const DAY = 86_400_000;

type SeedUser = {
  email: string;
  firstName: string;
  lastName: string;
  trustedLender: boolean;
};

async function ensureUser(ctx: MutationCtx, seed: SeedUser): Promise<Doc<"users">> {
  const email = seed.email.toLowerCase();
  const existing = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
  if (existing) return existing;

  const now = Date.now();
  const userId = await ctx.db.insert("users", {
    clerkId: `seed_${seed.firstName.toLowerCase()}`,
    email,
    firstName: seed.firstName,
    lastName: seed.lastName,
    role: "user",
    trustedLender: seed.trustedLender,
    createdAt: now - 90 * DAY,
    updatedAt: now,
  });
  const created = await ctx.db.get(userId);
  if (!created) throw new Error("Seed user could not be created");
  return created;
}

type SeedTool = {
  name: string;
  category: ToolCategory;
  condition: ToolCondition;
  description: string;
};

async function ensureTool(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  seed: SeedTool,
): Promise<Doc<"tools">> {
  const owned = await ctx.db
    .query("tools")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();
  const existing = owned.find((tool) => tool.name === seed.name);
  if (existing) return existing;

  const now = Date.now();
  const toolId = await ctx.db.insert("tools", {
    ownerId,
    name: seed.name,
    category: seed.category,
    condition: seed.condition,
    description: seed.description,
    status: "active",
    createdAt: now - 20 * DAY,
    updatedAt: now - 20 * DAY,
  });
  const created = await ctx.db.get(toolId);
  if (!created) throw new Error("Seed tool could not be created");
  return created;
}

type SeedLoan = {
  tool: Doc<"tools">;
  borrowerId: Id<"users">;
  startDate: string;
  endDate: string;
  status: "requested" | "approved" | "declined" | "returned";
  message?: string;
};

async function ensureLoan(
  ctx: MutationCtx,
  seed: SeedLoan,
): Promise<{ loan: Doc<"loans">; created: boolean }> {
  const existing = (
    await ctx.db
      .query("loans")
      .withIndex("by_tool", (q) => q.eq("toolId", seed.tool._id))
      .collect()
  ).find(
    (loan) =>
      loan.borrowerId === seed.borrowerId &&
      loan.startDate === seed.startDate &&
      loan.endDate === seed.endDate,
  );
  if (existing) return { loan: existing, created: false };

  const now = Date.now();
  const createdAt = now - 14 * DAY;
  const loanId = await ctx.db.insert("loans", {
    toolId: seed.tool._id,
    lenderId: seed.tool.ownerId,
    borrowerId: seed.borrowerId,
    startDate: seed.startDate,
    endDate: seed.endDate,
    message: seed.message,
    status: seed.status,
    decidedAt:
      seed.status === "requested" ? undefined : createdAt + 2 * 3_600_000,
    returnedAt: seed.status === "returned" ? createdAt + 5 * DAY : undefined,
    createdAt,
    updatedAt: now,
  });
  const created = await ctx.db.get(loanId);
  if (!created) throw new Error("Seed loan could not be created");
  return { loan: created, created: true };
}

async function ensureNotification(
  ctx: MutationCtx,
  loan: Doc<"loans">,
  event: "requested" | "approved" | "declined" | "returned",
  recipientUserId: Id<"users">,
  daysAgo: number,
): Promise<void> {
  const key = `${loan._id}:${event}`;
  const existing = await ctx.db
    .query("notifications")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (existing) return;

  await ctx.db.insert("notifications", {
    key,
    loanId: loan._id,
    event,
    recipientUserId,
    status: "sent",
    attempts: 1,
    createdAt: Date.now() - daysAgo * DAY,
  });
}

/**
 * Demo data for reviewers.
 *
 * Usage:
 *   npx convex run seed:run
 *   npx convex run seed:run '{"ownerEmail":"you@example.com"}'
 *
 * Pass ownerEmail AFTER signing in once so the demo tools, pending incoming
 * requests and the overdue loan belong to your own account.
 */
export const run = internalMutation({
  args: {
    ownerEmail: v.optional(v.string()),
  },
  returns: v.object({
    ownerEmail: v.string(),
    tools: v.number(),
    loans: v.number(),
    reminders: v.number(),
  }),
  handler: async (ctx, args) => {
    const today = todayUtc();
    const requestedOwnerEmail = args.ownerEmail?.trim().toLowerCase();

    let owner: Doc<"users">;
    if (requestedOwnerEmail) {
      const found = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", requestedOwnerEmail))
        .unique();
      if (!found) {
        throw new Error(
          `No user with email ${requestedOwnerEmail}. Sign in once, run users.sync, then retry.`,
        );
      }
      owner = found;
    } else {
      owner = await ensureUser(ctx, {
        email: "maya@demo.lendloop",
        firstName: "Maya",
        lastName: "Diallo",
        trustedLender: true,
      });
    }

    const jonas = await ensureUser(ctx, {
      email: "jonas@demo.lendloop",
      firstName: "Jonas",
      lastName: "Berger",
      trustedLender: true,
    });
    const priya = await ensureUser(ctx, {
      email: "priya@demo.lendloop",
      firstName: "Priya",
      lastName: "Nair",
      trustedLender: false,
    });

    if (!owner.trustedLender) {
      await ctx.db.patch(owner._id, { trustedLender: true, updatedAt: Date.now() });
    }
    if (!jonas.trustedLender) {
      await ctx.db.patch(jonas._id, { trustedLender: true, updatedAt: Date.now() });
    }

    const drill = await ensureTool(ctx, owner._id, {
      name: "Cordless drill",
      category: "power-tools",
      condition: "good",
      description: "18V cordless drill with two batteries and a bit set. Great for shelves and flat-pack furniture.",
    });
    const mixer = await ensureTool(ctx, owner._id, {
      name: "Stand mixer",
      category: "kitchen",
      condition: "good",
      description: "Bowl, whisk and dough hook included. Please return it clean.",
    });
    const washer = await ensureTool(ctx, owner._id, {
      name: "Pressure washer",
      category: "cleaning",
      condition: "fair",
      description: "Compact electric washer for patios and bikes. Works well, a little loud.",
    });
    const ladder = await ensureTool(ctx, jonas._id, {
      name: "Aluminium ladder",
      category: "other",
      condition: "good",
      description: "Six-foot step ladder, folds flat. Indoor use only, please.",
    });
    const stove = await ensureTool(ctx, priya._id, {
      name: "Camping stove",
      category: "camping",
      condition: "new",
      description: "Two-burner gas stove with a carrying case. Gas canisters not included.",
    });

    const overdue = await ensureLoan(ctx, {
      tool: drill,
      borrowerId: jonas._id,
      startDate: addDaysUtc(today, -12),
      endDate: addDaysUtc(today, -5),
      status: "approved",
      message: "Building a bookshelf this weekend.",
    });
    await ensureLoan(ctx, {
      tool: washer,
      borrowerId: priya._id,
      startDate: addDaysUtc(today, 3),
      endDate: addDaysUtc(today, 5),
      status: "requested",
      message: "Could I borrow this for the balcony?",
    });
    await ensureLoan(ctx, {
      tool: ladder,
      borrowerId: owner._id,
      startDate: addDaysUtc(today, 2),
      endDate: addDaysUtc(today, 4),
      status: "approved",
      message: "Hanging a curtain rail.",
    });
    const returned = await ensureLoan(ctx, {
      tool: mixer,
      borrowerId: priya._id,
      startDate: addDaysUtc(today, -30),
      endDate: addDaysUtc(today, -25),
      status: "returned",
      message: "Birthday cake mission.",
    });

    await ensureNotification(
      ctx,
      overdue.loan,
      "requested",
      owner._id,
      13,
    );
    await ensureNotification(
      ctx,
      overdue.loan,
      "approved",
      jonas._id,
      12,
    );
    await ensureNotification(
      ctx,
      returned.loan,
      "returned",
      priya._id,
      25,
    );

    const reminderKey = `${overdue.loan._id}:${addDaysUtc(today, -1)}`;
    const existingReminder = await ctx.db
      .query("reminders")
      .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", reminderKey))
      .unique();

    let reminders = 0;
    if (!existingReminder) {
      await ctx.db.insert("reminders", {
        idempotencyKey: reminderKey,
        loanId: overdue.loan._id,
        reminderDate: addDaysUtc(today, -1),
        status: "sent",
        channel: "seed",
        recipientUserId: jonas._id,
        providerMessageId: `seed-${overdue.loan._id}`,
        createdAt: Date.now() - DAY,
      });
      reminders = 1;
    }

    const allTools = [drill, mixer, washer, ladder, stove];
    return {
      ownerEmail: owner.email,
      tools: allTools.length,
      loans: 4,
      reminders,
    };
  },
});
