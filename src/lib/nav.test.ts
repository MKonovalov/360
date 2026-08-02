import { describe, it, expect } from 'vitest';
import { getActiveNavKey } from './nav';

describe('getActiveNavKey', () => {
  it("returns 'start' for the exact root path", () => {
    expect(getActiveNavKey('/')).toBe('start');
  });

  it("returns 'companies' for the companies index", () => {
    expect(getActiveNavKey('/companies')).toBe('companies');
  });

  it("returns 'companies' for a company detail page (the [id]-highlight lock)", () => {
    expect(getActiveNavKey('/companies/123')).toBe('companies');
  });

  it("returns 'companies' for a deep-nested company route", () => {
    expect(getActiveNavKey('/companies/123/edit')).toBe('companies');
  });

  it("returns 'personas' for the personas index", () => {
    expect(getActiveNavKey('/personas')).toBe('personas');
  });

  it("returns 'personas' for a persona detail page", () => {
    expect(getActiveNavKey('/personas/456')).toBe('personas');
  });

  it("returns 'reviews' for the reviews index", () => {
    expect(getActiveNavKey('/reviews')).toBe('reviews');
  });

  it("returns 'reviews' for a review detail page", () => {
    expect(getActiveNavKey('/reviews/9')).toBe('reviews');
  });

  it("returns 'settings' for the settings index", () => {
    expect(getActiveNavKey('/settings')).toBe('settings');
  });

  it('returns null for the sign-in route', () => {
    expect(getActiveNavKey('/sign-in')).toBeNull();
  });

  it('returns null for the empty string', () => {
    expect(getActiveNavKey('')).toBeNull();
  });

  it('returns null for a sibling prefix (boundary guard)', () => {
    expect(getActiveNavKey('/companies-archive')).toBeNull();
  });

  it('returns null for a /settings sibling prefix (boundary guard)', () => {
    expect(getActiveNavKey('/settings-archive')).toBeNull();
  });
});
