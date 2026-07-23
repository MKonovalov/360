import Link from 'next/link';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

// Server Component: this phase has exactly one navigable section
// (Companies), so "active" is hardcoded rather than computed from
// usePathname() — avoids an unnecessary client boundary for a decision
// that's currently static. Revisit with real pathname matching once
// Phase 3's /personas route exists alongside this one.
export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive
                className="data-active:bg-indigo-50 data-active:text-indigo-600 data-active:hover:bg-indigo-50 data-active:hover:text-indigo-600"
              >
                <Link href="/companies">Companies</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              {/* D-11: visible-but-disabled, no href — Phase 3 hasn't
                  shipped the Personas explorer route yet. */}
              <SidebarMenuButton disabled>Key Personas</SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
