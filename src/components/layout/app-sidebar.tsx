'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, Inbox, LayoutDashboard, Users } from 'lucide-react';
import { getActiveNavKey } from '@/lib/nav';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
} from '@/components/ui/sidebar';

// Active-key detection comes from the tested getActiveNavKey pure function
// (src/lib/nav.ts, 11-case Vitest suite) — it locks the /companies/[id] detail
// highlight and the /companies-archive sibling-prefix guard so a drive-by
// "simplification" can never silently break the v1.1 active treatment.
//
// pendingCount is threaded from the server shell (app-shell-layout.tsx) — a
// client component cannot query the DB itself (09-03: Reviews sidebar badge,
// UI-SPEC §4). Shown only when > 0; an empty queue earns no visual noise.
export function AppSidebar({ pendingCount = 0 }: { pendingCount?: number }) {
  const pathname = usePathname();
  const activeKey = getActiveNavKey(pathname);

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[13px] font-semibold">Explore</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={activeKey === 'start'}
                className="h-[30px] p-0 px-2 gap-2.5 rounded-[4px] text-[15px] font-normal"
              >
                <Link href="/">
                  <LayoutDashboard />
                  <span>Start</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={activeKey === 'companies'}
                className="h-[30px] p-0 px-2 gap-2.5 rounded-[4px] text-[15px] font-normal"
              >
                <Link href="/companies">
                  <Building2 />
                  <span>Companies</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={activeKey === 'personas'}
                className="h-[30px] p-0 px-2 gap-2.5 rounded-[4px] text-[15px] font-normal"
              >
                <Link href="/personas">
                  <Users />
                  <span>Key Personas</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup className="-mt-1">
          <SidebarGroupLabel className="text-[13px] font-semibold">Manage</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={activeKey === 'reviews'}
                className="h-[30px] p-0 px-2 gap-2.5 rounded-[4px] text-[15px] font-normal"
              >
                <Link href="/reviews">
                  <Inbox />
                  <span>Reviews</span>
                </Link>
              </SidebarMenuButton>
              {pendingCount > 0 && (
                <>
                  <SidebarMenuBadge
                    role="status"
                    aria-label={`${pendingCount} pending reviews`}
                    className="bg-sidebar-accent text-sidebar-accent-foreground font-mono text-[10px] font-semibold"
                  >
                    {pendingCount} pending
                  </SidebarMenuBadge>
                  <span
                    aria-hidden="true"
                    className="absolute right-1.5 top-1/2 hidden h-2 w-2 -translate-y-1/2 rounded-full bg-sidebar-accent group-data-[collapsible=icon]:block"
                  />
                </>
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
