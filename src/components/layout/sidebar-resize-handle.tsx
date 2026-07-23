'use client';

import { useCallback, useRef } from 'react';

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
      className="hidden w-1 shrink-0 cursor-col-resize touch-none bg-transparent hover:bg-indigo-200 md:block"
    />
  );
}
