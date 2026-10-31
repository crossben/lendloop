export const SIGNATURE_HEADER = "x-lendloop-signature";
export const TIMESTAMP_HEADER = "x-lendloop-timestamp";
export const DEFAULT_TOLERANCE_SECONDS = 300;

const encoder = new TextEncoder();
const HEX_SIGNATURE = /^[0-9a-f]{64}$/;

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

/** Canonical message is `${unixSeconds}.${rawBody}`. */
export function canonicalMessage(timestamp: string, body: string): string {
  return `${timestamp}.${body}`;
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return bytesToHex(new Uint8Array(signature));
}

/**
 * Constant-time comparison for two hex digests. Length is compared first
 * (length itself is not secret for fixed-size digests), then every character
 * is XOR-accumulated so early bytes do not influence timing.
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

export async function signBody(
  secret: string,
  body: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<{ timestamp: string; signature: string }> {
  const timestamp = String(Math.floor(nowSeconds));
  const signature = await hmacSha256Hex(secret, canonicalMessage(timestamp, body));
  return { timestamp, signature };
}

export type VerifyOptions = {
  secret: string;
  timestamp: string;
  body: string;
  signature: string;
  toleranceSeconds?: number;
  nowSeconds?: number;
};

/**
 * Verifies HMAC-SHA256 over `${timestamp}.${body}`.
 * Rejects malformed timestamps, stale/future timestamps, and malformed or
 * incorrect signatures. Returns a boolean; callers decide the HTTP status.
 */
export async function verifyBody({
  secret,
  timestamp,
  body,
  signature,
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
  nowSeconds = Math.floor(Date.now() / 1000),
}: VerifyOptions): Promise<boolean> {
  if (!secret || !/^\d{1,12}$/.test(timestamp)) return false;

  const timestampNumber = Number(timestamp);
  if (!Number.isSafeInteger(timestampNumber)) return false;
  if (Math.abs(Math.floor(nowSeconds) - timestampNumber) > toleranceSeconds) return false;

  const provided = signature.trim().toLowerCase().replace(/^sha256=/, "");
  if (!HEX_SIGNATURE.test(provided)) return false;

  const expected = await hmacSha256Hex(secret, canonicalMessage(timestamp, body));
  return timingSafeEqualHex(expected, provided);
}
