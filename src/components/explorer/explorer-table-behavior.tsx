'use client';

import * as React from 'react';
import { useQueryState, parseAsInteger } from 'nuqs';
import { XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

// The only hook in the codebase that opts into push-style browser history —
// every existing filter hook (search/industry/signal/etc.) stays on nuqs's
// default 'replace' so this accordion-expand state, and only this state, is
// back-button-safe (LAYT-03; 05-RESEARCH.md Pitfall 1).
export function useSelectedRow() {
  return useQueryState(
    'selected',
    parseAsInteger.withOptions({ shallow: false, history: 'push', scroll: false })
  );
}

export function ExplorerTableBehavior({
  selectedId,
  children,
}: {
  selectedId?: number;
  children: React.ReactNode;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [, setSelected] = useSelectedRow();

  // Scroll the expanded row to the top of the viewport (D-06). Keyed only on
  // the primitive selectedId — never on `children` — so this does not
  // re-fire (and jar-scroll the page) on every unrelated filter/search
  // re-render (05-RESEARCH.md Pitfall 3).
  React.useEffect(() => {
    if (selectedId == null || !containerRef.current) return;
    containerRef.current
      .querySelector<HTMLElement>('[data-row-id="' + selectedId + '"]')
      ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    // Deliberately do NOT move focus into the detail panel here — keeping
    // focus on the row preserves ArrowUp/ArrowDown continuity for LAYT-05.
  }, [selectedId]);

  // Event delegation over the server-rendered <tr> children, since those
  // rows can never carry their own event handler props (Server Components).
  // Attached once (deps []); uses nuqs's functional-updater form so the
  // live `selected` value is read at call time, never a stale mount-time
  // closure (row-click re-toggle would otherwise use a stale comparison).
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (event: MouseEvent) => {
      const rowEl = (event.target as HTMLElement).closest('[data-row-id]');
      if (!rowEl) return;
      const id = Number(rowEl.getAttribute('data-row-id'));
      setSelected((old) => (id === old ? null : id));
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // The container wraps both the row list AND the expanded detail
      // panel (which can contain focusable links, e.g. Arcpedia articles).
      // If focus is inside the detail panel rather than on a row, no-op
      // entirely — never hijack focus away from a link the user is
      // activating normally.
      const activeRowEl = (document.activeElement as HTMLElement | null)?.closest(
        '[data-row-id]'
      );
      if (!activeRowEl) return;

      if (event.key === 'Enter') {
        const id = Number(activeRowEl.getAttribute('data-row-id'));
        setSelected((old) => (id === old ? null : id));
        event.preventDefault();
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const rowEls = Array.from(
          container.querySelectorAll<HTMLElement>('[data-row-id]')
        );
        const currentIndex = rowEls.indexOf(activeRowEl as HTMLElement);
        const nextIndex =
          event.key === 'ArrowDown'
            ? Math.min(currentIndex + 1, rowEls.length - 1)
            : Math.max(currentIndex - 1, 0);
        const nextRowEl = rowEls[nextIndex];
        if (!nextRowEl || nextRowEl === activeRowEl) return;

        (activeRowEl as HTMLElement).tabIndex = -1;
        nextRowEl.tabIndex = 0;
        nextRowEl.focus();
      }
    };

    container.addEventListener('click', handleClick);
    container.addEventListener('keydown', handleKeyDown);
    return () => {
      container.removeEventListener('click', handleClick);
      container.removeEventListener('keydown', handleKeyDown);
    };
    // Attached once; setSelected is read live via the functional-updater
    // form above, not closed over for its return value, so it does not
    // need to be a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef}>{children}</div>;
}

// Dedicated close control (D-05) — placed top-right of the expanded detail
// panel by the caller, which must wrap it in a relative-positioned parent.
export function ExplorerCloseButton() {
  const [, setSelected] = useSelectedRow();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="absolute top-3 right-3"
      aria-label="Close"
      onClick={() => setSelected(null)}
    >
      <XIcon />
    </Button>
  );
}
