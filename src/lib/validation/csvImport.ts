import { z } from 'zod';

export interface RowResult<T> {
  validRows: { row: number; data: T }[];
  invalidRows: { row: number; errors: string[] }[];
}

// CSV row 1 is the header; data rows start at row 2 — mirrors seed.ts's
// validateRows numbering convention exactly, so error messages/UI stay
// consistent between the CLI seed tool and the Import wizard.
export function partitionRows<T extends z.ZodTypeAny>(
  rows: Record<string, string>[],
  schema: T
): RowResult<z.infer<T>> {
  const validRows: { row: number; data: z.infer<T> }[] = [];
  const invalidRows: { row: number; errors: string[] }[] = [];

  rows.forEach((row, index) => {
    const result = schema.safeParse(row);
    if (result.success) {
      validRows.push({ row: index + 2, data: result.data });
    } else {
      invalidRows.push({
        row: index + 2,
        errors: result.error.issues.map(
          (issue) => `${issue.path.join('.')}: ${issue.message}`
        ),
      });
    }
  });

  return { validRows, invalidRows };
}
