import type { Metadata } from "next";

import { IncomingRequests } from "@/components/loans/incoming-requests";

export const metadata: Metadata = {
  title: "Incoming requests",
};

export default function IncomingPage() {
  return <IncomingRequests />;
}
