"use client";

import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import { useEffect } from "react";

import { api } from "../../convex/_generated/api";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mirrors the Clerk profile into Convex on first sign-in. Mutations also
 * self-heal, but this keeps role/trusted-lender state fresh in the UI without
 * waiting for the first write.
 */
export function UserSync() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const sync = useMutation(api.users.sync);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !isAuthenticated) return;

    let cancelled = false;

    const run = async () => {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        if (cancelled) return;
        try {
          await sync();
          return;
        } catch (error) {
          if (attempt === 3) {
            console.error("[lendloop] Could not sync the signed-in user", error);
            return;
          }
          await sleep(350 * attempt);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, isAuthenticated, user?.id, sync]);

  return null;
}
