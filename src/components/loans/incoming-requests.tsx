"use client";

import { useMutation, useQuery } from "convex/react";
import { Check, Inbox, RotateCcw, X } from "lucide-react";
import { useState } from "react";

import { LoanCard } from "@/components/loans/loan-card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { PageHeader } from "@/components/ui/page-header";
import { ListRowSkeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/errors";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { LoanStatus } from "@convex/lib/constants";
import type { FunctionReturnType } from "convex/server";

type IncomingLoan = FunctionReturnType<typeof api.loans.listIncoming>[number];

type ConfirmAction = {
  loan: IncomingLoan;
  kind: "decline" | "return";
};

const hints: Record<LoanStatus, string> = {
  requested: "Approve if the dates work; decline if they do not.",
  approved: "Mark returned once the tool is back in your hands.",
  declined: "You declined this request.",
  returned: "This loan is closed.",
};

export function IncomingRequests() {
  const loans = useQuery(api.loans.listIncoming);
  const decide = useMutation(api.loans.decide);
  const markReturned = useMutation(api.loans.markReturned);

  const [busyId, setBusyId] = useState<Id<"loans"> | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function approve(loan: IncomingLoan) {
    setBusyId(loan._id);
    setError(null);
    try {
      await decide({ loanId: loan._id, decision: "approve" });
      setNotice(`Approved the request for ${loan.toolName}.`);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setBusyId(null);
    }
  }

  async function runConfirmed() {
    if (!confirm) return;
    setConfirmBusy(true);
    setError(null);
    try {
      if (confirm.kind === "decline") {
        await decide({ loanId: confirm.loan._id, decision: "decline" });
        setNotice(`Declined the request for ${confirm.loan.toolName}.`);
      } else {
        await markReturned({ loanId: confirm.loan._id });
        setNotice(`${confirm.loan.toolName} marked as returned.`);
      }
      setConfirm(null);
    } catch (cause) {
      setError(getErrorMessage(cause));
      setConfirm(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  const pendingCount = loans?.filter((loan) => loan.status === "requested").length ?? 0;

  return (
    <Container className="py-10 sm:py-14">
      <PageHeader
        eyebrow="Lending"
        title="Incoming requests"
        description="Approve or decline requests for your tools, then close the loop when they come home."
      />

      {notice ? (
        <InlineAlert tone="success" className="mt-6">
          {notice}
        </InlineAlert>
      ) : null}
      {error ? (
        <InlineAlert tone="error" className="mt-6">
          {error}
        </InlineAlert>
      ) : null}

      {pendingCount > 0 ? (
        <InlineAlert tone="info" className="mt-6">
          {pendingCount === 1
            ? "One neighbor is waiting on an answer."
            : `${pendingCount} neighbors are waiting on an answer.`}
        </InlineAlert>
      ) : null}

      <div className="mt-6">
        {loans === undefined ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <ListRowSkeleton key={index} />
            ))}
          </div>
        ) : loans.length === 0 ? (
          <EmptyState
            icon={<Inbox className="size-5" aria-hidden />}
            title="No incoming requests yet"
            description="When a neighbor asks to borrow one of your tools, the request appears here — and n8n sends you an email."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loans.map((loan) => {
              const busy = busyId === loan._id;
              return (
                <LoanCard
                  key={loan._id}
                  loan={loan}
                  partyLabel={`From ${loan.borrowerFirstName}`}
                  hint={hints[loan.status]}
                  actions={
                    loan.status === "requested" ? (
                      <>
                        <Button size="sm" loading={busy} onClick={() => void approve(loan)}>
                          <Check className="size-4" aria-hidden />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-danger hover:bg-danger-soft hover:text-danger"
                          disabled={busy}
                          onClick={() => setConfirm({ loan, kind: "decline" })}
                        >
                          <X className="size-4" aria-hidden />
                          Decline
                        </Button>
                      </>
                    ) : loan.status === "approved" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setConfirm({ loan, kind: "return" })}
                      >
                        <RotateCcw className="size-4" aria-hidden />
                        Mark returned
                      </Button>
                    ) : null
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      {confirm ? (
        <ConfirmDialog
          open
          title={
            confirm.kind === "decline"
              ? `Decline ${confirm.loan.borrowerFirstName}'s request?`
              : `Mark ${confirm.loan.toolName} as returned?`
          }
          description={
            confirm.kind === "decline"
              ? `${confirm.loan.borrowerFirstName} will be notified that the ${confirm.loan.toolName} is not available for those dates. You can accept a new request later.`
              : `This closes the loan for ${confirm.loan.borrowerFirstName} and stops overdue reminders. Only mark it returned once you actually have the tool back.`
          }
          confirmLabel={confirm.kind === "decline" ? "Decline request" : "Mark returned"}
          loading={confirmBusy}
          onClose={() => setConfirm(null)}
          onConfirm={() => void runConfirmed()}
        />
      ) : null}
    </Container>
  );
}
