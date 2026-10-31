import Link from "next/link";

import { buttonClassName } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <p className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">
        404
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">
        That shelf is empty
      </h1>
      <p className="mt-2 text-pretty text-muted">
        The page you were looking for is not here. Head back to the board and see
        what neighbors are lending.
      </p>
      <Link href="/" className={buttonClassName({ className: "mt-6" })}>
        Back to LendLoop
      </Link>
    </div>
  );
}
