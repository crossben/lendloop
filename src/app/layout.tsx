import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "LendLoop — Borrow what you need. Lend what you don't.",
    template: "%s · LendLoop",
  },
  description:
    "A neighborhood tool-lending board. Borrow what you need, lend what you don't, and let automated reminders handle the follow-up.",
  applicationName: "LendLoop",
  openGraph: {
    title: "LendLoop",
    description: "Borrow what you need. Lend what you don't.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f6f1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider
          afterSignOutUrl="/"
          signInFallbackRedirectUrl="/tools"
          signUpFallbackRedirectUrl="/tools"
          appearance={{
            variables: {
              colorPrimary: "#2f6b4f",
              colorBackground: "#fffefa",
              colorForeground: "#1b2420",
              colorInput: "#fffefa",
              colorInputForeground: "#1b2420",
              borderRadius: "0.75rem",
            },
          }}
        >
          <Providers>
            <a href="#main" className="skip-link">
              Skip to content
            </a>
            <div className="flex min-h-dvh flex-col">
              <SiteHeader />
              <main id="main" className="flex-1">
                {children}
              </main>
              <SiteFooter />
            </div>
          </Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
