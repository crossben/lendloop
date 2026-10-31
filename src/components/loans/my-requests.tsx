"use client";

import { useQuery } from "convex/react";
import { CalendarClock, Inbox } from "lucide-react";
import { useState } from "react";

import { LoanCard, borrowerHint } from "@/components/loans/loan-card";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ListRowSkeleton } from "@/components/ui/skeleton";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { api } from "@convex/_generated/api";
import type { LoanStatus } from "@convex/lib/constants";
import Link from "next/link";

type Filter = "all" | LoanStatus;

const filters: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "requested", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "declined", label: "Declined" },
  { value: "returned", label: "Returned" },
];

export function MyRequests() {
  const loans = useQuery(api.loans.listMine);
  const [filter, setFilter] = useState<Filter>("all");

  const visible = loans?.filter((loan) => filter === "all" || loan.status === filter);

  return (
    <Container className="py-10 sm:py-14">
      <PageHeader
        eyebrow="Borrowing"
        title="My requests"
        description="Every tool you have asked to borrow, with the latest automation activity."
        actions={
          <Link href="/tools" className={buttonClassName({ size: "sm", variant: "secondary" })}>
            Browse the board
          </Link>
        }
      />

      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter requests by status">
        {filters.map((option) => {
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(option.value)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
                active
                  ? "border-accent bg-accent text-white shadow-sm"
                  : "border-line bg-surface text-muted hover:border-accent/35 hover:text-ink",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {loans === undefined ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <ListRowSkeleton key={index} />
            ))}
          </div>
        ) : visible && visible.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((loan) => (
              <LoanCard
                key={loan._id}
                loan={loan}
                partyLabel={`From ${loan.lenderFirstName}`}
                hint={borrowerHint(loan.status)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={filter === "all" ? <Inbox className="size-5" aria-hidden /> : <CalendarClock className="size-5" aria-hidden />}
            title={filter === "all" ? "No requests yet" : `No ${filter} requests`}
            description={
              filter === "all"
                ? "Find a tool on the board and send your first request. The lender handles approval, and LendLoop handles the reminder."
                : "Try another status filter, or head back to the board."
            }
            action={
              <Link href="/tools" className={buttonClassName({ size: "sm" })}>
                Browse tools
              </Link>
            }
          />
        )}
      </div>
    </Container>
  );
}
