import { describe, expect, it } from 'vitest';
import { prospeoMapPersona } from './prospeoMap';

describe('prospeoMapPersona', () => {
  it('maps title/seniority/linkedinUrl and excludes name + email', () => {
    const fields = prospeoMapPersona({
      full_name: 'Jane Doe',
      email: 'jane@acme.com',
      current_job_title: 'VP Finance',
      job_history: [{ company_name: 'Acme', current: true, seniority: 'VP' }],
      linkedin_url: 'https://linkedin.com/in/jane',
    });
    const byField = Object.fromEntries(fields.map((f) => [f.field, f.incomingValue]));
    expect(byField.title).toBe('VP Finance');
    expect(byField.seniority).toBe('vp');
    expect(byField.linkedinUrl).toBe('https://linkedin.com/in/jane');
    expect(byField.full_name).toBeUndefined();
    expect(byField.email).toBeUndefined();
  });

  it('reads seniority from the current job_history entry, not earlier roles', () => {
    const fields = prospeoMapPersona({
      current_job_title: 'Head of Ops',
      job_history: [
        { company_name: 'Old Co', current: false, seniority: 'VP' },
        { company_name: 'Acme', current: true, seniority: 'Head' },
      ],
    });
    const byField = Object.fromEntries(fields.map((f) => [f.field, f.incomingValue]));
    expect(byField.seniority).toBe('director');
  });

  it('falls back to the top-level seniority when no current job entry exists', () => {
    const fields = prospeoMapPersona({
      current_job_title: 'Head of Ops',
      job_history: [{ company_name: 'Old Co', current: false, seniority: 'VP' }],
      seniority: 'Director',
    });
    const byField = Object.fromEntries(fields.map((f) => [f.field, f.incomingValue]));
    expect(byField.seniority).toBe('director');
  });

  it('falls back to the title alias when current_job_title is absent', () => {
    const fields = prospeoMapPersona({ title: 'Head of Ops' });
    const byField = Object.fromEntries(fields.map((f) => [f.field, f.incomingValue]));
    expect(byField.title).toBe('Head of Ops');
  });

  it('omits unknown seniority rather than guessing', () => {
    const fields = prospeoMapPersona({ current_job_title: 'Mage', seniority: 'wizard' });
    const byField = Object.fromEntries(fields.map((f) => [f.field, f.incomingValue]));
    expect(byField.seniority).toBeUndefined();
    expect(byField.title).toBe('Mage');
  });

  it('confidence is always undefined for Prospeo (no score exposed)', () => {
    const fields = prospeoMapPersona({ current_job_title: 'CEO' });
    expect(fields[0].confidence).toBeUndefined();
  });
});
