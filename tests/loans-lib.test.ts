import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";

import type { LoanStatus } from "../convex/lib/constants";
import { addDaysUtc, daysBetween, isOverdue, isValidDateString, todayUtc } from "../convex/lib/dates";
import {
  assertTransition,
  canTransition,
  rangesOverlap,
  validateLoanRange,
} from "../convex/lib/loans";

function caught(fn: () => void): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error("Expected the function to throw");
}

function expectCode(fn: () => void, code: string) {
  const error = caught(fn);
  expect(error).toBeInstanceOf(ConvexError);
  expect((error as ConvexError<{ code: string }>).data.code).toBe(code);
}

describe("loan state machine", () => {
  const statuses: LoanStatus[] = ["requested", "approved", "declined", "returned"];

  const allowed: Record<LoanStatus, LoanStatus[]> = {
    requested: ["approved", "declined"],
    approved: ["returned"],
    declined: [],
    returned: [],
  };

  it("only permits the documented transitions", () => {
    for (const from of statuses) {
      for (const to of statuses) {
        expect(canTransition(from, to), `${from} → ${to}`).toBe(allowed[from].includes(to));
      }
    }
  });

  it("throws INVALID_TRANSITION for an illegal transition", () => {
    expectCode(() => assertTransition("requested", "returned"), "INVALID_TRANSITION");
    expectCode(() => assertTransition("declined", "approved"), "INVALID_TRANSITION");
    expectCode(() => assertTransition("returned", "returned"), "INVALID_TRANSITION");
  });

  it("allows every documented transition", () => {
    expect(() => assertTransition("requested", "approved")).not.toThrow();
    expect(() => assertTransition("requested", "declined")).not.toThrow();
    expect(() => assertTransition("approved", "returned")).not.toThrow();
  });
});

describe("rangesOverlap", () => {
  it("treats the start and end days as inclusive", () => {
    expect(rangesOverlap("2026-11-01", "2026-11-03", "2026-11-03", "2026-11-05")).toBe(true);
    expect(rangesOverlap("2026-11-03", "2026-11-05", "2026-11-01", "2026-11-03")).toBe(true);
  });

  it("detects one range containing the other", () => {
    expect(rangesOverlap("2026-11-01", "2026-11-10", "2026-11-03", "2026-11-04")).toBe(true);
    expect(rangesOverlap("2026-11-03", "2026-11-04", "2026-11-01", "2026-11-10")).toBe(true);
  });

  it("returns false for adjacent and disjoint ranges", () => {
    expect(rangesOverlap("2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04")).toBe(false);
    expect(rangesOverlap("2026-11-10", "2026-11-12", "2026-11-01", "2026-11-03")).toBe(false);
  });
});

describe("validateLoanRange", () => {
  const today = "2026-10-31";

  it("accepts today and future ranges", () => {
    expect(validateLoanRange({ startDate: today, endDate: today }, today)).toEqual({
      startDate: today,
      endDate: today,
    });
    expect(
      validateLoanRange({ startDate: "2026-11-02", endDate: "2026-11-05" }, today),
    ).toEqual({ startDate: "2026-11-02", endDate: "2026-11-05" });
  });

  it("trims whitespace", () => {
    expect(
      validateLoanRange({ startDate: " 2026-11-02 ", endDate: " 2026-11-05 " }, today),
    ).toEqual({ startDate: "2026-11-02", endDate: "2026-11-05" });
  });

  it("rejects malformed dates", () => {
    for (const value of ["2026-02-30", "2026-13-01", "11/02/2026", "2026-1-1", ""]) {
      expectCode(
        () => validateLoanRange({ startDate: value, endDate: "2026-11-05" }, today),
        "INVALID_DATES",
      );
    }
  });

  it("rejects reversed ranges", () => {
    expectCode(
      () => validateLoanRange({ startDate: "2026-11-05", endDate: "2026-11-02" }, today),
      "INVALID_DATES",
    );
  });

  it("rejects a start date in the past", () => {
    expectCode(
      () => validateLoanRange({ startDate: "2026-10-30", endDate: "2026-11-02" }, today),
      "INVALID_DATES",
    );
  });
});

describe("date helpers", () => {
  it("validates calendar dates, including leap years", () => {
    expect(isValidDateString("2024-02-29")).toBe(true);
    expect(isValidDateString("2026-02-29")).toBe(false);
    expect(isValidDateString("2026-00-10")).toBe(false);
    expect(isValidDateString("2026-12-32")).toBe(false);
    expect(isValidDateString("2026-12-1")).toBe(false);
  });

  it("formats today in UTC", () => {
    expect(todayUtc(0)).toBe("1970-01-01");
    expect(todayUtc(Date.parse("2026-10-31T23:59:59.000Z"))).toBe("2026-10-31");
  });

  it("adds days across month and year boundaries", () => {
    expect(addDaysUtc("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysUtc("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDaysUtc("2024-02-28", 1)).toBe("2024-02-29");
  });

  it("counts days between dates", () => {
    expect(daysBetween("2026-10-26", "2026-10-31")).toBe(5);
    expect(daysBetween("2026-10-31", "2026-10-26")).toBe(-5);
    expect(daysBetween("2026-10-31", "2026-10-31")).toBe(0);
  });

  it("marks a loan overdue only after the end date", () => {
    expect(isOverdue("2026-10-30", "2026-10-31")).toBe(true);
    expect(isOverdue("2026-10-31", "2026-10-31")).toBe(false);
    expect(isOverdue("2026-11-01", "2026-10-31")).toBe(false);
  });
});
