import { describe, expect, it } from "vitest";

import { api, internal } from "../convex/_generated/api";
import { expectConvexError } from "./helpers/assert";
import { setupBoard } from "./helpers/fixtures";

describe("loan requests", () => {
  it("creates a requested loan and shows it to both parties only", async () => {
    const { asJonas, asMaya, asPriya, drill, inDays } = await setupBoard();
    const loanId = await asJonas.mutation(api.loans.request, {
      toolId: drill,
      startDate: inDays(2),
      endDate: inDays(4),
      message: "Building a bookshelf.",
    });

    const incoming = await asMaya.query(api.loans.listIncoming);
    expect(incoming).toHaveLength(1);
    expect(incoming[0]).toMatchObject({
      _id: loanId,
      toolName: "Cordless drill",
      borrowerFirstName: "Jonas",
      status: "requested",
      message: "Building a bookshelf.",
    });

    const mine = await asJonas.query(api.loans.listMine);
    expect(mine[0]?._id).toBe(loanId);

    const unrelated = await asPriya.query(api.loans.listMine);
    expect(unrelated).toHaveLength(0);
  });

  it("rejects requesting your own tool", async () => {
    const { asMaya, drill, inDays } = await setupBoard();
    await expectConvexError(
      asMaya.mutation(api.loans.request, {
        toolId: drill,
        startDate: inDays(2),
        endDate: inDays(3),
      }),
      "OWN_TOOL",
    );
  });

  it("rejects past, reversed and malformed dates", async () => {
    const { asJonas, drill, inDays } = await setupBoard();
    await expectConvexError(
      asJonas.mutation(api.loans.request, {
        toolId: drill,
        startDate: inDays(-1),
        endDate: inDays(2),
      }),
      "INVALID_DATES",
    );
    await expectConvexError(
      asJonas.mutation(api.loans.request, {
        toolId: drill,
        startDate: inDays(4),
        endDate: inDays(2),
      }),
      "INVALID_DATES",
    );
    await expectConvexError(
      asJonas.mutation(api.loans.request, {
        toolId: drill,
        startDate: "not-a-date",
        endDate: inDays(2),
      }),
      "INVALID_DATES",
    );
  });

  it("rejects requests for removed tools", async () => {
    const { asJonas, t, drill, inDays } = await setupBoard();
    await t.run(async (ctx) => {
      await ctx.db.patch(drill, { status: "removed", updatedAt: Date.now() });
    });

    await expectConvexError(
      asJonas.mutation(api.loans.request, {
        toolId: drill,
        startDate: inDays(2),
        endDate: inDays(3),
      }),
      "NOT_FOUND",
    );
  });
});

