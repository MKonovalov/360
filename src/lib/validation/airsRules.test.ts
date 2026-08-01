import { describe, it, expect } from 'vitest';
import { validateRunArtifacts } from './validateReport';
import { checkCitationsResolve, type RunArtifactsInput } from './airsRules';
import sampleValid from './fixtures/sample-valid.json';

// Adapter: map the verbatim AIRS report fixture onto the hybrid gate input
// (D-01/D-03). AIRS signal codes (S2/S3) are NOT the DB 4-enum — choose a
// valid signalType per signal; the ported rules do not validate signalType.
function toHybridInput(report: typeof sampleValid): RunArtifactsInput {
  return {
    // JSON imports widen string literals — cast back to the strict enums
    verdict: report.bluf.verdict as 'active' | 'emerging' | 'no_intent',
    keyUncertainties: report.key_uncertainties,
    evidenceAppendix: report.evidence_appendix.map((e) => ({
      url: e.url,
      title: e.url,
      snippet: e.url,
    })),
    proposals: report.signals.map((sig, i) => ({
      signalType: i === 0 ? 'transformation_announcement' : 'immature_gbs_org',
      strength: (sig.weight ?? 0) >= 7 ? 'high' : 'medium',
      detectedAt: sig.observed_at,
      evidenceUrl: sig.source_url,
      reliability: sig.reliability as 'R1' | 'R2' | 'R3',
      confidence: sig.confidence as 'C1' | 'C2' | 'C3',
      evidenceSnippet: sig.evidence_snippet,
      reasoning: sig.evidence_snippet,
    })),
  };
}

describe('validateRunArtifacts (AIRS gate port, D-03)', () => {
  const validInput = () => toHybridInput(sampleValid);

  it('passes the verbatim sample-valid fixture (09-01-02)', () => {
    const result = validateRunArtifacts(validInput());
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('fails when a proposal evidenceUrl is not in the evidence appendix (every_citation_must_resolve)', () => {
    const input = validInput();
    input.proposals[0] = {
      ...input.proposals[0],
      evidenceUrl: 'https://orphan.example.com/claim',
    };
    const result = validateRunArtifacts(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /citation/i.test(e))).toBe(true);
  });

  it('fails when R/C enums are out of range', () => {
    const input = validInput();
    input.proposals[0] = {
      ...input.proposals[0],
      reliability: 'R9' as unknown as 'R1',
    };
    const result = validateRunArtifacts(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /reliability/i.test(e))).toBe(true);
  });

  it('fails when a strong (high-strength) claim is rated R3·C3 (bluf_cannot_use_R3C3)', () => {
    const input = validInput();
    input.proposals[0] = {
      ...input.proposals[0],
      strength: 'high',
      reliability: 'R3' as unknown as 'R1',
      confidence: 'C3' as unknown as 'C1',
    };
    const result = validateRunArtifacts(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /R3/i.test(e))).toBe(true);
  });

  it('fails when keyUncertainties is empty', () => {
    const input = validInput();
    input.keyUncertainties = [];
    const result = validateRunArtifacts(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /uncertaint/i.test(e))).toBe(true);
  });

  it('fails when proposals are empty but verdict is not no_intent (empty_signals_implies_no_intent)', () => {
    const input = validInput();
    input.proposals = [];
    input.verdict = 'active';
    const result = validateRunArtifacts(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /no_intent/i.test(e))).toBe(true);
  });

  it('passes when proposals are empty and verdict is no_intent', () => {
    const input = validInput();
    input.proposals = [];
    input.verdict = 'no_intent';
    expect(validateRunArtifacts(input)).toEqual({ valid: true, errors: [] });
  });

  it('errors are human-readable strings in "path: message" shape', () => {
    const input = validInput();
    input.proposals[0] = {
      ...input.proposals[0],
      evidenceUrl: 'https://orphan.example.com/claim',
    };
    const { errors } = validateRunArtifacts(input);
    expect(errors.length).toBeGreaterThan(0);
    errors.forEach((e) => {
      expect(typeof e).toBe('string');
      expect(e.length).toBeGreaterThan(0);
      expect(e).toMatch(/^[^:]+: .+/);
    });
  });
});

// Direct rule tests for checkCitationsResolve's tolerant URL resolution
// (live-failure regression: Firecrawl returns …/714139/ but the model cited
// …/714139/trade lifted from snippet text — exact-match gate failed).
describe('checkCitationsResolve (URL resolution tolerance)', () => {
  const APPENDIX_URL = 'https://www.biopharmadive.com/news/curevac-restructuring-layoffs-avian-flu-vaccine/714139/';
  const baseInput = (evidenceUrl: string): RunArtifactsInput => ({
    verdict: 'active',
    keyUncertainties: ['uncertainty'],
    evidenceAppendix: [{ url: APPENDIX_URL, title: 't', snippet: 's' }],
    proposals: [
      {
        signalType: 'transformation_announcement',
        strength: 'high',
        detectedAt: '2026-07-01',
        evidenceUrl,
        reliability: 'R1',
        confidence: 'C1',
        evidenceSnippet: 's',
        reasoning: 'r',
      },
    ],
  });

  it('resolves an exact match', () => {
    expect(checkCitationsResolve(baseInput(APPENDIX_URL))).toEqual([]);
  });

  it('resolves benign variance: trailing slash, scheme, query, fragment, host case', () => {
    const variants = [
      'https://www.biopharmadive.com/news/curevac-restructuring-layoffs-avian-flu-vaccine/714139',
      'http://www.BioPharmaDive.com/news/curevac-restructuring-layoffs-avian-flu-vaccine/714139/',
      'https://www.biopharmadive.com/news/curevac-restructuring-layoffs-avian-flu-vaccine/714139/?utm_source=search#top',
    ];
    for (const v of variants) {
      expect(checkCitationsResolve(baseInput(v)), v).toEqual([]);
    }
  });

  it('resolves a citation extending a fetched URL by an extra path segment (live /trade case)', () => {
    const cited = 'https://www.biopharmadive.com/news/curevac-restructuring-layoffs-avian-flu-vaccine/714139/trade';
    expect(checkCitationsResolve(baseInput(cited))).toEqual([]);
  });

  it('rejects a fabricated URL on a different host', () => {
    const violations = checkCitationsResolve(
      baseInput('https://evil.example.com/news/curevac-restructuring-layoffs/714139/trade'),
    );
    expect(violations.length).toBe(1);
    expect(violations[0]).toMatch(/proposal\[0\]\.evidenceUrl/);
  });

  it('rejects citing a parent of a fetched URL (bare section page / homepage)', () => {
    const parents = [
      'https://www.biopharmadive.com/',
      'https://www.biopharmadive.com/news/',
      'https://www.biopharmadive.com/news/curevac-restructuring-layoffs-avian-flu-vaccine/',
    ];
    for (const p of parents) {
      expect(checkCitationsResolve(baseInput(p)), p).not.toEqual([]);
    }
  });
});
