import { describe, expect, it } from "vitest";

import { api } from "../convex/_generated/api";
import { expectConvexError } from "./helpers/assert";
import { setupBoard } from "./helpers/fixtures";

describe("public catalogue", () => {
  it("exposes exactly name and category for signed-out visitors", async () => {
    const { t } = await setupBoard();
    const tools = await t.query(api.tools.listPublic);

    expect(tools).toHaveLength(3);
    for (const tool of tools) {
      expect(Object.keys(tool).sort()).toEqual(["category", "name"]);
    }

    const serialized = JSON.stringify(tools);
    expect(serialized).not.toContain("Maya");
    expect(serialized).not.toContain("maya@example.com");
    expect(serialized).not.toContain("ownerId");
    expect(serialized).not.toContain("description");
  });

  it("omits removed listings", async () => {
    const { t, drill } = await setupBoard();
    await t.run(async (ctx) => {
      await ctx.db.patch(drill, { status: "removed", updatedAt: Date.now() });
    });

    const tools = await t.query(api.tools.listPublic);
    expect(tools.map((tool) => tool.name)).not.toContain("Cordless drill");
  });
});

describe("signed-in catalogue", () => {
  it("requires authentication", async () => {
    const { t } = await setupBoard();
    await expectConvexError(t.query(api.tools.list, {}), "UNAUTHENTICATED");
  });

  it("requires the user record to be synced before a query runs", async () => {
    const { t } = await setupBoard();
    const unsynced = t.withIdentity({
      subject: "clerk_new",
      email: "new@example.com",
      name: "New Neighbor",
    });
    await expectConvexError(unsynced.query(api.tools.list, {}), "ACCOUNT_NOT_READY");
  });

  it("includes availability, owner first name and the trusted badge", async () => {
    const { asJonas, drill } = await setupBoard();
    const tools = await asJonas.query(api.tools.list, {});
    const drillRow = tools.find((tool) => tool._id === drill);

    expect(drillRow).toBeDefined();
    expect(drillRow?.ownerFirstName).toBe("Maya");
    expect(drillRow?.ownerTrustedLender).toBe(true);
    expect(drillRow?.isOwner).toBe(false);
    expect(drillRow?.isAvailableNow).toBe(true);
  });

  it("filters by category", async () => {
    const { asJonas } = await setupBoard();
    const tools = await asJonas.query(api.tools.list, { category: "kitchen" });
    expect(tools.map((tool) => tool.name)).toEqual(["Stand mixer"]);
  });
});

describe("listing ownership and moderation", () => {
  it("creates a listing for the signed-in user", async () => {
    const { asMaya } = await setupBoard();
    const toolId = await asMaya.mutation(api.tools.create, {
      name: "Random orbital sander",
      category: "power-tools",
      condition: "good",
      description: "Two sanding pads included. Dust bag attached.",
    });

    const listings = await asMaya.query(api.tools.myListings);
    expect(listings.map((listing) => listing._id)).toContain(toolId);
  });

  it("rejects blank names and short descriptions", async () => {
    const { asMaya } = await setupBoard();
    await expectConvexError(
      asMaya.mutation(api.tools.create, {
        name: "A",
        category: "other",
        condition: "good",
        description: "This description is long enough.",
      }),
      "INVALID_ARGUMENT",
    );
    await expectConvexError(
      asMaya.mutation(api.tools.create, {
        name: "Sander",
        category: "other",
        condition: "good",
        description: "Short",
      }),
      "INVALID_ARGUMENT",
    );
  });

  it("does not let an owner delete someone else's listing", async () => {
    const { asMaya, ladder } = await setupBoard();
    await expectConvexError(
      asMaya.mutation(api.tools.remove, { toolId: ladder }),
      "FORBIDDEN",
    );
  });

  it("declines pending requests when the owner removes a listing", async () => {
    const { asMaya, asJonas, drill, inDays } = await setupBoard();
    await asJonas.mutation(api.loans.request, {
      toolId: drill,
      startDate: inDays(2),
      endDate: inDays(4),
    });

    await asMaya.mutation(api.tools.remove, { toolId: drill });

    const listed = await asMaya.query(api.tools.myListings);
    expect(listed.map((listing) => listing._id)).not.toContain(drill);

    const incoming = await asMaya.query(api.loans.listIncoming);
    expect(incoming[0]?.status).toBe("declined");
  });

  it("lets admins list and remove any listing", async () => {
    const { asAdmin, asMaya, asJonas, drill, inDays } = await setupBoard();
    await asJonas.mutation(api.loans.request, {
      toolId: drill,
      startDate: inDays(2),
      endDate: inDays(3),
    });

    const all = await asAdmin.query(api.tools.listForAdmin);
    expect(all).toHaveLength(3);

    await asAdmin.mutation(api.tools.adminRemove, { toolId: drill });

    const publicTools = await asMaya.query(api.tools.listPublic);
    expect(publicTools.map((tool) => tool.name)).not.toContain("Cordless drill");

    const incoming = await asMaya.query(api.loans.listIncoming);
    expect(incoming[0]?.status).toBe("declined");
  });

  it("rejects moderation from a normal user", async () => {
    const { asMaya, ladder } = await setupBoard();
    await expectConvexError(
      asMaya.mutation(api.tools.adminRemove, { toolId: ladder }),
      "FORBIDDEN",
    );
    await expectConvexError(asMaya.query(api.tools.listForAdmin), "FORBIDDEN");
  });
});

describe("trusted lender badge", () => {
  it("is admin-controlled", async () => {
    const { asMaya, asJonas, asAdmin, jonas } = await setupBoard();
    await expectConvexError(
      asMaya.mutation(api.users.setTrustedLender, { userId: jonas, trusted: true }),
      "FORBIDDEN",
    );

    await asAdmin.mutation(api.users.setTrustedLender, { userId: jonas, trusted: true });
    const me = await asJonas.query(api.users.me);
    expect(me?.trustedLender).toBe(true);
  });

  it("rejects unknown users", async () => {
    const { asAdmin, t } = await setupBoard();
    const ghostId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("users", {
        clerkId: "clerk_ghost",
        email: "ghost@example.com",
        firstName: "Ghost",
        role: "user" as const,
        trustedLender: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.delete(id);
      return id;
    });

    await expectConvexError(
      asAdmin.mutation(api.users.setTrustedLender, { userId: ghostId, trusted: true }),
      "NOT_FOUND",
    );
  });
});
