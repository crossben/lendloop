import type { LoanStatus } from "./constants";
import { isValidDateString, todayUtc } from "./dates";
import { appError } from "./errors";

/**
 * Explicit loan state machine:
 *
 *   requested ──► approved ──► returned
 *       └──────► declined
 *
 * Any other transition is rejected by the server.
 */
export const LOAN_TRANSITIONS: Readonly<Record<LoanStatus, readonly LoanStatus[]>> = {
  requested: ["approved", "declined"],
  approved: ["returned"],
  declined: [],
  returned: [],
};

export function canTransition(from: LoanStatus, to: LoanStatus): boolean {
  return LOAN_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: LoanStatus, to: LoanStatus): void {
  if (!canTransition(from, to)) {
    throw appError(
      "INVALID_TRANSITION",
      `A ${from} request cannot be marked as ${to}.`,
    );
  }
}

/** Inclusive overlap check on `YYYY-MM-DD` strings. */
export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export type ValidatedLoanRange = {
  startDate: string;
  endDate: string;
};

export function validateLoanRange(
  input: { startDate: string; endDate: string },
  today: string = todayUtc(),
): ValidatedLoanRange {
  const startDate = input.startDate.trim();
  const endDate = input.endDate.trim();

  if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
    throw appError("INVALID_DATES", "Choose valid start and end dates.");
  }
  if (startDate > endDate) {
    throw appError("INVALID_DATES", "The start date must be on or before the end date.");
  }
  if (startDate < today) {
    throw appError("INVALID_DATES", "Requests cannot start in the past.");
  }

  return { startDate, endDate };
}
