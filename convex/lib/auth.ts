import type { UserIdentity } from "convex/server";

import type { Id } from "../_generated/dataModel";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { appError } from "./errors";

function normalizeEmail(email: string | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/** Comma-separated list of emails allowed to bootstrap an admin account. */
export function parseAdminEmails(raw: string | undefined = process.env.ADMIN_EMAILS): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((email) => normalizeEmail(email))
      .filter(Boolean),
  );
}

export function isBootstrapAdmin(email: string): boolean {
  const normalized = normalizeEmail(email);
  return normalized.length > 0 && parseAdminEmails().has(normalized);
}

function deriveName(identity: UserIdentity): { firstName: string; lastName?: string } {
  const fullName = identity.name?.trim() ?? "";
  const parts = fullName.split(/\s+/).filter(Boolean);
  const emailLocalPart = normalizeEmail(identity.email).split("@")[0] ?? "neighbor";

  const firstName = identity.givenName?.trim() || parts[0] || emailLocalPart || "Neighbor";
  const lastName = identity.familyName?.trim() || (parts.length > 1 ? parts.slice(1).join(" ") : undefined);

  return { firstName, lastName: lastName || undefined };
}

/**
 * Read-only viewer lookup. Queries use this so they never mutate during a
 * render; account creation happens in `users.sync` / mutations.
 */
export async function getViewer(ctx: QueryCtx | MutationCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

export async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const user = await getViewer(ctx);
  if (user) return user;

  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw appError("UNAUTHENTICATED", "Sign in to continue.");
  }
  throw appError(
    "ACCOUNT_NOT_READY",
    "Your account is still being set up. Refresh the page in a moment.",
  );
}

async function upsertUser(ctx: MutationCtx, identity: UserIdentity): Promise<Doc<"users">> {
  const now = Date.now();
  const email = normalizeEmail(identity.email);
  const { firstName, lastName } = deriveName(identity);
  const imageUrl = identity.pictureUrl;
  const shouldBeAdmin = isBootstrapAdmin(email);

  const existing = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  if (existing) {
    // Promote from the server-side allow-list, but never auto-demote. Demoting
    // requires an explicit admin mutation and is intentionally auditable.
    const role = existing.role === "admin" || shouldBeAdmin ? "admin" : "user";
    const patch: Partial<Doc<"users">> = {
      email: email || existing.email,
      firstName,
      lastName,
      imageUrl,
      role,
      updatedAt: now,
    };

    const changed =
      patch.email !== existing.email ||
      patch.firstName !== existing.firstName ||
      patch.lastName !== existing.lastName ||
      patch.imageUrl !== existing.imageUrl ||
      patch.role !== existing.role;

    if (changed) {
      await ctx.db.patch(existing._id, patch);
      return { ...existing, ...patch };
    }
    return existing;
  }

  // Demo users are seeded with `seed_...` Clerk ids. A real Clerk account that
  // signs in with the same verified email adopts the profile so reviewers can
  // try the seeded flows. This branch is harmless when no seed data exists.
  if (email) {
    const seeded = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (seeded && seeded.clerkId.startsWith("seed_")) {
      const role = seeded.role === "admin" || shouldBeAdmin ? "admin" : "user";
      await ctx.db.patch(seeded._id, {
        clerkId: identity.subject,
        firstName,
        lastName,
        imageUrl,
        role,
        updatedAt: now,
      });
      return { ...seeded, clerkId: identity.subject, firstName, lastName, imageUrl, role, updatedAt: now };
    }
  }

  const userId = await ctx.db.insert("users", {
    clerkId: identity.subject,
    email,
    firstName,
    lastName,
    imageUrl,
    role: shouldBeAdmin ? "admin" : "user",
    trustedLender: false,
    createdAt: now,
    updatedAt: now,
  });

  const created = await ctx.db.get(userId);
  if (!created) {
    throw appError("NOT_FOUND", "Could not create your account. Please try again.");
  }
  return created;
}

/**
 * Mutations use this variant so the first authenticated write always works,
 * even if the client's `users.sync` call has not landed yet.
 */
export async function requireUserForMutation(ctx: MutationCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw appError("UNAUTHENTICATED", "Sign in to continue.");
  }
  return await upsertUser(ctx, identity);
}

export async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role !== "admin") {
    throw appError("FORBIDDEN", "This area is limited to administrators.");
  }
  return user;
}

export async function requireAdminForMutation(ctx: MutationCtx): Promise<Doc<"users">> {
  const user = await requireUserForMutation(ctx);
  if (user.role !== "admin") {
    throw appError("FORBIDDEN", "This action is limited to administrators.");
  }
  return user;
}

export async function requireToolOwner(
  ctx: MutationCtx,
  toolId: Id<"tools">,
): Promise<{ user: Doc<"users">; tool: Doc<"tools"> }> {
  const user = await requireUserForMutation(ctx);
  const tool = await ctx.db.get(toolId);
  if (!tool || tool.status === "removed") {
    throw appError("NOT_FOUND", "That listing no longer exists.");
  }
  if (tool.ownerId !== user._id) {
    throw appError("FORBIDDEN", "You can only manage your own listings.");
  }
  return { user, tool };
}

export type LoanParty = {
  user: Doc<"users">;
  loan: Doc<"loans">;
  isLender: boolean;
  isBorrower: boolean;
  isAdmin: boolean;
};

function assertLoanParty(
  user: Doc<"users">,
  loan: Doc<"loans">,
): LoanParty {
  const isLender = loan.lenderId === user._id;
  const isBorrower = loan.borrowerId === user._id;
  const isAdmin = user.role === "admin";

  if (!isLender && !isBorrower && !isAdmin) {
    throw appError("FORBIDDEN", "You are not part of this loan.");
  }

  return { user, loan, isLender, isBorrower, isAdmin };
}

export async function requireLoanParty(
  ctx: MutationCtx,
  loanId: Id<"loans">,
): Promise<LoanParty> {
  const user = await requireUserForMutation(ctx);
  const loan = await ctx.db.get(loanId);
  if (!loan) {
    throw appError("NOT_FOUND", "That request no longer exists.");
  }
  return assertLoanParty(user, loan);
}

/** Read-only variant used by loan queries; never mutates the users table. */
export async function requireLoanPartyRead(
  ctx: QueryCtx,
  loanId: Id<"loans">,
): Promise<LoanParty> {
  const user = await requireUser(ctx);
  const loan = await ctx.db.get(loanId);
  if (!loan) {
    throw appError("NOT_FOUND", "That request no longer exists.");
  }
  return assertLoanParty(user, loan);
}
