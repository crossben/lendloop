"use client";

import { useMutation } from "convex/react";
import { CalendarDays } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Modal } from "@/components/ui/modal";
import { addDaysIso, formatDate, todayIso } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { MAX_LOAN_MESSAGE_LENGTH } from "@convex/lib/constants";

export function RequestDialog({
  open,
  onClose,
  onSuccess,
  tool,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tool: { _id: Id<"tools">; name: string; ownerFirstName: string };
}) {
  const requestLoan = useMutation(api.loans.request);
  const today = todayIso();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addDaysIso(today, 2));
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!startDate || !endDate) {
      setError("Choose a start and end date.");
      return;
    }
    if (startDate < today) {
      setError("The start date cannot be in the past.");
      return;
    }
    if (endDate < startDate) {
      setError("The end date must be on or after the start date.");
      return;
    }
    if (message.length > MAX_LOAN_MESSAGE_LENGTH) {
      setError(`Keep your note under ${MAX_LOAN_MESSAGE_LENGTH} characters.`);
      return;
    }

    setSubmitting(true);
    try {
      await requestLoan({
        toolId: tool._id,
        startDate,
        endDate,
        message: message.trim() || undefined,
      });
      onSuccess();
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Request ${tool.name}`}
      description={`${tool.ownerFirstName} will approve or decline. Nothing is charged.`}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start date" htmlFor="request-start" hint="Today or later.">
            <Input
              id="request-start"
              type="date"
              value={startDate}
              min={today}
              required
              onChange={(event) => setStartDate(event.target.value)}
              aria-describedby="request-start-hint"
            />
          </Field>
          <Field label="End date" htmlFor="request-end" hint="When you'll return it.">
            <Input
              id="request-end"
              type="date"
              value={endDate}
              min={startDate || today}
              required
              onChange={(event) => setEndDate(event.target.value)}
              aria-describedby="request-end-hint"
            />
          </Field>
        </div>

        <div className="rounded-xl bg-canvas px-3.5 py-3 text-sm text-muted">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-accent" aria-hidden />
            <span>
              {startDate && endDate
                ? `${formatDate(startDate)} → ${formatDate(endDate)}`
                : "Pick your dates"}
            </span>
          </div>
        </div>

        <Field
          label="Note for the lender"
          htmlFor="request-message"
          hint={`Optional · ${message.length}/${MAX_LOAN_MESSAGE_LENGTH}`}
        >
          <Textarea
            id="request-message"
            value={message}
            maxLength={MAX_LOAN_MESSAGE_LENGTH}
            placeholder="What are you working on? A short note helps."
            onChange={(event) => setMessage(event.target.value)}
            aria-describedby="request-message-hint"
          />
        </Field>

        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Send request
          </Button>
        </div>
      </form>
    </Modal>
  );
}
