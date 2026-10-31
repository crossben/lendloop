import { httpRouter } from "convex/server";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";
import { isValidDateString } from "./lib/dates";
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifyBody,
} from "./lib/hmac";

const MAX_BODY_CHARS = 16 * 1024;
const http = httpRouter();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

type VerifiedBody =
  | { ok: true; body: string }
  | { ok: false; response: Response };

/**
 * Verify HMAC and timestamp BEFORE parsing the payload or touching the
 * database. A request without a valid signature gets a 401 and no data.
 */
async function readVerifiedBody(request: Request): Promise<VerifiedBody> {
  const secret = process.env.N8N_HMAC_SECRET;
  if (!secret) {
    console.error("[lendloop] N8N_HMAC_SECRET is not configured");
    return { ok: false, response: json({ error: "server_misconfigured" }, 500) };
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_CHARS) {
    return { ok: false, response: json({ error: "payload_too_large" }, 413) };
  }

  const body = await request.text();
  if (body.length > MAX_BODY_CHARS) {
    return { ok: false, response: json({ error: "payload_too_large" }, 413) };
  }

  const timestamp = request.headers.get(TIMESTAMP_HEADER) ?? "";
  const signature = request.headers.get(SIGNATURE_HEADER) ?? "";

  const valid = await verifyBody({ secret, timestamp, body, signature });
  if (!valid) {
    console.warn("[lendloop] rejected n8n request with invalid or stale signature", {
      path: new URL(request.url).pathname,
    });
    return { ok: false, response: json({ error: "unauthorized" }, 401) };
  }

  return { ok: true, body };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(
  value: unknown,
  maxLength: number,
): value is string | undefined {
  return value === undefined || (typeof value === "string" && value.length <= maxLength);
}

http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => json({ ok: true, service: "lendloop" })),
});

/**
 * Daily overdue feed for n8n. The GET has an empty canonical body, so the
 * signature is HMAC(`${timestamp}.`).
 */
http.route({
  path: "/n8n/overdue",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const verified = await readVerifiedBody(request);
    if (!verified.ok) return verified.response;

    if (verified.body.length > 0) {
      return json({ error: "unexpected_body" }, 400);
    }

    const result = await ctx.runQuery(internal.loans.listOverdueForAutomation, {});
    return json({
      generatedAt: new Date().toISOString(),
      reminderDate: result.reminderDate,
      count: result.loans.length,
      loans: result.loans,
    });
  }),
});

/**
 * Idempotent reminder write-back from n8n. Repeated calls for the same
 * loan + reminderDate return the existing record.
 */
http.route({
  path: "/n8n/reminders",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const verified = await readVerifiedBody(request);
    if (!verified.ok) return verified.response;

    let payload: unknown;
    try {
      payload = JSON.parse(verified.body);
    } catch {
      return json({ error: "invalid_json" }, 400);
    }
    if (!isRecord(payload)) {
      return json({ error: "invalid_payload" }, 400);
    }

    const { loanId, reminderDate, status, channel, providerMessageId, error } = payload;

    if (typeof loanId !== "string" || loanId.length === 0 || loanId.length > 64) {
      return json({ error: "invalid_loan_id" }, 400);
    }
    if (typeof reminderDate !== "string" || !isValidDateString(reminderDate)) {
      return json({ error: "invalid_reminder_date" }, 400);
    }
    if (status !== "sent" && status !== "failed") {
      return json({ error: "invalid_status" }, 400);
    }
    if (!optionalString(channel, 40)) {
      return json({ error: "invalid_channel" }, 400);
    }
    if (!optionalString(providerMessageId, 100)) {
      return json({ error: "invalid_provider_message_id" }, 400);
    }
    if (!optionalString(error, 300)) {
      return json({ error: "invalid_error" }, 400);
    }

    try {
      const result = await ctx.runMutation(internal.loans.recordReminder, {
        loanId: loanId as Id<"loans">,
        reminderDate,
        status,
        channel,
        providerMessageId,
        error,
      });
      return json({
        ok: true,
        reminderId: result.reminderId,
        duplicate: result.duplicate,
      });
    } catch (cause) {
      // Never echo database errors to the caller; log for operators.
      console.error("[lendloop] reminder write-back failed", {
        loanId,
        reminderDate,
        cause: cause instanceof Error ? cause.message : "unknown",
      });
      return json({ error: "write_failed" }, 400);
    }
  }),
});

export default http;
