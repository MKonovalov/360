import { describe, it, expect } from 'vitest';
import { parse } from 'csv-parse/sync';
import { generateCompanyTemplate, generatePersonaTemplate, enumHelpText } from './csvTemplate';
import { revenueBandEnum, ownershipTypeEnum, seniorityEnum } from '@/lib/db/schema';

// csv-parse with columns:true returns unknown[] in strict TS — cast to
// Record<string, string>[] for test assertions (values are all strings in CSV).
function parseRows(csv: string): Record<string, string>[] {
  return parse(csv, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
}

describe('generateCompanyTemplate', () => {
  it('produces valid CSV with correct header order', () => {
    const rows = parseRows(generateCompanyTemplate());
    const headers = Object.keys(rows[0]);
    expect(headers).toEqual([
      'name',
      'domain',
      'industry',
      'employee_count_band',
      'hq_location',
      'revenue_band',
      'ownership_type',
      'tech_stack',
    ]);
  });

  it('has exactly one example data row', () => {
    const rows = parseRows(generateCompanyTemplate());
    expect(rows).toHaveLength(1);
  });

  it('example row revenue_band equals revenueBandEnum.enumValues[0]', () => {
    const rows = parseRows(generateCompanyTemplate());
    expect(rows[0].revenue_band).toBe(revenueBandEnum.enumValues[0]);
  });

  it('example row ownership_type equals ownershipTypeEnum.enumValues[0]', () => {
    const rows = parseRows(generateCompanyTemplate());
    expect(rows[0].ownership_type).toBe(ownershipTypeEnum.enumValues[0]);
  });

  it('example row has non-empty name', () => {
    const rows = parseRows(generateCompanyTemplate());
    expect(rows[0].name).toBeTruthy();
  });

  it('example row has non-empty domain', () => {
    const rows = parseRows(generateCompanyTemplate());
    expect(rows[0].domain).toBeTruthy();
  });

  it('returns a string (not null/undefined)', () => {
    expect(typeof generateCompanyTemplate()).toBe('string');
  });

  it('output is parseable as CSV without errors', () => {
    const csv = generateCompanyTemplate();
    expect(() => parse(csv, { columns: true, skip_empty_lines: true })).not.toThrow();
  });
});

describe('generatePersonaTemplate', () => {
  it('produces valid CSV with correct header order', () => {
    const rows = parseRows(generatePersonaTemplate());
    const headers = Object.keys(rows[0]);
    expect(headers).toEqual([
      'name',
      'title',
      'seniority',
      'email',
      'linkedin_url',
    ]);
  });

  it('has exactly one example data row', () => {
    const rows = parseRows(generatePersonaTemplate());
    expect(rows).toHaveLength(1);
  });

  it('example row seniority equals seniorityEnum.enumValues[0]', () => {
    const rows = parseRows(generatePersonaTemplate());
    expect(rows[0].seniority).toBe(seniorityEnum.enumValues[0]);
  });

  it('example row has non-empty name', () => {
    const rows = parseRows(generatePersonaTemplate());
    expect(rows[0].name).toBeTruthy();
  });

  it('example row has non-empty email', () => {
    const rows = parseRows(generatePersonaTemplate());
    expect(rows[0].email).toBeTruthy();
  });

  it('returns a string (not null/undefined)', () => {
    expect(typeof generatePersonaTemplate()).toBe('string');
  });

  it('output is parseable as CSV without errors', () => {
    const csv = generatePersonaTemplate();
    expect(() => parse(csv, { columns: true, skip_empty_lines: true })).not.toThrow();
  });
});

describe('enumHelpText', () => {
  it('contains every value from revenueBandEnum.enumValues', () => {
    const help = enumHelpText();
    for (const value of revenueBandEnum.enumValues) {
      expect(help.revenue_band).toContain(value);
    }
  });

  it('contains every value from ownershipTypeEnum.enumValues', () => {
    const help = enumHelpText();
    for (const value of ownershipTypeEnum.enumValues) {
      expect(help.ownership_type).toContain(value);
    }
  });

  it('contains every value from seniorityEnum.enumValues', () => {
    const help = enumHelpText();
    for (const value of seniorityEnum.enumValues) {
      expect(help.seniority).toContain(value);
    }
  });

  it('revenue_band help text starts with "Valid values:"', () => {
    const help = enumHelpText();
    expect(help.revenue_band).toMatch(/^Valid values:/);
  });

  it('ownership_type help text starts with "Valid values:"', () => {
    const help = enumHelpText();
    expect(help.ownership_type).toMatch(/^Valid values:/);
  });

  it('seniority help text starts with "Valid values:"', () => {
    const help = enumHelpText();
    expect(help.seniority).toMatch(/^Valid values:/);
  });

  it('returns an object with exactly the three expected keys', () => {
    const help = enumHelpText();
    expect(Object.keys(help).sort()).toEqual(['ownership_type', 'revenue_band', 'seniority']);
  });

  it('revenue_band lists all 5 enum values', () => {
    const help = enumHelpText();
    // revenueBandEnum has 5 values: under_50m, 50m_250m, 250m_1b, 1b_5b, 5b_plus
    expect(revenueBandEnum.enumValues).toHaveLength(5);
    for (const v of revenueBandEnum.enumValues) {
      expect(help.revenue_band).toContain(v);
    }
  });

  it('ownership_type lists all 7 enum values in canonical order', () => {
    const help = enumHelpText();
    expect(ownershipTypeEnum.enumValues).toEqual([
      'public',
      'private',
      'family_owned',
      'pe_backed',
      'cooperative',
      'state_owned',
      'subsidiary',
    ]);
    expect(ownershipTypeEnum.enumValues).toHaveLength(7);
    for (const v of ownershipTypeEnum.enumValues) {
      expect(help.ownership_type).toContain(v);
    }
  });

  it('seniority lists all 5 enum values', () => {
    const help = enumHelpText();
    // seniorityEnum has 5 values: ic, manager, director, vp, c_level
    expect(seniorityEnum.enumValues).toHaveLength(5);
    for (const v of seniorityEnum.enumValues) {
      expect(help.seniority).toContain(v);
    }
  });
});
