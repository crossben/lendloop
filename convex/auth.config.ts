import type { AuthConfig } from "convex/server";

/**
 * Clerk issues a JWT from the template named "convex" (aud: "convex").
 * Set CLERK_JWT_ISSUER_DOMAIN on the Convex deployment:
 *   npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-app.clerk.accounts.dev
 */
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN ?? "",
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
