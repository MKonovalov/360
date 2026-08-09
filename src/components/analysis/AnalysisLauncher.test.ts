import { describe, expect, it } from 'vitest';

import { createAnalysisRunPayload } from './AnalysisLauncher';

describe('AnalysisLauncher launch contract', () => {
  it('keeps preview-only fields out of the durable run request', () => {
    const payload = createAnalysisRunPayload({
      templateVersionId: 12,
      subjectType: 'company',
      subjectId: 42,
      practiceAreaId: 4,
    });

    expect(payload).toEqual({
      templateVersionId: 12,
      subject: { type: 'company', id: 42 },
      practiceAreaId: 4,
    });
  });
});
