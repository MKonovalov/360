import { describe, it, expect } from 'vitest';
import { getCollapseToggleLabel, getNavTooltipLabel } from './sidebar-collapse';

describe('getNavTooltipLabel', () => {
  it("returns the verbatim 'Start' label for the start key, ignoring the count", () => {
    expect(getNavTooltipLabel('start', 0)).toBe('Start');
  });

  it("returns the verbatim 'Companies' label for the companies key, ignoring the count", () => {
    expect(getNavTooltipLabel('companies', 5)).toBe('Companies');
  });

  it("returns the verbatim 'Key Personas' label for the personas key, ignoring the count", () => {
    expect(getNavTooltipLabel('personas', 0)).toBe('Key Personas');
  });

  it("returns the verbatim 'Settings' label for the settings key, ignoring the count", () => {
    expect(getNavTooltipLabel('settings', 0)).toBe('Settings');
  });

  it("returns the verbatim 'Settings' label for the settings key with a positive count", () => {
    expect(getNavTooltipLabel('settings', 3)).toBe('Settings');
  });

  it("returns plain 'Reviews' for the reviews key when the pending count is zero", () => {
    expect(getNavTooltipLabel('reviews', 0)).toBe('Reviews');
  });

  it("returns 'Reviews (3)' for the reviews key when the pending count is positive", () => {
    expect(getNavTooltipLabel('reviews', 3)).toBe('Reviews (3)');
  });
});

describe('getCollapseToggleLabel', () => {
  it("returns 'Collapse' when the sidebar is expanded", () => {
    expect(getCollapseToggleLabel('expanded')).toBe('Collapse');
  });

  it("returns 'Expand' when the sidebar is collapsed", () => {
    expect(getCollapseToggleLabel('collapsed')).toBe('Expand');
  });
});
