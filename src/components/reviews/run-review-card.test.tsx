import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// The component tests render statically in the node environment (no jsdom
// dependency is added). Client action modules are mocked so the interaction
// boundaries stay hermetic; the rendered markup and the pure state machine are
// the assertion surfaces.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock('@/app/actions/reviews', () => ({
  confirmRunAction: vi.fn(),
  dismissRunAction: vi.fn(),
  acceptProposalAction: vi.fn(),
  rejectProposalAction: vi.fn(),
}));

import { ReviewQueue } from './review-queue';
import { RunReviewSection } from './run-review-section';
import { RunReviewCard } from './run-review-card';
import type { RunReviewCardData } from './run-review-card';
import {
  RunDecisionButtons,
  RunReviewActions,
  decidedCopy,
  reduceRunActionState,
  runActionCopy,
} from './run-review-actions';
import type { RunActionState } from './run-review-actions';

const PACKET_HASH = 'a'.repeat(64);
const DECIDED_AT = '2026-08-08T00:00:00.000Z';

const PENDING_ITEM: RunReviewCardData = {
  runId: 7,
  status: 'pending_review',
  targetType: 'company',
  subjectId: 42,
  subjectDisplayName: 'Acme Corp',
  templateName: 'GBS Cost Pressure',
  practiceAreaName: 'Shared Services',
  resultId: 10,
  packetHash: PACKET_HASH,
  findingCount: 2,
  sourceCount: 2,
  linkCount: 2,
  completedAt: DECIDED_AT,
  decidedBy: null,
  decidedAt: null,
  decision: null,
  packetMissing: false,
  findings: [
    {
      findingKey: 'f-c1',
      findingRowId: 101,
      signalName: 'New GBS Head',
      evidenceStatus: 'strong',
      sources: [
        {
          sourceKey: 'src-1',
          sourceRowId: 501,
          canonicalUrl: 'https://example.com/news',
          title: 'Acme hires new GBS lead',
        },
      ],
    },
    {
      findingKey: 'f-c2',
      findingRowId: 102,
      signalName: 'Cost Pressure',
      evidenceStatus: 'weak',
      sources: [
        {
          sourceKey: 'src-2',
          sourceRowId: 502,
          canonicalUrl: 'https://example.com/report',
          title: 'Annual report summary',
        },
      ],
    },
  ],
};

const DECIDED_ITEM: RunReviewCardData = {
  ...PENDING_ITEM,
  runId: 11,
  status: 'confirmed',
  decision: 'confirmed',
  decidedBy: 'user_2staff',
  decidedAt: DECIDED_AT,
};

describe('RunReviewSection', () => {
  it('renders exactly one card per run (duplicate-item keys), each run once', () => {
    const html = renderToStaticMarkup(
      <RunReviewSection items={[PENDING_ITEM, DECIDED_ITEM, { ...PENDING_ITEM, runId: 7 }]} />,
    );
    const runIds = [...html.matchAll(/data-run-id="(\d+)"/g)].map((match) => match[1]);
    expect(runIds.sort()).toEqual(['11', '7']);
  });

  it('renders an explicit empty state when there are no run items', () => {
    const html = renderToStaticMarkup(<RunReviewSection items={[]} />);
    expect(html).toContain('No analysis runs to review');
    expect(html).not.toContain('data-run-id');
  });

  it('renders an explicit DB-error state when the fetch failed', () => {
    const html = renderToStaticMarkup(<RunReviewSection items={null} />);
    // React SSR escapes the apostrophe (&#x27;), so assert without it.
    expect(html).toContain('load run reviews');
    expect(html).not.toContain('data-run-id');
  });

  it('labels the section heading accessibly and marks it as v1.7', () => {
    const html = renderToStaticMarkup(<RunReviewSection items={[PENDING_ITEM]} />);
    expect(html).toContain('aria-labelledby="run-review-heading"');
    expect(html).toContain('Analysis Run Reviews');
    expect(html).toContain('v1.7');
  });

  it('coexists with the legacy proposal queue without disturbing it', () => {
    const html = renderToStaticMarkup(
      <div>
        <ReviewQueue proposals={[]} />
        <RunReviewSection items={[PENDING_ITEM]} />
      </div>,
    );
    expect(html).toContain('No proposals to review');
    expect(html).toContain('Analysis Run Reviews');
  });
});

