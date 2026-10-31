import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { signBody } from "../convex/lib/hmac";
import { setupBoard } from "./helpers/fixtures";

const SECRET = "http_test_secret_0123456789abcdef0123456789";
const previousSecret = process.env.N8N_HMAC_SECRET;

beforeAll(() => {
  process.env.N8N_HMAC_SECRET = SECRET;
});

afterAll(() => {
  if (previousSecret === undefined) {
    delete process.env.N8N_HMAC_SECRET;
  } else {
    process.env.N8N_HMAC_SECRET = previousSecret;
  }
});

async function signedHeaders(body: string, nowSeconds?: number) {
  const { timestamp, signature } = await signBody(SECRET, body, nowSeconds);
  return {
    "x-lendloop-timestamp": timestamp,
    "x-lendloop-signature": signature,
  };
}

describe("HTTP automation endpoints", () => {
  it("serves an unauthenticated health check", async () => {
    const { t } = await setupBoard();
    const response = await t.fetch("/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, service: "lendloop" });
  });

  it("rejects unsigned and wrongly signed overdue requests with 401", async () => {
    const { t } = await setupBoard();

    const unsigned = await t.fetch("/n8n/overdue");
    expect(unsigned.status).toBe(401);
    await expect(unsigned.json()).resolves.toEqual({ error: "unauthorized" });

    const headers = await signedHeaders("");
    const tampered = await t.fetch("/n8n/overdue", {
      headers: { ...headers, "x-lendloop-signature": "0".repeat(64) },
    });
    expect(tampered.status).toBe(401);
  });

  it("rejects stale timestamps before reading data", async () => {
    const { t } = await setupBoard();
    const stale = Math.floor(Date.now() / 1000) - 3600;
    const response = await t.fetch("/n8n/overdue", {
      headers: await signedHeaders("", stale),
    });

    expect(response.status).toBe(401);
  });

  it("returns the overdue feed for a correctly signed empty-body GET", async () => {
    const { t, maya, jonas, drill, today, inDays } = await setupBoard();

    const loanId = await t.run(async (ctx) => {
      const now = Date.now();
      return ctx.db.insert("loans", {
        toolId: drill,
        lenderId: maya,
        borrowerId: jonas,
        startDate: inDays(-6),
        endDate: inDays(-3),
        status: "approved",
        createdAt: now,
        updatedAt: now,
      });
    });

    const response = await t.fetch("/n8n/overdue", {
      headers: await signedHeaders(""),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      count: number;
      reminderDate: string;
      generatedAt: string;
      loans: Array<{ loanId: string; daysOverdue: number; borrowerEmail: string }>;
    };

    expect(payload.reminderDate).toBe(today);
    expect(payload.count).toBe(1);
    expect(payload.loans[0]).toMatchObject({
      loanId,
      daysOverdue: 3,
      borrowerEmail: "jonas@example.com",
    });
    expect(Number.isNaN(Date.parse(payload.generatedAt))).toBe(false);
  });

  it("writes reminders idempotently and validates the payload", async () => {
    const { t, maya, jonas, drill, today, inDays } = await setupBoard();

    const loanId = await t.run(async (ctx) => {
      const now = Date.now();
      return ctx.db.insert("loans", {
        toolId: drill,
        lenderId: maya,
        borrowerId: jonas,
        startDate: inDays(-4),
        endDate: inDays(-1),
        status: "approved",
        createdAt: now,
        updatedAt: now,
      });
    });

    const body = JSON.stringify({
      loanId,
      reminderDate: today,
      status: "sent",
      channel: "n8n-log",
      providerMessageId: "n8n-http-test",
    });

    const first = await t.fetch("/n8n/reminders", {
      method: "POST",
      headers: {
        ...(await signedHeaders(body)),
        "content-type": "application/json",
      },
      body,
    });
    expect(first.status).toBe(200);
    const firstJson = (await first.json()) as { ok: boolean; duplicate: boolean };
    expect(firstJson).toMatchObject({ ok: true, duplicate: false });

    const second = await t.fetch("/n8n/reminders", {
      method: "POST",
      headers: {
        ...(await signedHeaders(body)),
        "content-type": "application/json",
      },
      body,
    });
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toMatchObject({ ok: true, duplicate: true });

    const invalid = JSON.stringify({ loanId, reminderDate: "31/10/2026", status: "sent" });
    const rejected = await t.fetch("/n8n/reminders", {
      method: "POST",
      headers: {
        ...(await signedHeaders(invalid)),
        "content-type": "application/json",
      },
      body: invalid,
    });
    expect(rejected.status).toBe(400);
    await expect(rejected.json()).resolves.toEqual({ error: "invalid_reminder_date" });

    const reminderRows = await t.run(async (ctx) =>
      ctx.db
        .query("reminders")
        .withIndex("by_loan_and_createdAt", (q) => q.eq("loanId", loanId))
        .collect(),
    );
    expect(reminderRows).toHaveLength(1);
    expect(reminderRows[0]?.status).toBe("sent");
  });

  it("rejects a signed body that is not JSON", async () => {
    const { t } = await setupBoard();
    const body = "<not json>";
    const response = await t.fetch("/n8n/reminders", {
      method: "POST",
      headers: await signedHeaders(body),
      body,
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_json" });
  });

  it("rejects an oversized body before verification", async () => {
    const { t } = await setupBoard();
    const body = "x".repeat(16 * 1024 + 1);
    const response = await t.fetch("/n8n/reminders", {
      method: "POST",
      headers: {
        ...(await signedHeaders(body)),
        "content-length": String(body.length),
      },
      body,
    });

    expect(response.status).toBe(413);
  });
});
