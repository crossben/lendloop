import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

import { cn } from "@/lib/cn";

type AlertTone = "error" | "success" | "info";

const tones: Record<AlertTone, { container: string; icon: ReactNode }> = {
  error: {
    container: "border-danger/25 bg-danger-soft text-danger",
    icon: <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />,
  },
  success: {
    container: "border-accent/25 bg-accent-soft text-accent-strong",
    icon: <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />,
  },
  info: {
    container: "border-info/25 bg-info-soft text-info",
    icon: <Info className="mt-0.5 size-4 shrink-0" aria-hidden />,
  },
};

export function InlineAlert({
  tone = "error",
  children,
  className,
}: {
  tone?: AlertTone;
  children: ReactNode;
  className?: string;
}) {
  const style = tones[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live="polite"
      className={cn("flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-sm", style.container, className)}
    >
      {style.icon}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
