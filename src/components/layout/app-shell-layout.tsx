import { cookies } from 'next/headers';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarResizeHandle } from '@/components/layout/sidebar-resize-handle';

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 400;
const DEFAULT_SIDEBAR_WIDTH = 256; // shadcn's stock --sidebar-width (16rem)

// Shared sidebar shell, extracted from companies/layout.tsx and
// personas/layout.tsx (RESEARCH.md Pitfall 1 — this was about to be pasted a
// third time for (dashboard)/layout.tsx). Auth is deliberately NOT checked
// here — the auth gate stays the caller's (route layout's) job, so this
// component can be reused by any route regardless of its auth posture.
export async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const rawWidth = Number(cookieStore.get('sidebar_width')?.value);
  const sidebarWidth =
    Number.isFinite(rawWidth) && rawWidth >= MIN_SIDEBAR_WIDTH && rawWidth <= MAX_SIDEBAR_WIDTH
      ? rawWidth
      : DEFAULT_SIDEBAR_WIDTH;

  return (
    <SidebarProvider style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}>
      <AppSidebar />
      <SidebarResizeHandle />
      <SidebarInset>
        <SidebarTrigger />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