describe("overlap protection", () => {
  it("does not block a second pending request for the same dates", async () => {
    const { asJonas, asPriya, drill, inDays } = await setupBoard();
    await asJonas.mutation(api.loans.request, {
      toolId: drill,
      startDate: inDays(5),
      endDate: inDays(7),
    });
    await expect(
      asPriya.mutation(api.loans.request, {
        toolId: drill,
        startDate: inDays(6),
        endDate: inDays(8),
      }),
    ).resolves.toBeDefined();
  });

  it("rejects an overlapping request once a loan is approved", async () => {
    const { asJonas, asMaya, asPriya, drill, inDays } = await setupBoard();
    const first = await asJonas.mutation(api.loans.request, {
      toolId: drill,
      startDate: inDays(5),
      endDate: inDays(7),
    });
    await asMaya.mutation(api.loans.decide, { loanId: first, decision: "approve" });

    await expectConvexError(
      asPriya.mutation(api.loans.request, {
        toolId: drill,
        startDate: inDays(7),
        endDate: inDays(9),
      }),
      "DATES_UNAVAILABLE",
    );
  });

  it("allows a request starting the day after an approved loan ends", async () => {
    const { asJonas, asMaya, asPriya, drill, inDays } = await setupBoard();
    const first = await asJonas.mutation(api.loans.request, {
      toolId: drill,
      startDate: inDays(5),
      endDate: inDays(7),
    });
    await asMaya.mutation(api.loans.decide, { loanId: first, decision: "approve" });

    await expect(
      asPriya.mutation(api.loans.request, {
        toolId: drill,
        startDate: inDays(8),
        endDate: inDays(9),
      }),
    ).resolves.toBeDefined();
  });

  it("refuses to approve a pending request that now overlaps an approval", async () => {
    const { asJonas, asMaya, asPriya, drill, inDays } = await setupBoard();
    const first = await asJonas.mutation(api.loans.request, {
      toolId: drill,
      startDate: inDays(5),
      endDate: inDays(8),
    });
    const second = await asPriya.mutation(api.loans.request, {
      toolId: drill,
      startDate: inDays(7),
      endDate: inDays(9),
    });

    await asMaya.mutation(api.loans.decide, { loanId: first, decision: "approve" });
    await expectConvexError(
      asMaya.mutation(api.loans.decide, { loanId: second, decision: "approve" }),
      "DATES_UNAVAILABLE",
    );
  });

  it("reports current availability in the signed-in catalogue", async () => {
    const { asJonas, asMaya, asPriya, drill, inDays } = await setupBoard();
    const loanId = await asJonas.mutation(api.loans.request, {
      toolId: drill,
      startDate: inDays(0),
      endDate: inDays(2),
    });
    await asMaya.mutation(api.loans.decide, { loanId, decision: "approve" });

    const tools = await asPriya.query(api.tools.list, {});
    const row = tools.find((tool) => tool._id === drill);
    expect(row?.isAvailableNow).toBe(false);
    expect(row?.currentLoanEndsOn).toBe(inDays(2));
  });
});

describe("decisions and transitions", () => {
  it("only the lender can approve or decline", async () => {
    const { asJonas, asMaya, asAdmin, drill, inDays } = await setupBoard();
    const loanId = await asJonas.mutation(api.loans.request, {
      toolId: drill,
      startDate: inDays(1),
      endDate: inDays(2),
    });

    await expectConvexError(
      asJonas.mutation(api.loans.decide, { loanId, decision: "approve" }),
      "FORBIDDEN",
    );
    await expectConvexError(
      asAdmin.mutation(api.loans.decide, { loanId, decision: "approve" }),
      "FORBIDDEN",
    );

    await expect(
      asMaya.mutation(api.loans.decide, { loanId, decision: "approve" }),
    ).resolves.toBeNull();
  });

  it("walks requested → approved → returned", async () => {
    const { asJonas, asMaya, drill, inDays } = await setupBoard();
    const loanId = await asJonas.mutation(api.loans.request, {
      toolId: drill,
      startDate: inDays(1),
      endDate: inDays(2),
    });

    await asMaya.mutation(api.loans.decide, { loanId, decision: "approve" });
    await asMaya.mutation(api.loans.markReturned, { loanId });

    const detail = await asJonas.query(api.loans.get, { loanId });
    expect(detail.status).toBe("returned");
  });

  it("rejects illegal transitions and non-lender returns", async () => {
    const { asJonas, asMaya, drill, inDays } = await setupBoard();
    const loanId = await asJonas.mutation(api.loans.request, {
      toolId: drill,
      startDate: inDays(1),
      endDate: inDays(2),
    });

    await expectConvexError(
      asMaya.mutation(api.loans.markReturned, { loanId }),
      "INVALID_TRANSITION",
    );
    await expectConvexError(
      asJonas.mutation(api.loans.markReturned, { loanId }),
      "FORBIDDEN",
    );

    await asMaya.mutation(api.loans.decide, { loanId, decision: "decline" });
    await expectConvexError(
      asMaya.mutation(api.loans.decide, { loanId, decision: "approve" }),
      "INVALID_TRANSITION",
    );
    await expectConvexError(
      asMaya.mutation(api.loans.markReturned, { loanId }),
      "INVALID_TRANSITION",
    );
  });

  it("only exposes loan detail to the two parties and admins", async () => {
    const { asJonas, asPriya, asAdmin, drill, inDays } = await setupBoard();
    const loanId = await asJonas.mutation(api.loans.request, {
      toolId: drill,
      startDate: inDays(1),
      endDate: inDays(2),
    });

    await expectConvexError(asPriya.query(api.loans.get, { loanId }), "FORBIDDEN");
    await expect(asAdmin.query(api.loans.get, { loanId })).resolves.toBeDefined();
  });
});

