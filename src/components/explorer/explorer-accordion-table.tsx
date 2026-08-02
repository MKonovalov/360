import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

// Entity-agnostic accordion table shell shared by /companies and /personas
// (Phase 5 goal: "built on one shared component instead of duplicated
// per-page markup"). This is a Server Component — no event handlers here;
// click/keydown delegation lives entirely in explorer-table-behavior.tsx's
// client wrapper, since Server Components cannot attach DOM event handler
// props to host elements. Only the row matching `selectedId` ever renders a
// detail row (05-RESEARCH.md Pitfall 4 — never pre-fetch/render for the rest).
export function ExplorerAccordionTable<T>({
  columnLabels,
  rows,
  getRowId,
  selectedId,
  renderRowCells,
  renderDetail,
}: {
  columnLabels: string[];
  rows: T[];
  getRowId: (row: T) => number;
  selectedId?: number;
  renderRowCells: (row: T, isExpanded: boolean) => React.ReactNode;
  renderDetail: (row: T) => React.ReactNode;
}) {
  return (
    <div className="[container-type:inline-size]">
      <Table>
        <TableHeader>
          <TableRow
            className={cn(
              // D-07 mobile pattern (CR-01 fix): once a row is expanded, the
              // detail lives inside this same <Table> (not a separate pane),
              // so only non-expanded siblings — including the header row —
              // hide on mobile, never the whole table.
              selectedId != null && 'hidden md:table-row'
            )}
          >
            {columnLabels.map((label) => (
              <TableHead key={label}>{label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const rowId = getRowId(row);
            const isExpanded = rowId === selectedId;

            return (
              <React.Fragment key={rowId}>
                <TableRow
                  data-row-id={rowId}
                  aria-expanded={isExpanded}
                  tabIndex={
                    isExpanded || (selectedId == null && rows.length > 0 && rowId === getRowId(rows[0])) ? 0 : -1
                  }
                  className={cn(
                    'min-h-12 cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-inset',
                    // Accent (indigo-600) expanded-row indicator, reused verbatim
                    // from company-list.tsx's pre-Phase-5 "selected" accent class.
                    isExpanded && 'border-l-2 border-l-indigo-600 bg-indigo-50/50',
                    // CR-01: hide only non-expanded rows on mobile once
                    // something is selected — the expanded row (which contains
                    // the detail) stays visible.
                    selectedId != null && !isExpanded && 'hidden md:table-row'
                  )}
                >
                  {renderRowCells(row, isExpanded)}
                </TableRow>
                {isExpanded && (
                  <TableRow>
                    <TableCell
                      colSpan={columnLabels.length}
                      className="border-t border-slate-200 p-0 whitespace-normal"
                    >
                      <div className="sticky left-0 w-[100cqw] max-w-[100cqw]">
                        {renderDetail(row)}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
