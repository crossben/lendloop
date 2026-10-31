import Link from "next/link";
import { Repeat2 } from "lucide-react";

import { cn } from "@/lib/cn";

export function Brand({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        className,
      )}
      aria-label="LendLoop home"
    >
      <span className="flex size-8 items-center justify-center rounded-full bg-accent text-white">
        <Repeat2 className="size-4" aria-hidden />
      </span>
      <span className="text-[1.05rem] font-semibold tracking-tight">LendLoop</span>
    </Link>
  );
}
