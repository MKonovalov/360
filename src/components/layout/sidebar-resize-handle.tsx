'use client';

import { useCallback, useRef } from 'react';
import { useSidebar } from '@/components/ui/sidebar';

const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
const COOKIE_NAME = 'sidebar_width';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

// A thin drag handle at the sidebar's right edge. Writes the live width
// directly to the --sidebar-width CSS custom property via
// style.setProperty during drag (imperative DOM write, not React state
// per pixel) to avoid re-render jank on every pointermove — only the
// final width on pointerup gets persisted, into a sidebar_width cookie
// alongside (not replacing) shadcn's own sidebar_state collapse cookie.
export function SidebarResizeHandle() {
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const wrapperRef = useRef<HTMLElement | null>(null);
  const { state } = useSidebar();

  const handlePointerMove = useCallback((event: PointerEvent) => {
    const delta = event.clientX - startXRef.current;
    const nextWidth = Math.min(
      MAX_WIDTH,
      Math.max(MIN_WIDTH, startWidthRef.current + delta)
    );
    wrapperRef.current?.style.setProperty('--sidebar-width', `${nextWidth}px`);
  }, []);

  const handlePointerUp = useCallback(
    (event: PointerEvent) => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);

      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const currentWidth = parseInt(
        getComputedStyle(wrapper).getPropertyValue('--sidebar-width'),
        10
      );
      const finalWidth = Number.isNaN(currentWidth)
        ? startWidthRef.current
        : Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, currentWidth));

      document.cookie = `${COOKIE_NAME}=${finalWidth}; path=/; max-age=${COOKIE_MAX_AGE}`;
      void event;
    },
    [handlePointerMove]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const wrapper = event.currentTarget.closest<HTMLElement>(
        '[data-slot="sidebar-wrapper"]'
      );
      if (!wrapper) return;

      wrapperRef.current = wrapper;
      startXRef.current = event.clientX;
      const computedWidth = parseInt(
        getComputedStyle(wrapper).getPropertyValue('--sidebar-width'),
        10
      );
      startWidthRef.current = Number.isNaN(computedWidth) ? 256 : computedWidth;

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    },
    [handlePointerMove, handlePointerUp]
  );

  // The 48px rail is fixed-width with no resize affordance, so the handle
  // must not render — and crucially its imperative width write must never run
  // mid-collapse, because the cookie-threaded width variable must stay at its
  // last persisted value for the automatic restore on expand (D-04 / D-05).
  // Placed after every hook (the callbacks are hooks too) so the hook count
  // never varies between expanded and collapsed renders.
  if (state === 'collapsed') return null;

  return (
    // A plain flex-item sibling (not absolutely positioned) — the
    // SidebarProvider wrapper is a flex row with default
    // align-items: stretch, so this 4px strip naturally sits at the
    // exact boundary between <Sidebar> (whose in-flow "gap" div
    // reserves --sidebar-width) and <SidebarInset>, stretched to the
    // full sidebar height with no extra layout math needed.
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      onPointerDown={handlePointerDown}
      // Flex sibling of <Sidebar>, outside the [data-sidebar="sidebar"] subtree,
      // so scoped sidebar tokens do not resolve here. The foreground token at
      // 10% opacity derives a neutral light-gray hover from global tokens,
      // replacing the v1.1 colored hover (QLTY-04).
      className="hidden w-1 shrink-0 cursor-col-resize touch-none bg-transparent hover:bg-foreground/10 md:block"
    />
  );
}
