"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonClassName, Button } from "@/components/ui/button";
import { CategoryIcon } from "@/components/tools/category-icon";
import { RequestDialog } from "@/components/tools/request-dialog";
import { cn } from "@/lib/cn";
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  formatShortDate,
} from "@/lib/format";
import type { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

type Tool = FunctionReturnType<typeof api.tools.list>[number];

export function ToolCard({ tool }: { tool: Tool }) {
  const [requestOpen, setRequestOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const availabilityLabel = tool.isAvailableNow ? "Available" : "On loan";
  const timing = tool.currentLoanEndsOn
    ? `Back ${formatShortDate(tool.currentLoanEndsOn)}`
    : tool.upcomingLoanStart
      ? `Booked from ${formatShortDate(tool.upcomingLoanStart)}`
      : "Ready when you are";

  return (
    <article className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <CategoryIcon category={tool.category} className="size-5" />
        </span>
        <Badge tone={tool.isAvailableNow ? "success" : "warning"}>
          <span
            className={cn(
              "size-1.5 rounded-full",
              tool.isAvailableNow ? "bg-accent" : "bg-warn",
            )}
            aria-hidden
          />
          {availabilityLabel}
        </Badge>
      </div>

      <div className="mt-4 flex-1">
        <h3 className="text-lg font-semibold tracking-tight text-ink">{tool.name}</h3>
        <p className="mt-1.5 line-clamp-3 text-sm text-pretty text-muted">
          {tool.description}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{CATEGORY_LABELS[tool.category]}</Badge>
          <Badge tone="neutral">{CONDITION_LABELS[tool.condition]}</Badge>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          {tool.isOwner ? (
            <Badge tone="accent">Your listing</Badge>
          ) : (
            <span>Listed by {tool.ownerFirstName}</span>
          )}
          {tool.ownerTrustedLender ? (
            <Badge tone="accent">
              <ShieldCheck className="size-3.5" aria-hidden />
              Trusted lender
            </Badge>
          ) : null}
        </div>

        <p className="mt-3 text-xs font-medium text-muted">{timing}</p>
      </div>

      {notice ? (
        <p role="status" className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-xs font-medium text-accent-strong">
          {notice}
        </p>
      ) : null}

      <div className="mt-5 border-t border-line pt-4">
        {tool.isOwner ? (
          <Link
            href="/my-listings"
            className={buttonClassName({ variant: "secondary", size: "sm", className: "w-full" })}
          >
            Manage listing
          </Link>
        ) : (
          <Button size="sm" className="w-full" onClick={() => setRequestOpen(true)}>
            Request to borrow
          </Button>
        )}
      </div>

      {requestOpen ? (
        <RequestDialog
          open
          onClose={() => setRequestOpen(false)}
          onSuccess={() => {
            setRequestOpen(false);
            setNotice(`Request sent to ${tool.ownerFirstName}.`);
          }}
          tool={{
            _id: tool._id,
            name: tool.name,
            ownerFirstName: tool.ownerFirstName,
          }}
        />
      ) : null}
    </article>
  );
}
