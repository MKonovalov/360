import { ClerkProvider } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import type { Metadata } from 'next';
import './globals.css';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { DebugLaunchPreferenceProvider } from '@/components/analysis/debug-launch-preference-provider';
import { deriveCanUseDebugLaunches } from '@/lib/auth/debugAdminConfig';

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'ArcLumen 360',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // This is the true app root — /companies and /personas are sibling route
  // trees to (dashboard), not descendants of it, so the single
  // DebugLaunchPreferenceProvider instance must mount here to survive client
  // navigation between them (see src/app/layout.test.tsx). auth() is
  // deliberately non-redirecting (not requireStaffAccess) because this
  // layout also wraps /sign-in.
  const { userId } = await auth();
  const canUseDebugLaunches = deriveCanUseDebugLaunches(userId);

  return (
    <ClerkProvider>
      <NuqsAdapter>
        <html lang="en" className={cn("h-full", "font-sans", geist.variable)}>
          <body className="h-full bg-slate-50 text-slate-900 antialiased">
            <DebugLaunchPreferenceProvider
              key={canUseDebugLaunches ? 'debug-enabled' : 'debug-disabled'}
              canUseDebugLaunches={canUseDebugLaunches}
            >
              {children}
            </DebugLaunchPreferenceProvider>
          </body>
        </html>
      </NuqsAdapter>
    </ClerkProvider>
  );
}
