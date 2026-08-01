import { describe, it, expect } from 'vitest';
import { partitionRows } from './csvImport';
import { companyRowSchema } from './seed';

describe('partitionRows', () => {
  it('splits valid and invalid rows with correct row numbers', () => {
    const rows = [{ name: 'Acme' }, { name: '' }];
    const result = partitionRows(rows, companyRowSchema);

    // First row (index 0) → row 2, valid
    expect(result.validRows).toHaveLength(1);
    expect(result.validRows[0].row).toBe(2);
    expect(result.validRows[0].data.name).toBe('Acme');

    // Second row (index 1) → row 3, invalid (empty name)
    expect(result.invalidRows).toHaveLength(1);
    expect(result.invalidRows[0].row).toBe(3);
    expect(result.invalidRows[0].errors.length).toBeGreaterThan(0);
    expect(result.invalidRows[0].errors.some((e) => e.includes('name'))).toBe(true);
  });

  it('never throws even when every row is invalid', () => {
    const rows = [{ name: '' }, { name: '' }, { name: '' }];
    expect(() => partitionRows(rows, companyRowSchema)).not.toThrow();
    const result = partitionRows(rows, companyRowSchema);
    expect(result.invalidRows).toHaveLength(3);
    expect(result.validRows).toHaveLength(0);
  });

  it('each invalidRows entry errors array contains human-readable strings', () => {
    const rows = [{ name: '' }];
    const result = partitionRows(rows, companyRowSchema);
    expect(result.invalidRows).toHaveLength(1);
    const errors = result.invalidRows[0].errors;
    expect(errors.length).toBeGreaterThan(0);
    errors.forEach((e) => {
      expect(typeof e).toBe('string');
      expect(e.length).toBeGreaterThan(0);
      // Each error is "path: message" format
      expect(e).toMatch(/^[^:]+: .+/);
    });
  });

  it('fully-valid multi-row input produces zero invalidRows', () => {
    const rows: Record<string, string>[] = [
      { name: 'Acme Corp' },
      { name: 'Beta Ltd', domain: 'beta.com' },
      { name: 'Gamma Inc', industry: 'Tech' },
    ];
    const result = partitionRows(rows, companyRowSchema);
    expect(result.invalidRows).toHaveLength(0);
    expect(result.validRows).toHaveLength(3);
  });

  it('mixed valid/invalid input produces correct row numbers for both', () => {
    const rows = [
      { name: 'Valid One' },   // index 0 → row 2, valid
      { name: '' },            // index 1 → row 3, invalid
      { name: 'Valid Two' },   // index 2 → row 4, valid
      { name: '' },            // index 3 → row 5, invalid
    ];
    const result = partitionRows(rows, companyRowSchema);

    expect(result.validRows).toHaveLength(2);
    expect(result.validRows[0].row).toBe(2);
    expect(result.validRows[1].row).toBe(4);

    expect(result.invalidRows).toHaveLength(2);
    expect(result.invalidRows[0].row).toBe(3);
    expect(result.invalidRows[1].row).toBe(5);
  });
});
