'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser, SignOutButton } from '@clerk/nextjs';
import { Building2, Inbox, LayoutDashboard, Mail, Users } from 'lucide-react';
import { getActiveNavKey } from '@/lib/nav';
import { getUserDisplayName, getUserInitials } from '@/lib/user';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
  SidebarSeparator,
} from '@/components/ui/sidebar';

// Active-key detection comes from the tested getActiveNavKey pure function
// (src/lib/nav.ts, 11-case Vitest suite) — it locks the /companies/[id] detail
// highlight and the /companies-archive sibling-prefix guard so a drive-by
// "simplification" can never silently break the v1.1 active treatment.
//
// pendingCount is threaded from the server shell (app-shell-layout.tsx) — a
// client component cannot query the DB itself (09-03: Reviews sidebar badge,
// UI-SPEC §4). Shown only when > 0; an empty queue earns no visual noise.
// The feedback destination is locked (D2) and shipped as a static module-level
// constant so it can never be user-interpolated into a URL or mail header
// (ASVS V5) — a future edit that parameterizes it must be flagged in review.
const FEEDBACK_MAILTO = 'mailto:hello@arclumenpartners.com?subject=360%20sidebar%20feedback';

export function AppSidebar({ pendingCount = 0 }: { pendingCount?: number }) {
  const pathname = usePathname();
  const activeKey = getActiveNavKey(pathname);

  // The identity hook returns a three-branch discriminated union: before
  // isLoaded the server frame and first hydrate tick must render the identical
  // empty user zone (no hydration mismatch, no blank flash). The route is
  // server-gated by requireStaffAccess so isSignedIn is true after load, but
  // the guards are still mandatory for TS narrowing.
  const { isLoaded, isSignedIn, user } = useUser();

  return (
    <Sidebar>
      <SidebarHeader className="gap-1 p-3">
        <div className="group-data-[collapsible=icon]:opacity-0 transition-opacity duration-200">
          <p className="text-[15px] font-semibold text-sidebar-foreground">ArcLumen 360</p>
          <p className="text-xs font-normal text-sidebar-foreground/70">ArcLumen Partners</p>
        </div>
      </SidebarHeader>
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
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="h-9 rounded-[6px] border border-sidebar-border text-[14px] font-normal"
            >
              <a href={FEEDBACK_MAILTO} aria-label="Give us feedback">
                <span className="group-data-[collapsible=icon]:hidden">Give us feedback</span>
                <Mail
                  aria-hidden="true"
                  className="hidden group-data-[collapsible=icon]:block size-4"
                />
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarSeparator />
        {isLoaded && isSignedIn && user && (
          <SidebarMenu>
            <SidebarMenuItem>
              {/* The dropdown content portals to document.body, outside the
                  sidebar subtree, so scoped sidebar tokens do not resolve
                  there — the menu intentionally uses global popover tokens
                  (D4: correct by design, not a token leak). */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    aria-label={getUserDisplayName(user)}
                    className="gap-2.5 group-data-[collapsible=icon]:justify-center"
                  >
                    {user.hasImage ? (
                      <img src={user.imageUrl} alt="" className="size-6 rounded-full" />
                    ) : (
                      <span className="flex size-6 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground text-[10px] font-semibold">
                        {getUserInitials(user)}
                      </span>
                    )}
                    <span className="group-data-[collapsible=icon]:hidden text-[15px] font-normal text-sidebar-foreground">
                      {getUserDisplayName(user)}
                    </span>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-56">
                  <DropdownMenuLabel className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-semibold">{getUserDisplayName(user)}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      Signed in as {user.primaryEmailAddress?.emailAddress}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <SignOutButton redirectUrl="/sign-in">Sign out</SignOutButton>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
