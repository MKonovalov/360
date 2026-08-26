import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import CompanyDetailError from './error';

describe('/companies/[id] error state', () => {
  it('renders a safe alert with a keyboard-accessible retry action', () => {
    const reset = vi.fn();
    const markup = renderToStaticMarkup(
      <CompanyDetailError error={new Error('database unavailable')} reset={reset} />,
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toMatch(/Couldn(?:&#x27;|')t load company/);
    expect(markup).toContain('Try again');
    expect(markup).toContain('type="button"');
  });
});
