"use client";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Brand } from "@/components/ui/brand";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { api } from "../../convex/_generated/api";

const baseLinks = [
  { href: "/tools", label: "Browse" },
  { href: "/my-listings", label: "My listings" },
  { href: "/my-requests", label: "My requests" },
  { href: "/incoming", label: "Incoming" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const me = useQuery(api.users.me);
  const [open, setOpen] = useState(false);
  const isAdmin = me?.role === "admin";

  const links = isAdmin
    ? [...baseLinks, { href: "/admin", label: "Admin" }]
    : baseLinks;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Brand />

        <Show when="signed-in">
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-accent-soft text-accent-strong"
                      : "text-muted hover:bg-accent-soft/60 hover:text-ink",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5">
            <UserButton
              appearance={{ elements: { avatarBox: "size-8.5" } }}
            />
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-accent-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:hidden"
              aria-label={open ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            </button>
          </div>
        </Show>

        <Show when="signed-out">
          <SignInButton mode="modal">
            <button type="button" className={buttonClassName({ size: "sm" })}>
              Sign in
            </button>
          </SignInButton>
        </Show>
      </div>

      <Show when="signed-in">
        {open ? (
          <div
            id="mobile-nav"
            className="border-t border-line bg-surface md:hidden"
          >
            <nav className="mx-auto grid w-full max-w-6xl gap-1 px-4 py-3" aria-label="Mobile">
              {links.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-accent-soft text-accent-strong"
                        : "text-muted hover:bg-canvas hover:text-ink",
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        ) : null}
      </Show>
    </header>
  );
}
