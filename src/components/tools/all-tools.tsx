"use client";

import { useQuery } from "convex/react";
import { PackageSearch } from "lucide-react";
import { useState } from "react";

import {
  CategoryFilter,
  type CategoryValue,
} from "@/components/tools/category-filter";
import { ToolCard } from "@/components/tools/tool-card";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ToolCardSkeleton } from "@/components/ui/skeleton";
import { api } from "@convex/_generated/api";

export function AllTools() {
  const [category, setCategory] = useState<CategoryValue>("all");
  const tools = useQuery(api.tools.list, {
    category: category === "all" ? undefined : category,
  });

  return (
    <Container className="py-10 sm:py-14">
      <PageHeader
        eyebrow="The board"
        title="Tools on your street"
        description="Filter by category, check availability, and send a request with your dates."
      />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CategoryFilter value={category} onChange={setCategory} />
        <p className="text-sm text-muted" aria-live="polite">
          {tools === undefined
            ? "Loading tools…"
            : `${tools.length} ${tools.length === 1 ? "tool" : "tools"} shown`}
        </p>
      </div>

      <div className="mt-6">
        {tools === undefined ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <ToolCardSkeleton key={index} />
            ))}
          </div>
        ) : tools.length === 0 ? (
          <EmptyState
            icon={<PackageSearch className="size-5" aria-hidden />}
            title={category === "all" ? "No tools on the board yet" : "Nothing in this category yet"}
            description={
              category === "all"
                ? "Be the first to lend something. It only takes a minute to list a tool."
                : "Try another category, or list a tool of your own."
            }
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCategory("all")}
              >
                Show all tools
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <ToolCard key={tool._id} tool={tool} />
            ))}
          </div>
        )}
      </div>
    </Container>
  );
}