describe('RunReviewCard', () => {
  it('shows the safe run/target summary and packet metadata', () => {
    const html = renderToStaticMarkup(<RunReviewCard item={PENDING_ITEM} />);
    expect(html).toContain('Run #7');
    expect(html).toContain('Acme Corp');
    expect(html).toContain('Company');
    expect(html).toContain('GBS Cost Pressure');
    expect(html).toContain('2 findings');
    expect(html).toContain('2 sources');
    expect(html).toContain(`packet ${PACKET_HASH.slice(0, 12)}`);
  });

  it('renders normalized strong/weak findings with persisted source links and provenance ids', () => {
    const html = renderToStaticMarkup(<RunReviewCard item={PENDING_ITEM} />);
    // finding identity + evidence status
    expect(html).toContain('New GBS Head');
    expect(html).toContain('strong');
    expect(html).toContain('finding #101 (f-c1)');
    expect(html).toContain('finding #102 (f-c2)');
    // persisted source links — canonical URLs only, with provenance ids
    expect(html).toContain('https://example.com/news');
    expect(html).toContain('Acme hires new GBS lead');
    expect(html).toContain('source #501 (src-1)');
    expect(html).toContain('https://example.com/report');
    expect(html).toContain('source #502 (src-2)');
  });

  it('renders only https source links with no javascript or secret-bearing hrefs', () => {
    const html = renderToStaticMarkup(<RunReviewCard item={PENDING_ITEM} />);
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
    expect(hrefs.length).toBeGreaterThan(0);
    expect(hrefs.every((href) => href.startsWith('https://'))).toBe(true);
    expect(html).not.toContain('javascript:');
  });

  it('shows the persisted audit state for an already-decided run without decision controls', () => {
    const html = renderToStaticMarkup(<RunReviewCard item={DECIDED_ITEM} />);
    expect(html).toContain('Confirmed by user_2staff');
    expect(html).not.toContain('aria-label="Confirm run');
    expect(html).not.toContain('aria-label="Dismiss run');
  });

  it('shows an explicit missing-packet state without decision controls', () => {
    const html = renderToStaticMarkup(<RunReviewCard item={{ ...PENDING_ITEM, packetMissing: true }} />);
    expect(html).toContain('packet is unavailable');
    expect(html).not.toContain('aria-label="Confirm run');
    expect(html).not.toContain('aria-label="Dismiss run');
  });

  it('renders pending review as read-only with a Reviews link and no decision controls', () => {
    const html = renderToStaticMarkup(<RunReviewCard item={PENDING_ITEM} mode="readonly" />);
    expect(html).toContain('href="/reviews"');
    expect(html).toContain('Review in Reviews');
    expect(html).not.toContain('aria-label="Confirm run');
    expect(html).not.toContain('aria-label="Dismiss run');
  });

  it('never renders chain-of-thought, raw reasoning, narrative, or persona-sensitive fields', () => {
    const html = renderToStaticMarkup(<RunReviewCard item={PENDING_ITEM} />);
    expect(html.toLowerCase()).not.toContain('reasoning');
    expect(html).not.toContain('claim');
    expect(html).not.toContain('narrative');
    expect(html).not.toContain('buyer_role');
    expect(html).not.toContain('excerpt');
  });
});

