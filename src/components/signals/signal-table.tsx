import { SignalForm, SignalFormSignal } from './signal-form';
import { ArchiveSignalDialog } from './archive-signal-dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { dateFormatter } from '@/components/explorer/explorer-format';
import { humanizeEnum } from '@/components/explorer/explorer-format';

export interface CompanySignalRow extends SignalFormSignal {
  updatedAt: Date | string;
}

export interface PersonaSignalRow extends SignalFormSignal {
  updatedAt: Date | string;
  buyerRoleId: number;
}

export interface SignalTableProps {
  signalKind: 'company' | 'persona';
  rows: Array<CompanySignalRow | PersonaSignalRow>;
  hasActiveFilters: boolean;
  practiceAreas: Array<{ id: number; name: string }>;
  buyerRoles: Array<{ id: number; name: string }>;
  categories: string[];
  activeOfferingsByPracticeAreaId: Record<number, Array<{ id: number; name: string }>>;
  offeringNamesById: Record<number, string>;
  linkedOfferingIdsByRowId: Record<number, number[]>;
}

function resolveName(
  id: number | undefined,
  entities: Array<{ id: number; name: string }>
): string {
  if (id === undefined) return '—';
  const entity = entities.find((e) => e.id === id);
  return entity?.name ?? '—';
}

function formatUpdatedAt(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  return dateFormatter.format(date);
}

export function SignalTable({
  signalKind,
  rows,
  hasActiveFilters,
  practiceAreas,
  buyerRoles,
  categories,
  activeOfferingsByPracticeAreaId,
  offeringNamesById,
  linkedOfferingIdsByRowId,
}: SignalTableProps) {
  const isPersona = signalKind === 'persona';

  if (rows.length === 0) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center">
        {hasActiveFilters ? (
          <>
            <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
              No signals match your filters
            </p>
            <p className="text-sm text-slate-500">
              Try removing a filter or clearing your search.
            </p>
          </>
        ) : isPersona ? (
          <>
            <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
              No Persona Signals yet
            </p>
            <p className="text-sm text-slate-500">
              Signals will appear here once your team starts recording them.{' '}
              <strong>New Persona Signal</strong> to create the first one.
            </p>
          </>
        ) : (
          <>
            <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
              No Company Signals yet
            </p>
            <p className="text-sm text-slate-500">
              Signals will appear here once your team starts recording them.{' '}
              <strong>New Company Signal</strong> to create the first one.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            {isPersona && <TableHead>Buyer Role</TableHead>}
            <TableHead>Practice Area</TableHead>
            <TableHead>Linked Offerings</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last updated</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const linkedIds = linkedOfferingIdsByRowId[row.id] ?? [];
            const isRetired = row.status === 'retired';

            return (
              <TableRow
                key={row.id}
                className={isRetired ? 'opacity-70' : undefined}
              >
                <TableCell className="font-medium text-foreground">
                  {row.name}
                </TableCell>
                <TableCell>{row.category}</TableCell>
                {isPersona && (
                  <TableCell>
                    {resolveName(
                      (row as PersonaSignalRow).buyerRoleId,
                      buyerRoles
                    )}
                  </TableCell>
                )}
                <TableCell>
                  {resolveName(row.practiceAreaId, practiceAreas)}
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {linkedIds.length}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={isRetired ? 'secondary' : 'outline'}>
                    {humanizeEnum(row.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatUpdatedAt(row.updatedAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <SignalForm
                      signalKind={signalKind}
                      mode="edit"
                      signal={row}
                      existingLinkedOfferingIds={linkedIds}
                      practiceAreas={practiceAreas}
                      buyerRoles={buyerRoles}
                      categories={categories}
                      activeOfferingsByPracticeAreaId={
                        activeOfferingsByPracticeAreaId
                      }
                      trigger={
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                      }
                    />
                    <ArchiveSignalDialog
                      signalKind={signalKind}
                      signalId={row.id}
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
