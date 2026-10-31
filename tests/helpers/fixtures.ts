import { addDaysUtc, todayUtc } from "../../convex/lib/dates";
import { makeTestConvex } from "./convex";

/**
 * A small, deterministic board:
 * - Maya owns the drill and is a trusted lender.
 * - Jonas owns the ladder.
 * - Priya owns the mixer and is a borrower in the demo flows.
 * - An admin exists to exercise moderation and RBAC.
 */
export async function setupBoard() {
  const t = makeTestConvex();
  const today = todayUtc();
  const inDays = (days: number) => addDaysUtc(today, days);

  const ids = await t.run(async (ctx) => {
    const now = Date.now();

    const maya = await ctx.db.insert("users", {
      clerkId: "clerk_maya",
      email: "maya@example.com",
      firstName: "Maya",
      lastName: "Diallo",
      role: "user",
      trustedLender: true,
      createdAt: now - 90 * 86_400_000,
      updatedAt: now,
    });
    const jonas = await ctx.db.insert("users", {
      clerkId: "clerk_jonas",
      email: "jonas@example.com",
      firstName: "Jonas",
      lastName: "Berger",
      role: "user",
      trustedLender: false,
      createdAt: now - 80 * 86_400_000,
      updatedAt: now,
    });
    const priya = await ctx.db.insert("users", {
      clerkId: "clerk_priya",
      email: "priya@example.com",
      firstName: "Priya",
      lastName: "Nair",
      role: "user",
      trustedLender: false,
      createdAt: now - 70 * 86_400_000,
      updatedAt: now,
    });
    const admin = await ctx.db.insert("users", {
      clerkId: "clerk_admin",
      email: "admin@example.com",
      firstName: "Ari",
      lastName: "Admin",
      role: "admin",
      trustedLender: false,
      createdAt: now - 100 * 86_400_000,
      updatedAt: now,
    });

    const drill = await ctx.db.insert("tools", {
      ownerId: maya,
      name: "Cordless drill",
      category: "power-tools",
      condition: "good",
      description: "18V drill with two batteries and a bit set.",
      status: "active",
      createdAt: now - 20 * 86_400_000,
      updatedAt: now - 20 * 86_400_000,
    });
    const ladder = await ctx.db.insert("tools", {
      ownerId: jonas,
      name: "Aluminium ladder",
      category: "other",
      condition: "good",
      description: "Six-foot step ladder that folds flat.",
      status: "active",
      createdAt: now - 18 * 86_400_000,
      updatedAt: now - 18 * 86_400_000,
    });
    const mixer = await ctx.db.insert("tools", {
      ownerId: priya,
      name: "Stand mixer",
      category: "kitchen",
      condition: "good",
      description: "Bowl, whisk and dough hook included.",
      status: "active",
      createdAt: now - 16 * 86_400_000,
      updatedAt: now - 16 * 86_400_000,
    });

    return { maya, jonas, priya, admin, drill, ladder, mixer };
  });

  return {
    t,
    today,
    inDays,
    ...ids,
    asMaya: t.withIdentity({
      subject: "clerk_maya",
      email: "maya@example.com",
      name: "Maya Diallo",
    }),
    asJonas: t.withIdentity({
      subject: "clerk_jonas",
      email: "jonas@example.com",
      name: "Jonas Berger",
    }),
    asPriya: t.withIdentity({
      subject: "clerk_priya",
      email: "priya@example.com",
      name: "Priya Nair",
    }),
    asAdmin: t.withIdentity({
      subject: "clerk_admin",
      email: "admin@example.com",
      name: "Ari Admin",
    }),
  };
}

export type Board = Awaited<ReturnType<typeof setupBoard>>;
