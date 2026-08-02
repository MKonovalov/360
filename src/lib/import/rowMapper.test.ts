import { describe, it, expect } from 'vitest';
import { mapCompanyRowToUpsertInput, mapPersonaRowToUpsertInput } from './rowMapper';
import type { CompanyRow, PersonaRow } from '@/lib/validation/seed';

describe('mapCompanyRowToUpsertInput', () => {
  it('renames every snake_case field to camelCase correctly', () => {
    const row: CompanyRow = {
      name: 'Acme Corp',
      domain: 'acme.com',
      industry: 'Manufacturing',
      employee_count_band: '201-1000',
      hq_location: 'Chicago, USA',
      revenue_band: '50m_250m',
      ownership_type: 'private',
      tech_stack: 'SAP ERP|Excel',
    };

    const result = mapCompanyRowToUpsertInput(row);

    expect(result.name).toBe('Acme Corp');
    expect(result.domain).toBe('acme.com');
    expect(result.industry).toBe('Manufacturing');
    expect(result.employeeCountBand).toBe('201-1000');
    expect(result.hqLocation).toBe('Chicago, USA');
    expect(result.revenueBand).toBe('50m_250m');
    expect(result.ownershipType).toBe('private');
  });

  it('splits pipe-delimited tech_stack into an array', () => {
    const row: CompanyRow = {
      name: 'TechCo',
      domain: undefined,
      industry: undefined,
      employee_count_band: undefined,
      hq_location: undefined,
      tech_stack: 'React|Node|AWS',
    };

    const result = mapCompanyRowToUpsertInput(row);

    expect(result.techStack).toEqual(['React', 'Node', 'AWS']);
  });

  it('trims whitespace from each tech_stack segment', () => {
    const row: CompanyRow = {
      name: 'TechCo',
      domain: undefined,
      industry: undefined,
      employee_count_band: undefined,
      hq_location: undefined,
      tech_stack: ' React | Node | AWS ',
    };

    const result = mapCompanyRowToUpsertInput(row);

    expect(result.techStack).toEqual(['React', 'Node', 'AWS']);
  });

  it('filters out blank segments from tech_stack', () => {
    const row: CompanyRow = {
      name: 'TechCo',
      domain: undefined,
      industry: undefined,
      employee_count_band: undefined,
      hq_location: undefined,
      tech_stack: 'React||AWS',
    };

    const result = mapCompanyRowToUpsertInput(row);

    expect(result.techStack).toEqual(['React', 'AWS']);
  });

  it('returns techStack: undefined when tech_stack is undefined', () => {
    const row: CompanyRow = {
      name: 'Acme Corp',
      domain: undefined,
      industry: undefined,
      employee_count_band: undefined,
      hq_location: undefined,
      tech_stack: undefined,
    };

    const result = mapCompanyRowToUpsertInput(row);

    // Must be undefined — never an empty array or the original string
    expect(result.techStack).toBeUndefined();
  });

  it('returns techStack: undefined when tech_stack is blank (empty string after transform)', () => {
    // optionalSafeCsvString transforms '' → undefined, so this arrives as undefined
    const row: CompanyRow = {
      name: 'Acme Corp',
      domain: undefined,
      industry: undefined,
      employee_count_band: undefined,
      hq_location: undefined,
      tech_stack: undefined,
    };

    const result = mapCompanyRowToUpsertInput(row);

    expect(result.techStack).toBeUndefined();
    expect(Array.isArray(result.techStack)).toBe(false);
  });

  it('maps a single tech_stack entry (no pipe) to a one-element array', () => {
    const row: CompanyRow = {
      name: 'TechCo',
      domain: undefined,
      industry: undefined,
      employee_count_band: undefined,
      hq_location: undefined,
      tech_stack: 'SAP ERP',
    };

    const result = mapCompanyRowToUpsertInput(row);

    expect(result.techStack).toEqual(['SAP ERP']);
  });

  it('passes through undefined optional fields as undefined', () => {
    const row: CompanyRow = {
      name: 'Minimal Co',
      domain: undefined,
      industry: undefined,
      employee_count_band: undefined,
      hq_location: undefined,
      tech_stack: undefined,
    };

    const result = mapCompanyRowToUpsertInput(row);

    expect(result.name).toBe('Minimal Co');
    expect(result.domain).toBeUndefined();
    expect(result.industry).toBeUndefined();
    expect(result.employeeCountBand).toBeUndefined();
    expect(result.hqLocation).toBeUndefined();
    expect(result.revenueBand).toBeUndefined();
    expect(result.ownershipType).toBeUndefined();
    expect(result.techStack).toBeUndefined();
  });
});

describe('mapPersonaRowToUpsertInput', () => {
  it('renames linkedin_url to linkedinUrl', () => {
    const row: PersonaRow = {
      name: 'Jane Smith',
      title: 'VP of Finance',
      seniority: 'vp',
      email: 'jane.smith@acme.com',
      linkedin_url: 'https://linkedin.com/in/janesmith',
    };

    const result = mapPersonaRowToUpsertInput(row);

    expect(result.linkedinUrl).toBe('https://linkedin.com/in/janesmith');
  });

  it('maps all snake_case fields to camelCase correctly', () => {
    const row: PersonaRow = {
      name: 'Jane Smith',
      title: 'VP of Finance',
      seniority: 'vp',
      email: 'jane.smith@acme.com',
      linkedin_url: 'https://linkedin.com/in/janesmith',
    };

    const result = mapPersonaRowToUpsertInput(row);

    expect(result.name).toBe('Jane Smith');
    expect(result.title).toBe('VP of Finance');
    expect(result.seniority).toBe('vp');
    expect(result.email).toBe('jane.smith@acme.com');
    expect(result.linkedinUrl).toBe('https://linkedin.com/in/janesmith');
  });

  it('passes through undefined optional fields as undefined', () => {
    const row: PersonaRow = {
      name: 'Minimal Person',
      title: undefined,
      linkedin_url: undefined,
    };

    const result = mapPersonaRowToUpsertInput(row);

    expect(result.name).toBe('Minimal Person');
    expect(result.title).toBeUndefined();
    expect(result.seniority).toBeUndefined();
    expect(result.email).toBeUndefined();
    expect(result.linkedinUrl).toBeUndefined();
  });

  it('returns linkedinUrl: undefined when linkedin_url is undefined', () => {
    const row: PersonaRow = {
      name: 'No LinkedIn',
      title: undefined,
      linkedin_url: undefined,
    };

    const result = mapPersonaRowToUpsertInput(row);

    expect(result.linkedinUrl).toBeUndefined();
  });
});
