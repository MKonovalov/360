import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CompanyDetailErrorState, CompanyDetailNotFoundState } from './company-detail-states';

describe('CompanyDetailErrorState', () => {
  it('renders a keyboard-accessible Try again control for retryable data failures', () => {
    const markup = renderToStaticMarkup(<CompanyDetailErrorState />);

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Try again');
    expect(markup).toContain('type="button"');
    expect(markup).not.toContain('database unavailable');
  });
});

describe('CompanyDetailNotFoundState', () => {
  it('does not offer retry for a non-retryable missing record', () => {
    const markup = renderToStaticMarkup(<CompanyDetailNotFoundState />);

    expect(markup).toContain('Company not found');
    expect(markup).not.toContain('Try again');
  });
});
