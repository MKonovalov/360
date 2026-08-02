import { describe, it, expect } from 'vitest';
import { buildEnrichmentPlan } from './mergePlan';
import type { EnrichedField } from './apolloMap';

const f = (field: string, incomingValue: string | string[], confidence?: number): EnrichedField => ({
  field,
  incomingValue,
  confidence,
});

describe('buildEnrichmentPlan', () => {
  it('classifies an empty target field as fill + preAccepted', () => {
    const plan = buildEnrichmentPlan({ industry: null }, [f('industry', 'Manufacturing')]);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({
      field: 'industry',
      currentValue: null,
      incomingValue: 'Manufacturing',
      classification: 'fill',
      preAccepted: true,
    });
  });

  it('treats empty string and empty array as empty (fill)', () => {
    const plan = buildEnrichmentPlan({ hqLocation: '   ', techStack: [] }, [
      f('hqLocation', 'Berlin'),
      f('techStack', ['React']),
    ]);
    expect(plan.every((r) => r.classification === 'fill' && r.preAccepted)).toBe(true);
    expect(plan).toHaveLength(2);
  });

  it('classifies a populated, differing field as conflict + not preAccepted', () => {
    const plan = buildEnrichmentPlan({ revenueBand: '50m_250m' }, [f('revenueBand', '250m_1b')]);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({
      field: 'revenueBand',
      currentValue: '50m_250m',
      incomingValue: '250m_1b',
      classification: 'conflict',
      preAccepted: false,
    });
  });

  it('skips identical values (no row)', () => {
    const plan = buildEnrichmentPlan({ industry: 'Tech' }, [f('industry', 'Tech')]);
    expect(plan).toHaveLength(0);
  });

  it('uses order-insensitive equality for arrays (identical → skipped)', () => {
    const plan = buildEnrichmentPlan({ techStack: ['AWS', 'React'] }, [f('techStack', ['react', 'aws'])]);
    expect(plan).toHaveLength(0);
  });

  it('surfaces an array conflict when the sets differ', () => {
    const plan = buildEnrichmentPlan({ techStack: ['AWS'] }, [f('techStack', ['AWS', 'Okta'])]);
    expect(plan).toHaveLength(1);
    expect(plan[0].classification).toBe('conflict');
  });

  it('produces the correct per-field split on a mixed record', () => {
    const current = { industry: null, revenueBand: '50m_250m', hqLocation: 'Berlin' };
    const incoming = [
      f('industry', 'Manufacturing'), // fill
      f('revenueBand', '250m_1b'), // conflict
      f('hqLocation', 'Berlin'), // identical → skipped
      f('techStack', ['React']), // fill (absent key)
    ];
    const plan = buildEnrichmentPlan(current, incoming);
    const byField = Object.fromEntries(plan.map((r) => [r.field, r.classification]));
    expect(byField).toEqual({ industry: 'fill', revenueBand: 'conflict', techStack: 'fill' });
    expect(plan.find((r) => r.field === 'hqLocation')).toBeUndefined();
  });

  it('carries confidence through when present', () => {
    const plan = buildEnrichmentPlan({ industry: null }, [f('industry', 'Tech', 0.9)]);
    expect(plan[0].confidence).toBe(0.9);
  });
});
