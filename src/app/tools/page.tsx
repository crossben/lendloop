import type { Metadata } from "next";

import { AllTools } from "@/components/tools/all-tools";

export const metadata: Metadata = {
  title: "Browse tools",
};

export default function ToolsPage() {
  return <AllTools />;
}
