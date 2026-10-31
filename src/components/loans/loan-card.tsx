import type { ReactNode } from "react";
import { CalendarDays } from "lucide-react";

import { ActivityLine } from "@/components/loans/activity-line";
import { LoanStatusBadge } from "@/components/loans/loan-status-badge";
import { CategoryIcon } from "@/components/tools/category-icon";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import {
  CATEGORY_LABELS,
  formatDateRange,
  type Activity,
} from "@/lib/format";
import type { Id } from "@convex/_generated/dataModel";
import type { LoanStatus, ToolCategory } from "@convex/lib/constants";

export type LoanListItem = {
  _id: Id<"loans">;
  toolName: string;
  toolCategory: ToolCategory | null;
  startDate: string;
  endDate: string;
  status: LoanStatus;
  message?: string;
  createdAt: number;
  activity: Activity | null;
};

const borrowerHints: Record<LoanStatus, string> = {
  requested: "Waiting for the lender to respond.",
  approved: "Approved — arrange pickup with your neighbor.",
  declined: "This request was declined. Try another tool or another date range.",
  returned: "Returned. Thanks for closing the loop.",
};

export function LoanCard({
  loan,
  partyLabel,
  hint,
  actions,
  className,
}: {
  loan: LoanListItem;
  partyLabel: string;
  hint?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-2xl border border-line bg-surface p-5 shadow-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
          {loan.toolCategory ? (
            <CategoryIcon category={loan.toolCategory} className="size-4" />
          ) : (
            <CalendarDays className="size-4" aria-hidden />
          )}
        </span>
        <LoanStatusBadge status={loan.status} />
      </div>

      <div className="mt-3 flex-1">
        <h3 className="text-lg font-semibold tracking-tight text-ink">{loan.toolName}</h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>{partyLabel}</span>
          {loan.toolCategory ? (
            <Badge tone="neutral">{CATEGORY_LABELS[loan.toolCategory]}</Badge>
          ) : null}
        </div>

        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
          <CalendarDays className="size-3.5 shrink-0" aria-hidden />
          {formatDateRange(loan.startDate, loan.endDate)}
        </p>

        {loan.message ? (
          <blockquote className="mt-3 rounded-xl bg-canvas px-3 py-2 text-sm text-muted">
            “{loan.message}”
          </blockquote>
        ) : null}

        {hint ? <p className="mt-3 text-xs text-muted">{hint}</p> : null}
        <ActivityLine activity={loan.activity} />
      </div>

      {actions ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {actions}
        </div>
      ) : null}
    </article>
  );
}

export function borrowerHint(status: LoanStatus): string {
  return borrowerHints[status];
}
