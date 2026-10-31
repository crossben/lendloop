"use client";

import { useMutation, useQuery } from "convex/react";
import { Plus, Trash2, Pencil, Inbox, ListChecks } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { PageHeader } from "@/components/ui/page-header";
import { ListRowSkeleton } from "@/components/ui/skeleton";
import { CategoryIcon } from "@/components/tools/category-icon";
import {
  ToolFormDialog,
  type EditableTool,
} from "@/components/tools/tool-form-dialog";
import { CATEGORY_LABELS, CONDITION_LABELS, formatShortDate } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

type Listing = FunctionReturnType<typeof api.tools.myListings>[number];

export function MyListings() {
  const listings = useQuery(api.tools.myListings);
  const removeTool = useMutation(api.tools.remove);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<EditableTool | null>(null);
  const [removing, setRemoving] = useState<Listing | null>(null);
  const [removingBusy, setRemovingBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove() {
    if (!removing) return;
    setRemovingBusy(true);
    setError(null);
    try {
      await removeTool({ toolId: removing._id });
      setRemoving(null);
      setNotice("Listing removed. Any pending requests were declined.");
    } catch (cause) {
      setError(getErrorMessage(cause));
      setRemoving(null);
    } finally {
      setRemovingBusy(false);
    }
  }

  return (
    <Container className="py-10 sm:py-14">
      <PageHeader
        eyebrow="Your shelf"
        title="My listings"
        description="Manage the tools you lend, keep descriptions current, and see what is out on loan."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" aria-hidden />
            List a tool
          </Button>
        }
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

      <div className="mt-6">
        {listings === undefined ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <ListRowSkeleton key={index} />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <EmptyState
            icon={<ListChecks className="size-5" aria-hidden />}
            title="You haven't listed a tool yet"
            description="Start with something you would happily lend a neighbor — a drill, a ladder, a stand mixer."
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" aria-hidden />
                List your first tool
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <article
                key={listing._id}
                className="flex h-full flex-col rounded-2xl border border-line bg-surface p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <CategoryIcon category={listing.category} className="size-5" />
                  </span>
                  <Badge tone={listing.isAvailableNow ? "success" : "warning"}>
                    {listing.isAvailableNow ? "Available" : "On loan"}
                  </Badge>
                </div>

                <h2 className="mt-4 text-lg font-semibold tracking-tight">{listing.name}</h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone="neutral">{CATEGORY_LABELS[listing.category]}</Badge>
                  <Badge tone="neutral">{CONDITION_LABELS[listing.condition]}</Badge>
                </div>
                <p className="mt-2 line-clamp-3 flex-1 text-sm text-pretty text-muted">
                  {listing.description}
                </p>

                <div className="mt-3 space-y-1.5 text-xs text-muted">
                  {listing.currentLoanEndsOn ? (
                    <p>Back {formatShortDate(listing.currentLoanEndsOn)}</p>
                  ) : null}
                  <p className="flex items-center gap-1.5">
                    <Inbox className="size-3.5" aria-hidden />
                    {listing.pendingRequests === 0
                      ? "No pending requests"
                      : `${listing.pendingRequests} pending ${listing.pendingRequests === 1 ? "request" : "requests"}`}
                    {listing.pendingRequests > 0 ? (
                      <Link
                        href="/incoming"
                        className="font-medium text-accent underline-offset-2 hover:underline"
                      >
                        Review
                      </Link>
                    ) : null}
                  </p>
                  {listing.activeLoans > 0 ? (
                    <p>
                      {listing.activeLoans} active {listing.activeLoans === 1 ? "loan" : "loans"}
                    </p>
                  ) : null}
                </div>

                <div className="mt-4 flex gap-2 border-t border-line pt-4">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setEditing(listing)}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger hover:bg-danger-soft hover:text-danger"
                    onClick={() => setRemoving(listing)}
                    aria-label={`Remove ${listing.name}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {createOpen ? (
        <ToolFormDialog
          open
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            setNotice("Your tool is on the board.");
          }}
        />
      ) : null}

      {editing ? (
        <ToolFormDialog
          open
          tool={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setNotice("Listing updated.");
          }}
        />
      ) : null}

      {removing ? (
        <ConfirmDialog
          open
          title={`Remove “${removing.name}”?`}
          description="The listing disappears from the board. Pending requests for this tool will be declined automatically; approved loans stay in your incoming view until they are returned."
          confirmLabel="Remove listing"
          loading={removingBusy}
          onClose={() => setRemoving(null)}
          onConfirm={handleRemove}
        />
      ) : null}
    </Container>
  );
}
