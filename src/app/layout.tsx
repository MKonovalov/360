import { ClerkProvider } from '@clerk/nextjs';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import type { Metadata } from 'next';
import './globals.css';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'ArcLumen 360',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <NuqsAdapter>
        <html lang="en" className={cn("h-full", "font-sans", geist.variable)}>
          <body className="h-full bg-slate-50 text-slate-900 antialiased">{children}</body>
        </html>
      </NuqsAdapter>
    </ClerkProvider>
  );
}
