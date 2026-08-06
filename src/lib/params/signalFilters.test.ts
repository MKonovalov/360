import { describe, it, expect } from 'vitest';
import { firstValue, parseSignalFilters } from './signalFilters';

describe('firstValue', () => {
  it("returns the first element of an array", () => {
    expect(firstValue(['a', 'b'])).toBe('a');
  });

  it("returns a bare string unchanged", () => {
    expect(firstValue('a')).toBe('a');
  });

  it("returns undefined for undefined input", () => {
    expect(firstValue(undefined)).toBeUndefined();
  });
});

describe('parseSignalFilters', () => {
  it("returns all-undefined for empty params", () => {
    expect(parseSignalFilters({})).toEqual({
      search: undefined,
      practiceAreaId: undefined,
      category: undefined,
      status: undefined,
    });
  });

  it("coerces a numeric practiceArea string to a number", () => {
    expect(parseSignalFilters({ practiceArea: '3' }).practiceAreaId).toBe(3);
  });

  it("returns practiceAreaId undefined for a non-numeric practiceArea param (NaN guard)", () => {
    // A malformed param must never leak a NaN into the returned object.
    expect(parseSignalFilters({ practiceArea: 'abc' }).practiceAreaId).toBeUndefined();
  });

  it("passes category, status, and search through as strings unmodified", () => {
    expect(parseSignalFilters({ category: 'GBS-state', status: 'active', search: 'CFO' })).toEqual({
      search: 'CFO',
      practiceAreaId: undefined,
      category: 'GBS-state',
      status: 'active',
    });
  });

  it("uses the first array element for a repeated practiceArea param", () => {
    expect(parseSignalFilters({ practiceArea: ['5', '9'] }).practiceAreaId).toBe(5);
  });
});