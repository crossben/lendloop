import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-xl bg-line/70", className)}
      aria-hidden
    />
  );
}

export function ToolCardSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="size-10 rounded-xl" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-6 w-2/3" />
      <Skeleton className="mt-2 h-4 w-full" />
      <Skeleton className="mt-1.5 h-4 w-4/5" />
      <div className="mt-5 flex items-center justify-between">
        <Skeleton className="h-5 w-28 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>
    </div>
  );
}

export function ListRowSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="mt-2 h-4 w-2/3" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-4 w-1/3" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-9 w-2/3 max-w-md" />
      <Skeleton className="mt-3 h-4 w-full max-w-lg" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ToolCardSkeleton />
        <ToolCardSkeleton />
        <ToolCardSkeleton />
      </div>
    </div>
  );
}
