import { Container } from "@/components/ui/container";
import { Brand } from "@/components/ui/brand";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line">
      <Container className="flex flex-col gap-6 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm">
          <Brand />
          <p className="mt-3 text-sm text-pretty text-muted">
            Borrow what you need. Lend what you don&apos;t. A small neighborhood
            board with a little automation behind it.
          </p>
        </div>
        <p className="max-w-xs text-xs leading-relaxed text-muted">
          Built with Next.js, Convex, Clerk and n8n. Tool requests are between
          neighbors; LendLoop does not handle payments or insurance.
        </p>
      </Container>
    </footer>
  );
}
