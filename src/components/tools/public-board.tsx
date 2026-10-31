"use client";

import { Show, SignInButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { ArrowRight, Hammer } from "lucide-react";
import Link from "next/link";

import { CategoryIcon } from "@/components/tools/category-icon";
import { buttonClassName } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_LABELS } from "@/lib/format";
import { api } from "@convex/_generated/api";

export function PublicBoard() {
  const tools = useQuery(api.tools.listPublic);

  return (
    <section id="shelf" className="scroll-mt-20 py-16 sm:py-20" aria-labelledby="shelf-heading">
      <Container>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">
              Read-only preview
            </p>
            <h2
              id="shelf-heading"
              className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl"
            >
              On the shelf
            </h2>
            <p className="mt-2 max-w-xl text-sm text-pretty text-muted">
              Names and categories only, until you sign in. Availability,
              descriptions and neighbors stay on the members&apos; board.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {tools ? (
              <span className="text-sm text-muted">
                {tools.length} {tools.length === 1 ? "tool" : "tools"}
              </span>
            ) : null}
            <Show when="signed-in">
              <Link
                href="/tools"
                className={buttonClassName({ variant: "secondary", size: "sm" })}
              >
                Open the board
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Show>
          </div>
        </div>

        <div className="mt-8">
          {tools === undefined ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-[74px] rounded-xl" />
              ))}
            </div>
          ) : tools.length === 0 ? (
            <EmptyState
              icon={<Hammer className="size-5" aria-hidden />}
              title="The shelf is empty"
              description="No tools have been listed yet. Sign in to put the first one on the board."
              action={
                <Show when="signed-out">
                  <SignInButton mode="modal">
                    <button type="button" className={buttonClassName({ size: "sm" })}>
                      Sign in to list a tool
                    </button>
                  </SignInButton>
                </Show>
              }
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool, index) => (
                <li
                  key={`${tool.name}-${tool.category}-${index}`}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 shadow-sm"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                    <CategoryIcon category={tool.category} className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                    {tool.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {CATEGORY_LABELS[tool.category]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Show when="signed-out">
          <div className="mt-8 flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface/70 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              Want to see who is lending, request a tool, or add your own?
            </p>
            <SignInButton mode="modal">
              <button type="button" className={buttonClassName({ size: "sm" })}>
                Sign in to lend or borrow
              </button>
            </SignInButton>
          </div>
        </Show>
      </Container>
    </section>
  );
}
