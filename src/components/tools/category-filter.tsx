"use client";

import { TOOL_CATEGORIES, type ToolCategory } from "@convex/lib/constants";

import { cn } from "@/lib/cn";
import { CATEGORY_LABELS } from "@/lib/format";

export type CategoryValue = ToolCategory | "all";

const options: Array<{ value: CategoryValue; label: string }> = [
  { value: "all", label: "All tools" },
  ...TOOL_CATEGORIES.map((category) => ({
    value: category,
    label: CATEGORY_LABELS[category],
  })),
];

export function CategoryFilter({
  value,
  onChange,
}: {
  value: CategoryValue;
  onChange: (value: CategoryValue) => void;
}) {
  return (
    <div
      className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-1"
      role="group"
      aria-label="Filter tools by category"
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
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
  );
}
