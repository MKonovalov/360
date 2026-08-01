import { describe, it, expect } from 'vitest';
import {
  apolloMapCompany,
  bucketRevenue,
  bucketEmployees,
  parsePrintedRevenue,
  mapSeniority,
} from './apolloMap';

describe('bucketRevenue', () => {
  it('buckets across all enum boundaries', () => {
    expect(bucketRevenue(10_000_000)).toBe('under_50m');
    expect(bucketRevenue(49_999_999)).toBe('under_50m');
    expect(bucketRevenue(50_000_000)).toBe('50m_250m');
    expect(bucketRevenue(249_999_999)).toBe('50m_250m');
    expect(bucketRevenue(250_000_000)).toBe('250m_1b');
    expect(bucketRevenue(1_000_000_000)).toBe('1b_5b');
    expect(bucketRevenue(5_000_000_000)).toBe('5b_plus');
    expect(bucketRevenue(0)).toBeUndefined();
    expect(bucketRevenue(-5)).toBeUndefined();
  });
});

describe('parsePrintedRevenue', () => {
  it('parses suffixed and plain strings', () => {
    expect(parsePrintedRevenue('$1.2B')).toBe(1_200_000_000);
    expect(parsePrintedRevenue('450M')).toBe(450_000_000);
    expect(parsePrintedRevenue('12,000,000')).toBe(12_000_000);
    expect(parsePrintedRevenue('3k')).toBe(3_000);
    expect(parsePrintedRevenue('n/a')).toBeUndefined();
  });
});

describe('bucketEmployees', () => {
  it('derives band text from an int', () => {
    expect(bucketEmployees(5)).toBe('1-10');
    expect(bucketEmployees(150)).toBe('51-200');
    expect(bucketEmployees(12000)).toBe('10000+');
    expect(bucketEmployees(0)).toBeUndefined();
  });
});

describe('mapSeniority', () => {
  it('maps Apollo seniority onto seniorityEnum, c_suite→c_level', () => {
    expect(mapSeniority('c_suite')).toBe('c_level');
    expect(mapSeniority('cxo')).toBe('c_level');
    expect(mapSeniority('owner')).toBe('c_level');
    expect(mapSeniority('vp')).toBe('vp');
    expect(mapSeniority('director')).toBe('director');
    expect(mapSeniority('manager')).toBe('manager');
    expect(mapSeniority('entry')).toBe('ic');
    expect(mapSeniority('intern')).toBe('ic');
    expect(mapSeniority('galactic_overlord')).toBeUndefined();
  });
});

describe('apolloMapCompany', () => {
  it('maps a full org object and excludes the domain match key', () => {
    const fields = apolloMapCompany({
      primary_domain: 'acme.com',
      domain: 'acme.com',
      industry: 'Manufacturing',
      estimated_num_employees: 150,
      city: 'Berlin',
      state: 'BE',
      country: 'Germany',
      annual_revenue: 300_000_000,
      technology_names: ['React', 'AWS', 'React'],
    });
    const byField = Object.fromEntries(fields.map((f) => [f.field, f.incomingValue]));
    expect(byField.industry).toBe('Manufacturing');
    expect(byField.employeeCountBand).toBe('51-200');
    expect(byField.hqLocation).toBe('Berlin, BE, Germany');
    expect(byField.revenueBand).toBe('250m_1b');
    expect(byField.techStack).toEqual(['React', 'AWS']); // deduped
    expect(byField.domain).toBeUndefined(); // match key never mapped
  });

  it('dedupes current_technologies[].name into techStack', () => {
    const fields = apolloMapCompany({
      current_technologies: [{ name: 'Salesforce' }, { name: 'Salesforce' }, { name: 'Okta' }],
    });
    const tech = fields.find((f) => f.field === 'techStack');
    expect(tech?.incomingValue).toEqual(['Salesforce', 'Okta']);
  });

  it('caps large Apollo technology lists at the review contract maximum', () => {
    const fields = apolloMapCompany({
      technology_names: Array.from({ length: 101 }, (_, index) => `Technology ${index}`),
    });
    const tech = fields.find((f) => f.field === 'techStack');
    expect(tech?.incomingValue).toHaveLength(100);
  });

  it('omits empty/missing fields and never throws on junk input', () => {
    expect(apolloMapCompany({ industry: '   ' })).toEqual([]);
    expect(apolloMapCompany(null)).toEqual([]);
    expect(apolloMapCompany(undefined)).toEqual([]);
    expect(apolloMapCompany(42)).toEqual([]);
  });

  it('confidence is always undefined for Apollo (no score exposed)', () => {
    const fields = apolloMapCompany({ industry: 'Tech' });
    expect(fields[0].confidence).toBeUndefined();
  });
});
