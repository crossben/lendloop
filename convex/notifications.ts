"use node";

import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { notificationEventValidator } from "./lib/constants";
import { signBody, SIGNATURE_HEADER, TIMESTAMP_HEADER } from "./lib/hmac";

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [300, 1_200];
const REQUEST_TIMEOUT_MS = 8_000;
const MIN_SECRET_LENGTH = 16;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Outbound n8n webhook, scheduled by loan mutations with
 * `ctx.scheduler.runAfter(0, ...)` so the user's write never waits on n8n.
 *
 * The payload is minimal by design. The request is signed with HMAC-SHA256 over
 * `${timestamp}.${body}`. Retries are bounded (3 attempts with backoff); every
 * success/failure is persisted so it is visible in the UI and logs.
 */
export const notifyLoanEvent = internalAction({
  args: {
    loanId: v.id("loans"),
    event: notificationEventValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payload = await ctx.runQuery(internal.loans.notificationPayload, args);
    if (!payload) {
      console.warn("[lendloop] notification skipped: loan payload not found", {
        loanId: args.loanId,
        event: args.event,
      });
      return null;
    }

    const webhookUrl = process.env.N8N_REQUEST_WEBHOOK_URL;
    const secret = process.env.N8N_HMAC_SECRET;
    const configurationError = !webhookUrl
      ? "N8N_REQUEST_WEBHOOK_URL is not configured"
      : !secret
        ? "N8N_HMAC_SECRET is not configured"
        : secret.length < MIN_SECRET_LENGTH
          ? "N8N_HMAC_SECRET is too short"
          : null;

    if (configurationError || !webhookUrl || !secret) {
      console.error("[lendloop] n8n notification not sent", {
        loanId: args.loanId,
        event: args.event,
        error: configurationError,
      });
      await ctx.runMutation(internal.loans.recordNotification, {
        loanId: args.loanId,
        event: args.event,
        recipientUserId: payload.recipientUserId,
        status: "failed",
        attempts: 1,
        error: configurationError ?? "n8n is not configured",
      });
      return null;
    }

    const body = JSON.stringify({
      event: payload.event,
      loanId: payload.loanId,
      toolName: payload.toolName,
      status: payload.status,
      startDate: payload.startDate,
      endDate: payload.endDate,
      recipient: {
        firstName: payload.recipientFirstName,
        email: payload.recipientEmail,
      },
      counterpartyFirstName: payload.counterpartyFirstName,
      occurredAt: new Date().toISOString(),
    });

    let lastError = "Unknown error";
    let attempts = 0;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      attempts = attempt;
      try {
        const { timestamp, signature } = await signBody(secret, body);
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "user-agent": "LendLoop-Convex/1.0",
            [TIMESTAMP_HEADER]: timestamp,
            [SIGNATURE_HEADER]: signature,
            "x-lendloop-idempotency-key": `${args.loanId}:${args.event}`,
          },
          body,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        if (response.ok) {
          await ctx.runMutation(internal.loans.recordNotification, {
            loanId: args.loanId,
            event: args.event,
            recipientUserId: payload.recipientUserId,
            status: "sent",
            attempts,
          });
          return null;
        }

        lastError = `n8n responded with HTTP ${response.status}`;
        // Retrying auth/validation failures cannot succeed; retry 429 and 5xx.
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          break;
        }
      } catch (error) {
        lastError =
          error instanceof Error ? `${error.name}: ${error.message}` : "Network error";
      }

      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAYS_MS[attempt - 1] ?? 1_200);
      }
    }

    console.error("[lendloop] n8n notification failed", {
      loanId: args.loanId,
      event: args.event,
      attempts,
      error: lastError,
    });

    await ctx.runMutation(internal.loans.recordNotification, {
      loanId: args.loanId,
      event: args.event,
      recipientUserId: payload.recipientUserId,
      status: "failed",
      attempts,
      error: lastError,
    });

    return null;
  },
});
