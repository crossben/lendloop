"use client";

import { Show, SignInButton } from "@clerk/nextjs";
import { ArrowRight, CalendarCheck, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";

import { buttonClassName } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

const assurances = [
  { icon: Users, label: "Neighbors only" },
  { icon: ShieldCheck, label: "No fees, no middleman" },
  { icon: CalendarCheck, label: "Reminders handled for you" },
];

export function Hero() {
  return (
    <section className="hero-glow relative isolate overflow-hidden border-b border-line">
      <Container className="flex flex-col items-center py-20 text-center sm:py-28">
        {/* <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1 text-xs font-medium text-muted">
          <span className="size-1.5 rounded-full bg-accent" aria-hidden />
          The neighborhood tool shelf
        </span> */}

        <h1 className="mt-7 max-w-4xl text-[clamp(2.6rem,7vw,5rem)] font-semibold leading-[0.99] tracking-[-0.045em] text-balance text-ink">
          Borrow what you need.
          <br />
          Lend what you don&apos;t.
        </h1>

        <p className="mt-6 max-w-xl text-pretty text-base text-muted sm:text-lg">
          A drill for one afternoon. A ladder for the weekend. LendLoop connects
          neighbors with the tools already sitting in their cupboards — and
          handles the follow-up.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button type="button" className={buttonClassName({ size: "lg" })}>
                Sign in to lend or borrow
                <ArrowRight className="size-4" aria-hidden />
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <Link href="/tools" className={buttonClassName({ size: "lg" })}>
              Open the board
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Show>
          <a
            href="#shelf"
            className={buttonClassName({ variant: "secondary", size: "lg" })}
          >
            See what&apos;s on the shelf
          </a>
        </div>

        <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs font-medium text-muted">
          {assurances.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-1.5">
              <Icon className="size-4 text-accent" aria-hidden />
              {label}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
