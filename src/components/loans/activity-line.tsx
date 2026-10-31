import { BellRing } from "lucide-react";

import { cn } from "@/lib/cn";
import { activityLabel, type Activity } from "@/lib/format";

export function ActivityLine({ activity }: { activity: Activity | null }) {
  if (!activity) return null;
  const failed = activity.status === "failed";

  return (
    <p
      className={cn(
        "mt-3 flex items-center gap-1.5 text-xs",
        failed ? "font-medium text-danger" : "text-muted",
      )}
    >
      <BellRing className="size-3.5 shrink-0" aria-hidden />
      {activityLabel(activity)}
    </p>
  );
}
