import { ConvexError } from "convex/values";
import { expect } from "vitest";

type ErrorData = { code?: string };

export async function expectConvexError(
  operation: Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await operation;
  } catch (error) {
    expect(error).toBeInstanceOf(ConvexError);
    expect((error as ConvexError<ErrorData>).data?.code).toBe(code);
    return;
  }
  throw new Error(`Expected a ConvexError with code ${code}`);
}

export function expectConvexErrorSync(
  operation: () => unknown,
  code: string,
): void {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(ConvexError);
    expect((error as ConvexError<ErrorData>).data?.code).toBe(code);
    return;
  }
  throw new Error(`Expected a ConvexError with code ${code}`);
}
