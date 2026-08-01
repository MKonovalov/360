'use client';

import Link from 'next/link';
import { ChevronDownIcon, EllipsisVerticalIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Shared Menu dropdown reused by both the list-page (labeled, top-right of
// Companies/Personas) and detail-panel (icon, top-right of the expanded row)
// placements — MENU-01/MENU-02's one-time shared investment (D-08/D-09).
export function ExplorerMenu({
  variant,
  items,
}: {
  variant: 'labeled' | 'icon';
  items: { label: string; disabled?: boolean; href?: string }[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === 'labeled' ? (
          <Button variant="outline">
            Menu
            <ChevronDownIcon className="size-4" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" aria-label="Menu">
            <EllipsisVerticalIcon />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item) =>
          item.href && !item.disabled ? (
            <DropdownMenuItem key={item.label} asChild>
              <Link href={item.href}>{item.label}</Link>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={item.label} disabled={item.disabled}>
              {item.label}
            </DropdownMenuItem>
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