describe("admin visibility", () => {
  it("lists every loan for admins only", async () => {
    const { asJonas, asMaya, asAdmin, drill, inDays } = await setupBoard();
    await asJonas.mutation(api.loans.request, {
      toolId: drill,
      startDate: inDays(1),
      endDate: inDays(2),
    });

    const all = await asAdmin.query(api.loans.listAll);
    expect(all).toHaveLength(1);
    expect(all[0]?.borrowerFirstName).toBe("Jonas");

    await expectConvexError(asMaya.query(api.loans.listAll), "FORBIDDEN");
  });
});

describe("automation payloads", () => {
  it("returns only the fields a notification needs", async () => {
    const { t, asJonas, drill, inDays } = await setupBoard();
    const loanId = await asJonas.mutation(api.loans.request, {
      toolId: drill,
      startDate: inDays(2),
      endDate: inDays(4),
      message: "This note must not leak into the webhook.",
    });

    const payload = await t.query(internal.loans.notificationPayload, {
      loanId,
      event: "requested",
    });

    expect(payload).not.toBeNull();
    expect(Object.keys(payload ?? {}).sort()).toEqual([
      "counterpartyFirstName",
      "endDate",
      "event",
      "loanId",
      "recipientEmail",
      "recipientFirstName",
      "recipientUserId",
      "startDate",
      "status",
      "toolName",
    ]);
    expect(payload?.recipientEmail).toBe("maya@example.com");
    expect(payload?.counterpartyFirstName).toBe("Jonas");
    expect(JSON.stringify(payload)).not.toContain("This note must not leak");
  });

  it("addresses the borrower for status events", async () => {
    const { t, asJonas, drill, inDays } = await setupBoard();
    const loanId = await asJonas.mutation(api.loans.request, {
      toolId: drill,
      startDate: inDays(2),
      endDate: inDays(4),
    });

    const payload = await t.query(internal.loans.notificationPayload, {
      loanId,
      event: "approved",
    });

    expect(payload?.recipientEmail).toBe("jonas@example.com");
    expect(payload?.counterpartyFirstName).toBe("Maya");
  });

  it("feeds only approved loans whose end date has passed", async () => {
    const { t, maya, jonas, priya, drill, ladder, mixer, today, inDays } =
      await setupBoard();

    const inserted = await t.run(async (ctx) => {
      const now = Date.now();
      const base = {
        lenderId: maya,
        createdAt: now,
        updatedAt: now,
      } as const;

      const overdueLadder = await ctx.db.insert("loans", {
        ...base,
        toolId: ladder,
        borrowerId: priya,
        startDate: inDays(-10),
        endDate: inDays(-5),
        status: "approved",
      });
      const overdueDrill = await ctx.db.insert("loans", {
        ...base,
        toolId: drill,
        borrowerId: jonas,
        startDate: inDays(-8),
        endDate: inDays(-2),
        status: "approved",
      });
      const returned = await ctx.db.insert("loans", {
        ...base,
        toolId: mixer,
        borrowerId: jonas,
        startDate: inDays(-20),
        endDate: inDays(-15),
        status: "returned",
      });
      const dueToday = await ctx.db.insert("loans", {
        ...base,
        toolId: mixer,
        borrowerId: priya,
        startDate: inDays(-3),
        endDate: today,
        status: "approved",
      });
      const future = await ctx.db.insert("loans", {
        ...base,
        toolId: ladder,
        borrowerId: jonas,
        startDate: inDays(1),
        endDate: inDays(4),
        status: "approved",
      });
      const pending = await ctx.db.insert("loans", {
        ...base,
        toolId: drill,
        borrowerId: priya,
        startDate: inDays(-9),
        endDate: inDays(-6),
        status: "requested",
      });

      return { overdueLadder, overdueDrill, returned, dueToday, future, pending };
    });

    const feed = await t.query(internal.loans.listOverdueForAutomation, {});

    expect(feed.reminderDate).toBe(today);
    expect(feed.loans.map((loan) => loan.loanId)).toEqual([
      inserted.overdueLadder,
      inserted.overdueDrill,
    ]);

    const ladderRow = feed.loans.find((loan) => loan.loanId === inserted.overdueLadder);
    expect(ladderRow).toMatchObject({
      toolName: "Aluminium ladder",
      startDate: inDays(-10),
      endDate: inDays(-5),
      daysOverdue: 5,
      borrowerFirstName: "Priya",
      borrowerEmail: "priya@example.com",
    });
    expect(Object.keys(ladderRow ?? {}).sort()).toEqual([
      "borrowerEmail",
      "borrowerFirstName",
      "daysOverdue",
      "endDate",
      "loanId",
      "startDate",
      "toolName",
    ]);

    const ids = feed.loans.map((loan) => loan.loanId);
    expect(ids).not.toContain(inserted.returned);
    expect(ids).not.toContain(inserted.dueToday);
    expect(ids).not.toContain(inserted.future);
    expect(ids).not.toContain(inserted.pending);
  });

  it("records reminders idempotently per loan and date", async () => {
    const { t, asJonas, asMaya, drill, today, inDays } = await setupBoard();
    const loanId = await asJonas.mutation(api.loans.request, {
      toolId: drill,
      startDate: inDays(1),
      endDate: inDays(2),
    });

    const first = await t.mutation(internal.loans.recordReminder, {
      loanId,
      reminderDate: today,
      status: "sent",
      channel: "n8n-log",
      providerMessageId: "n8n-test-1",
    });
    const second = await t.mutation(internal.loans.recordReminder, {
      loanId,
      reminderDate: today,
      status: "sent",
      channel: "n8n-log",
      providerMessageId: "n8n-test-1",
    });

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.reminderId).toBe(first.reminderId);

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("reminders")
        .withIndex("by_loan_and_createdAt", (q) => q.eq("loanId", loanId))
        .collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.recipientUserId).toBe(await asJonas.query(api.users.me).then((me) => me?._id));
    expect(asMaya).toBeDefined();
  });

  it("validates reminder write-backs", async () => {
    const { t, asJonas, drill, inDays } = await setupBoard();
    const loanId = await asJonas.mutation(api.loans.request, {
      toolId: drill,
      startDate: inDays(1),
      endDate: inDays(2),
    });

    await expectConvexError(
      t.mutation(internal.loans.recordReminder, {
        loanId,
        reminderDate: "31/10/2026",
        status: "sent",
      }),
      "INVALID_ARGUMENT",
    );
  });

  it("records notification audit rows idempotently", async () => {
    const { t, asJonas, maya, drill, inDays } = await setupBoard();
    const loanId = await asJonas.mutation(api.loans.request, {
      toolId: drill,
      startDate: inDays(1),
      endDate: inDays(2),
    });

    const args = {
      loanId,
      event: "requested" as const,
      recipientUserId: maya,
      status: "sent" as const,
      attempts: 1,
    };
    const first = await t.mutation(internal.loans.recordNotification, args);
    const second = await t.mutation(internal.loans.recordNotification, args);

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("notifications")
        .withIndex("by_loan_and_createdAt", (q) => q.eq("loanId", loanId))
        .collect(),
    );
    expect(rows).toHaveLength(1);
  });
});