describe('RunDecisionButtons', () => {
  it('labels Confirm and Dismiss accessibly for the run', () => {
    const html = renderToStaticMarkup(
      <RunDecisionButtons runId={7} state={{ status: 'idle' }} onDecision={() => {}} />,
    );
    expect(html).toContain('aria-label="Confirm run 7"');
    expect(html).toContain('aria-label="Dismiss run 7"');
    expect(html).toContain('>Confirm</button>');
    expect(html).toContain('>Dismiss</button>');
  });

  it('disables both buttons while a decision is pending (double-submit guard)', () => {
    const html = renderToStaticMarkup(
      <RunDecisionButtons runId={7} state={{ status: 'pending' }} onDecision={() => {}} />,
    );
    const buttons = [...html.matchAll(/<button[^>]*>/g)].map((match) => match[0]);
    expect(buttons.length).toBe(2);
    // The rendered `disabled` attribute, not the substring — the Tailwind base
    // class always contains "disabled:" as a variant prefix.
    expect(buttons.every((button) => button.includes('disabled=""'))).toBe(true);
  });

  it('enables both buttons when idle', () => {
    const html = renderToStaticMarkup(
      <RunDecisionButtons runId={7} state={{ status: 'idle' }} onDecision={() => {}} />,
    );
    const buttons = [...html.matchAll(/<button[^>]*>/g)].map((match) => match[0]);
    expect(buttons.every((button) => !button.includes('disabled=""'))).toBe(true);
  });
});

describe('RunReviewActions state machine', () => {
  it('transitions pending → terminal on a fresh decision', () => {
    const next = reduceRunActionState(
      { status: 'pending' },
      {
        ok: true,
        runId: 7,
        resultId: 10,
        decision: 'confirmed',
        decidedBy: 'user_123',
        decidedAt: DECIDED_AT,
        packetHash: PACKET_HASH,
        replayed: false,
      },
      'confirmed',
    );
    expect(next).toEqual({
      status: 'decided',
      decision: 'confirmed',
      replayed: false,
      decidedBy: 'user_123',
      decidedAt: DECIDED_AT,
    });
  });

  it('transitions pending → replay terminal preserving the original winner', () => {
    const next = reduceRunActionState(
      { status: 'pending' },
      {
        ok: true,
        runId: 7,
        resultId: 10,
        decision: 'confirmed',
        decidedBy: 'user_first',
        decidedAt: DECIDED_AT,
        packetHash: PACKET_HASH,
        replayed: true,
      },
      'dismissed',
    );
    expect(next).toEqual({
      status: 'decided',
      decision: 'confirmed',
      replayed: true,
      decidedBy: 'user_first',
      decidedAt: DECIDED_AT,
    });
    const decided: Extract<RunActionState, { readonly status: 'decided' }> = {
      status: 'decided',
      decision: 'confirmed',
      replayed: true,
      decidedBy: 'user_first',
      decidedAt: DECIDED_AT,
    };
    expect(decidedCopy(decided)).toContain('user_first');
    expect(decidedCopy(decided)).toContain('preserved');
  });

  it('maps race_loser to a non-retryable error without ever claiming a win', () => {
    const next = reduceRunActionState(
      { status: 'pending' },
      { ok: false, reason: 'race_loser' },
      'confirmed',
    );
    expect(next).toEqual({ status: 'error', reason: 'race_loser', retryable: false, attempted: 'confirmed' });
  });

  it('maps a thrown action failure to a retryable error with the attempted decision', () => {
    const next = reduceRunActionState({ status: 'pending' }, { thrown: true }, 'dismissed');
    expect(next).toEqual({ status: 'error', reason: 'action_failed', retryable: true, attempted: 'dismissed' });
  });

  it('keeps error copy explicit and distinct per reason', () => {
    expect(runActionCopy('race_loser')).toContain('Another reviewer');
    expect(runActionCopy('missing_packet')).toContain('no reviewable packet');
    expect(runActionCopy('not_pending_review')).toContain('no longer pending review');
    expect(runActionCopy('action_failed')).toContain('try again');
  });

  it('renders pending action controls for a pending run and decided copy once decided', () => {
    const idleHtml = renderToStaticMarkup(<RunReviewActions runId={7} />);
    expect(idleHtml).toContain('aria-label="Confirm run 7"');
    const decidedState: Extract<RunActionState, { readonly status: 'decided' }> = {
      status: 'decided',
      decision: 'confirmed',
      replayed: false,
      decidedBy: 'user_123',
      decidedAt: DECIDED_AT,
    };
    expect(decidedCopy(decidedState)).toContain('Confirmed by user_123');
  });
});
