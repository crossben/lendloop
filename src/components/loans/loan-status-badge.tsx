import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { LoanStatus } from "@convex/lib/constants";
import { STATUS_LABELS } from "@/lib/format";

const tones: Record<LoanStatus, BadgeTone> = {
  requested: "warning",
  approved: "success",
  declined: "danger",
  returned: "neutral",
};

export function LoanStatusBadge({ status }: { status: LoanStatus }) {
  return <Badge tone={tones[status]}>{STATUS_LABELS[status]}</Badge>;
}
