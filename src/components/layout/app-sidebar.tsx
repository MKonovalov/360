'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

// Client Component: both Companies and Key Personas are now real routes, so
// "active" is computed from usePathname() rather than hardcoded (03-RESEARCH.md
// Pattern 5). .startsWith(), not exact equality, so /companies/[id] and
// /personas/[id] (added in Plan 03-03) both still highlight the correct
// single item (03-RESEARCH.md Pitfall 3).
export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
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
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
