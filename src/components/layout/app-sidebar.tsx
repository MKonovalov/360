'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser, SignOutButton } from '@clerk/nextjs';
import { Building2, Inbox, LayoutDashboard, Mail, PanelLeftClose, PanelLeftOpen, Settings, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getActiveNavKey } from '@/lib/nav';
import { getUserDisplayName, getUserInitials } from '@/lib/user';
import { getCollapseToggleLabel, getNavTooltipLabel } from '@/lib/sidebar-collapse';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  useSidebar,
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

  // The collapse button drives the ONE shared open state — the same toggle the
  // vendored ⌘B handler and the topbar trigger call. The sidebar_state cookie
  // write lives inside the vendored setter and stays byte-identical, so the
  // button is just another caller (D-06), not a new state machine.
  const { state, toggleSidebar } = useSidebar();

  // The identity hook returns a three-branch discriminated union: before
  // isLoaded the server frame and first hydrate tick must render the identical
  // empty user zone (no hydration mismatch, no blank flash). The route is
  // server-gated by requireStaffAccess so isSignedIn is true after load, but
  // the guards are still mandatory for TS narrowing.
  const { isLoaded, isSignedIn, user } = useUser();

  // The vendored tooltip provider is defined but never mounted anywhere in the
  // app, so unmounted Radix tooltips would run at the ~700ms default; this
  // mount sets the short ~200ms delay (D-09) and is usage of the vendored
  // export — not an edit (the provider file stays untouched).
  return (
    <TooltipProvider delayDuration={200}>
      {/* The vendored sidebar's outer wrapper only carries the icon-collapse
          data attribute when this prop is set AND the state is collapsed,
          which is what arms every pre-wired collapsed-rail selector from
          Phases 11-12. Hardcoding here keeps the change in this file — the
          shell layout stays frozen. */}
      <Sidebar collapsible="icon">
        <SidebarHeader className="gap-1 p-2">
          <div className="flex justify-end">
            {/* Manual Tooltip pair: the collapse button is a plain Button, not
                a menu button, so the vendored tooltip prop does not apply —
                and per D-02 this tooltip shows in BOTH states (no hidden gate). */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={state === 'collapsed' ? 'Expand sidebar' : 'Collapse sidebar'}
                  onClick={toggleSidebar}
                  className="text-sidebar-foreground"
                >
                  {state === 'collapsed' ? <PanelLeftOpen /> : <PanelLeftClose />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{getCollapseToggleLabel(state)}</TooltipContent>
            </Tooltip>
          </div>
          <div className="flex flex-col gap-1">
            {/* D-11 letter-mark — 28px, token-only colors (12.63:1 contrast).
                Hidden from assistive tech because the faded wordmark below
                stays in the accessibility tree — the mark is decorative (A3). */}
            <div
              aria-hidden="true"
              className="hidden size-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground text-[13px] font-semibold group-data-[collapsible=icon]:flex"
            >
              A
            </div>
            {/* Q4 wordmark block — class list VERBATIM from Phase 12 (do not edit) */}
            <div className="group-data-[collapsible=icon]:opacity-0 transition-opacity duration-200 flex items-center gap-2">
              <img
                src="/arclumen-avatar-linen.png"
                alt="ArcLumen"
                className="size-8 rounded-full object-cover"
              />
              <div className="flex flex-col gap-1">
                <p className="text-[15px] font-semibold text-sidebar-foreground">ArcLumen 360</p>
                <p className="text-xs font-normal text-sidebar-foreground/70">ArcLumen Partners</p>
              </div>
            </div>
          </div>
        </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          {/* Group labels are non-interactive; pointer-events-none keeps the
              opacity-0 label box in the collapsed rail from swallowing clicks
              meant for the nav icons beneath it. */}
          <SidebarGroupLabel className="pointer-events-none text-[13px] font-semibold">Explore</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={activeKey === 'start'}
                tooltip={getNavTooltipLabel('start', pendingCount)}
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
                tooltip={getNavTooltipLabel('companies', pendingCount)}
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
                tooltip={getNavTooltipLabel('personas', pendingCount)}
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
          <SidebarGroupLabel className="pointer-events-none text-[13px] font-semibold">Manage</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={activeKey === 'reviews'}
                tooltip={getNavTooltipLabel('reviews', pendingCount)}
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
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={activeKey === 'settings'}
                tooltip={getNavTooltipLabel('settings', pendingCount)}
                className="h-[30px] p-0 px-2 gap-2.5 rounded-[4px] text-[15px] font-normal"
              >
                <Link href="/settings">
                  <Settings />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Give us feedback"
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
                    tooltip={getUserDisplayName(user)}
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
    </TooltipProvider>
  );
}
