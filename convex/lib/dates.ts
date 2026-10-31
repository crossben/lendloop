const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Loan dates are stored as calendar strings (`YYYY-MM-DD`) and interpreted in
 * UTC. This keeps date-only comparisons deterministic across browsers and
 * server timezones. See the README's production notes for the timezone
 * trade-off.
 */
export function isValidDateString(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;

  const [yearPart, monthPart, dayPart] = value.split("-");
  if (!yearPart || !monthPart || !dayPart) return false;

  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function todayUtc(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function addDaysUtc(date: string, days: number): string {
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  if (Number.isNaN(timestamp)) {
    throw new Error(`Invalid date: ${date}`);
  }
  return new Date(timestamp + days * 86_400_000).toISOString().slice(0, 10);
}

/** Inclusive calendar-day difference; returns `to - from` in days. */
export function daysBetween(from: string, to: string): number {
  const fromTime = Date.parse(`${from}T00:00:00.000Z`);
  const toTime = Date.parse(`${to}T00:00:00.000Z`);
  if (Number.isNaN(fromTime) || Number.isNaN(toTime)) {
    throw new Error("Invalid date range");
  }
  return Math.round((toTime - fromTime) / 86_400_000);
}

export function isOverdue(endDate: string, today: string = todayUtc()): boolean {
  return endDate < today;
}
