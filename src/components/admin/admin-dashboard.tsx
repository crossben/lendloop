"use client";

import { useMutation, useQuery } from "convex/react";
import {
  CalendarDays,
  Inbox,
  ListChecks,
  ShieldCheck,
  ShieldOff,
  ShieldX,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";

import { LoanStatusBadge } from "@/components/loans/loan-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { PageHeader } from "@/components/ui/page-header";
import { ListRowSkeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { getErrorMessage } from "@/lib/errors";
import {
  CATEGORY_LABELS,
  formatDateRange,
  formatShortDate,
  todayIso,
} from "@/lib/format";
import { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

type Tab = "loans" | "listings" | "neighbors";

type AdminListing = FunctionReturnType<typeof api.tools.listForAdmin>[number];
type AdminUser = FunctionReturnType<typeof api.users.listForAdmin>[number];

const tabs: Array<{ value: Tab; label: string }> = [
  { value: "loans", label: "Loans" },
  { value: "listings", label: "Listings" },
  { value: "neighbors", label: "Neighbors" },
];

function Stat({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <p className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </div>
  );
}

export function AdminDashboard() {
  const me = useQuery(api.users.me);
  const isAdmin = me?.role === "admin";

  const loans = useQuery(api.loans.listAll, isAdmin ? {} : "skip");
  const listings = useQuery(api.tools.listForAdmin, isAdmin ? {} : "skip");
  const neighbors = useQuery(api.users.listForAdmin, isAdmin ? {} : "skip");

  const adminRemove = useMutation(api.tools.adminRemove);
  const setTrustedLender = useMutation(api.users.setTrustedLender);

  const [tab, setTab] = useState<Tab>("loans");
  const [removing, setRemoving] = useState<AdminListing | null>(null);
  const [busy, setBusy] = useState(false);
  const [trustBusyId, setTrustBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const today = todayIso();
  const pendingCount = loans?.filter((loan) => loan.status === "requested").length ?? 0;
  const activeCount =
    loans?.filter(
      (loan) => loan.status === "approved" && loan.endDate >= today,
    ).length ?? 0;
  const overdueCount =
    loans?.filter((loan) => loan.status === "approved" && loan.endDate < today).length ?? 0;
  const activeListings = listings?.filter((listing) => listing.status === "active").length ?? 0;

  async function handleRemove() {
    if (!removing) return;
    setBusy(true);
    setError(null);
    try {
      await adminRemove({ toolId: removing._id });
      setNotice(`Removed “${removing.name}”. Pending requests were declined.`);
      setRemoving(null);
    } catch (cause) {
      setError(getErrorMessage(cause));
      setRemoving(null);
    } finally {
      setBusy(false);
    }
  }

  async function toggleTrusted(user: AdminUser) {
    setTrustBusyId(user._id);
    setError(null);
    try {
      await setTrustedLender({ userId: user._id, trusted: !user.trustedLender });
      setNotice(
        user.trustedLender
          ? `Removed the trusted lender badge from ${user.firstName}.`
          : `${user.firstName} is now a trusted lender.`,
      );
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setTrustBusyId(null);
    }
  }

  if (me === undefined) {
    return (
      <Container className="py-10 sm:py-14">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <ListRowSkeleton key={index} />
          ))}
        </div>
      </Container>
    );
  }

  if (!isAdmin) {
    return (
      <Container className="py-10 sm:py-14">
        <EmptyState
          icon={<ShieldX className="size-5" aria-hidden />}
          title="Admins only"
          description="This dashboard is limited to neighborhood administrators. If you need access, ask an existing admin to add your email to ADMIN_EMAILS on the Convex deployment."
        />
      </Container>
    );
  }

  return (
    <Container className="py-10 sm:py-14">
      <PageHeader
        eyebrow="Operations"
        title="Admin dashboard"
        description="Read-only visibility across loans and listings, plus two deliberate moderation controls. Admins never approve or decline on someone else's behalf."
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

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pending" value={pendingCount} detail="Requests waiting on a lender" />
        <Stat label="Active" value={activeCount} detail="Approved and not yet due" />
        <Stat label="Overdue" value={overdueCount} detail="Approved and past the return date" />
        <Stat label="Listings" value={activeListings} detail="Tools currently on the board" />
      </div>

      <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Admin sections">
        {tabs.map((option) => {
          const active = tab === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(option.value)}
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
        {tab === "loans" ? (
          loans === undefined ? (
            <ListRowSkeleton />
          ) : loans.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="size-5" aria-hidden />}
              title="No loans yet"
              description="Requests and loans will appear here as neighbors use the board."
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">All loans, newest first</caption>
                <thead className="bg-canvas text-xs font-semibold tracking-wide text-muted uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-3">Tool</th>
                    <th scope="col" className="px-4 py-3">Parties</th>
                    <th scope="col" className="px-4 py-3">Dates</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {loans.map((loan) => (
                    <tr key={loan._id}>
                      <td className="px-4 py-3 font-medium text-ink">{loan.toolName}</td>
                      <td className="px-4 py-3 text-muted">
                        {loan.borrowerFirstName} ← {loan.lenderFirstName}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {formatDateRange(loan.startDate, loan.endDate)}
                      </td>
                      <td className="px-4 py-3">
                        <LoanStatusBadge status={loan.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}

        {tab === "listings" ? (
          listings === undefined ? (
            <ListRowSkeleton />
          ) : listings.length === 0 ? (
            <EmptyState
              icon={<ListChecks className="size-5" aria-hidden />}
              title="No listings yet"
              description="Nothing has been listed on this board."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {listings.map((listing) => (
                <article
                  key={listing._id}
                  className="rounded-2xl border border-line bg-surface p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold tracking-tight">
                        {listing.name}
                      </h2>
                      <p className="mt-1 text-xs text-muted">
                        {listing.ownerFirstName} · {listing.ownerEmail}
                      </p>
                    </div>
                    <Badge tone={listing.status === "active" ? "success" : "danger"}>
                      {listing.status === "active" ? "Active" : "Removed"}
                    </Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge tone="neutral">{CATEGORY_LABELS[listing.category]}</Badge>
                    {listing.ownerTrustedLender ? (
                      <Badge tone="accent">
                        <ShieldCheck className="size-3.5" aria-hidden />
                        Trusted lender
                      </Badge>
                    ) : null}
                    <Badge tone="neutral">Listed {formatShortDate(new Date(listing.createdAt).toISOString().slice(0, 10))}</Badge>
                  </div>

                  <p className="mt-3 line-clamp-2 text-sm text-muted">{listing.description}</p>

                  {listing.status === "active" ? (
                    <div className="mt-4 border-t border-line pt-4">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger hover:bg-danger-soft hover:text-danger"
                        onClick={() => setRemoving(listing)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                        Remove listing
                      </Button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )
        ) : null}

        {tab === "neighbors" ? (
          neighbors === undefined ? (
            <ListRowSkeleton />
          ) : neighbors.length === 0 ? (
            <EmptyState
              icon={<Users className="size-5" aria-hidden />}
              title="No neighbors yet"
              description="Signed-in accounts will appear here."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {neighbors.map((user) => (
                <article
                  key={user._id}
                  className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold tracking-tight">
                        {user.firstName} {user.lastName ?? ""}
                      </h2>
                      {user.role === "admin" ? <Badge tone="accent">Admin</Badge> : null}
                      {user.trustedLender ? (
                        <Badge tone="accent">
                          <ShieldCheck className="size-3.5" aria-hidden />
                          Trusted
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted">{user.email}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={trustBusyId === user._id}
                    onClick={() => void toggleTrusted(user)}
                    className="shrink-0"
                  >
                    {user.trustedLender ? (
                      <>
                        <ShieldOff className="size-4" aria-hidden />
                        Revoke badge
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="size-4" aria-hidden />
                        Make trusted
                      </>
                    )}
                  </Button>
                </article>
              ))}
            </div>
          )
        ) : null}
      </div>

      {tab === "loans" && loans && loans.length > 0 ? (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted">
          <Inbox className="size-3.5" aria-hidden />
          Admins can view every loan. Only the lender can approve, decline or close a loan.
        </p>
      ) : null}

      {removing ? (
        <ConfirmDialog
          open
          title={`Remove “${removing.name}”?`}
          description="This is a moderation action. The listing disappears from the board and any pending requests are declined and notified. Approved loans are left untouched."
          confirmLabel="Remove listing"
          loading={busy}
          onClose={() => setRemoving(null)}
          onConfirm={() => void handleRemove()}
        />
      ) : null}
    </Container>
  );
}
