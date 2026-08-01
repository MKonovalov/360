'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Inbox } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
} from '@/components/ui/sidebar';

// Client Component: both Companies and Key Personas are now real routes, so
// "active" is computed from usePathname() rather than hardcoded (03-RESEARCH.md
// Pattern 5). .startsWith(), not exact equality, so /companies/[id] and
// /personas/[id] (added in Plan 03-03) both still highlight the correct
// single item (03-RESEARCH.md Pitfall 3).
//
// pendingCount is threaded from the server shell (app-shell-layout.tsx) — a
// client component cannot query the DB itself (09-03: Reviews sidebar badge,
// UI-SPEC §4). Shown only when > 0; an empty queue earns no visual noise.
export function AppSidebar({ pendingCount = 0 }: { pendingCount?: number }) {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                // Exact equality, not .startsWith('/') — every route in this
                // app is a string-prefix match for '/', so a naive prefix
                // check would highlight "Start" on every single page.
                isActive={pathname === '/'}
                className="data-active:bg-indigo-50 data-active:text-indigo-600 data-active:hover:bg-indigo-50 data-active:hover:text-indigo-600"
              >
                <Link href="/">Start</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith('/companies')}
                className="data-active:bg-indigo-50 data-active:text-indigo-600 data-active:hover:bg-indigo-50 data-active:hover:text-indigo-600"
              >
                <Link href="/companies">Companies</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith('/personas')}
                className="data-active:bg-indigo-50 data-active:text-indigo-600 data-active:hover:bg-indigo-50 data-active:hover:text-indigo-600"
              >
                <Link href="/personas">Key Personas</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith('/reviews')}
                className="data-active:bg-indigo-50 data-active:text-indigo-600 data-active:hover:bg-indigo-50 data-active:hover:text-indigo-600"
              >
                <Link href="/reviews">
                  <Inbox />
                  <span>Reviews</span>
                </Link>
              </SidebarMenuButton>
              {pendingCount > 0 && (
                <SidebarMenuBadge className="bg-amber-100 text-amber-800">
                  {pendingCount}
                </SidebarMenuBadge>
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
