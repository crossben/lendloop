import type { ComponentType } from "react";
import { Leaf, Package, Sparkles, Tent, Utensils, Wrench } from "lucide-react";

import type { ToolCategory } from "@convex/lib/constants";

type IconProps = { className?: string; "aria-hidden"?: boolean };

const icons: Record<ToolCategory, ComponentType<IconProps>> = {
  "power-tools": Wrench,
  garden: Leaf,
  kitchen: Utensils,
  camping: Tent,
  cleaning: Sparkles,
  other: Package,
};

export function CategoryIcon({
  category,
  className,
}: {
  category: ToolCategory;
  className?: string;
}) {
  const Icon = icons[category];
  return <Icon className={className} aria-hidden />;
}
