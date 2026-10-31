import { describe, expect, it } from "vitest";

import {
  canonicalMessage,
  DEFAULT_TOLERANCE_SECONDS,
  signBody,
  timingSafeEqualHex,
  verifyBody,
} from "../convex/lib/hmac";

const SECRET = "test_secret_0123456789abcdef0123456789abcdef";
const NOW = 1_800_000_000;

describe("canonicalMessage", () => {
  it("joins the timestamp and raw body with a dot", () => {
    expect(canonicalMessage("1700000000", '{"a":1}')).toBe('1700000000.{"a":1}');
  });

  it("keeps an empty body representable for GET requests", () => {
    expect(canonicalMessage("1700000000", "")).toBe("1700000000.");
  });
});

describe("signBody / verifyBody", () => {
  it("round-trips a signature", async () => {
    const body = JSON.stringify({ loanId: "loan_1", event: "requested" });
    const { timestamp, signature } = await signBody(SECRET, body, NOW);

    await expect(
      verifyBody({ secret: SECRET, timestamp, body, signature, nowSeconds: NOW }),
    ).resolves.toBe(true);
  });

  it("accepts a sha256= prefix and uppercase hex", async () => {
    const body = '{"hello":"world"}';
    const { timestamp, signature } = await signBody(SECRET, body, NOW);

    await expect(
      verifyBody({
        secret: SECRET,
        timestamp,
        body,
        signature: `sha256=${signature.toUpperCase()}`,
        nowSeconds: NOW,
      }),
    ).resolves.toBe(true);
  });

  it("rejects a tampered body", async () => {
    const { timestamp, signature } = await signBody(SECRET, '{"amount":1}', NOW);

    await expect(
      verifyBody({
        secret: SECRET,
        timestamp,
        body: '{"amount":2}',
        signature,
        nowSeconds: NOW,
      }),
    ).resolves.toBe(false);
  });

  it("rejects the wrong secret", async () => {
    const body = "payload";
    const { timestamp, signature } = await signBody(SECRET, body, NOW);

    await expect(
      verifyBody({
        secret: "another_secret_that_is_long_enough",
        timestamp,
        body,
        signature,
        nowSeconds: NOW,
      }),
    ).resolves.toBe(false);
  });

  it("rejects stale and future timestamps outside the tolerance", async () => {
    const body = "payload";
    const { timestamp, signature } = await signBody(SECRET, body, NOW);

    await expect(
      verifyBody({
        secret: SECRET,
        timestamp,
        body,
        signature,
        nowSeconds: NOW + DEFAULT_TOLERANCE_SECONDS + 1,
      }),
    ).resolves.toBe(false);

    await expect(
      verifyBody({
        secret: SECRET,
        timestamp,
        body,
        signature,
        nowSeconds: NOW - DEFAULT_TOLERANCE_SECONDS - 1,
      }),
    ).resolves.toBe(false);
  });

  it("accepts a timestamp exactly at the tolerance boundary", async () => {
    const body = "payload";
    const { timestamp, signature } = await signBody(SECRET, body, NOW);

    await expect(
      verifyBody({
        secret: SECRET,
        timestamp,
        body,
        signature,
        nowSeconds: NOW + DEFAULT_TOLERANCE_SECONDS,
      }),
    ).resolves.toBe(true);
  });

  it("rejects malformed timestamps and signatures", async () => {
    const body = "payload";
    const { timestamp, signature } = await signBody(SECRET, body, NOW);

    for (const badTimestamp of ["", "abc", "1.5", "-1", "999999999999999999999"]) {
      await expect(
        verifyBody({
          secret: SECRET,
          timestamp: badTimestamp,
          body,
          signature,
          nowSeconds: NOW,
        }),
      ).resolves.toBe(false);
    }

    for (const badSignature of ["", "deadbeef", signature.slice(0, -1), `${signature}00`]) {
      await expect(
        verifyBody({
          secret: SECRET,
          timestamp,
          body,
          signature: badSignature,
          nowSeconds: NOW,
        }),
      ).resolves.toBe(false);
    }
  });

  it("rejects an empty secret", async () => {
    const body = "payload";
    const { timestamp, signature } = await signBody(SECRET, body, NOW);

    await expect(
      verifyBody({ secret: "", timestamp, body, signature, nowSeconds: NOW }),
    ).resolves.toBe(false);
  });

  it("signs an empty GET body with HMAC(`${timestamp}.`)", async () => {
    const { timestamp, signature } = await signBody(SECRET, "", NOW);

    await expect(
      verifyBody({ secret: SECRET, timestamp, body: "", signature, nowSeconds: NOW }),
    ).resolves.toBe(true);
  });
});

describe("timingSafeEqualHex", () => {
  it("returns true for identical digests", () => {
    expect(timingSafeEqualHex("abcd", "abcd")).toBe(true);
  });

  it("returns false for different digests and lengths", () => {
    expect(timingSafeEqualHex("abcd", "abce")).toBe(false);
    expect(timingSafeEqualHex("abcd", "abcde")).toBe(false);
  });
});
