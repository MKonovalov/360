import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

import { z } from 'zod';

const MAX_CONTENT_BYTES = 200_000;
const MAX_EXCERPT_BYTES = 8_000;
const MAX_TITLE_LENGTH = 500;
const MAX_PROVIDER_VALUE_LENGTH = 120;

const evidenceResultSchema = z
  .object({
    origin: z.literal('firecrawl'),
    providerName: z.literal('firecrawl'),
    providerVersion: z.string().trim().min(1).max(MAX_PROVIDER_VALUE_LENGTH),
    url: z.string().trim().min(1).max(2_048),
    title: z.string().trim().min(1).max(MAX_TITLE_LENGTH),
    snippet: z.string().trim().min(1).max(MAX_EXCERPT_BYTES),
    content: z.string().trim().min(1).max(MAX_CONTENT_BYTES),
    retrievedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type ServerDerivedEvidenceResult = z.infer<typeof evidenceResultSchema>;

export type EvidenceClassification = 'public_biz' | 'personal_data';

export type NormalizedEvidenceSource = {
  readonly sourceId: string;
  readonly canonicalUrl: string;
  readonly title: string;
  readonly retrievedAt: string;
  readonly excerpt: string;
  readonly contentHash: string;
  readonly classification: EvidenceClassification;
  readonly providerName: 'firecrawl';
  readonly providerVersion: string;
};

export type EvidenceFailureReason =
  | 'unsupported_source'
  | 'invalid_excerpt'
  | 'unsafe_research_content'
  | 'invalid_packet';

export class EvidenceNormalizationError extends Error {
  readonly name = 'EvidenceNormalizationError';

  constructor(readonly reason: EvidenceFailureReason) {
    super(reason);
  }
}

function fail(reason: EvidenceFailureReason): never {
  throw new EvidenceNormalizationError(reason);
}

function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split('.').map(Number);
  const first = octets[0];
  const second = octets[1];
  if (first === undefined || second === undefined) return true;
  return (
    first === 0 ||
    first === 10 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && (second === 0 || second === 168)) ||
    (first === 192 && second === 0) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51) ||
    (first === 203 && second === 0) ||
    first >= 224
  );
}

function isPrivateHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const addressType = isIP(normalized);
  if (addressType === 4) return isPrivateIpv4(normalized);
  if (addressType === 6) {
    return (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb') ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd')
    );
  }
  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal') ||
    normalized.endsWith('.test') ||
    normalized === 'metadata.google.internal' ||
    normalized === 'metadata.google.com'
  );
}

function containsUnsafeResearchText(value: string): boolean {
  return /(?:ignore\s+(?:all\s+)?previous\s+instructions?|system\s+message|developer\s+message|reveal\s+(?:the\s+)?(?:secret|token|api[_ -]?key|database_url)|private\s+reasoning|chain[- ]of[- ]thought|clerk[_ -]?session|api[_ -]?key|database_url)/i.test(
    value,
  );
}

function classifyHost(hostname: string): EvidenceClassification {
  return /(?:linkedin|facebook|instagram|x\.com|twitter|crunchbase|zoominfo)/i.test(hostname)
    ? 'personal_data'
    : 'public_biz';
}

export function canonicalizeEvidenceUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username !== '' || url.password !== '' || url.hash !== '') {
      fail('unsupported_source');
    }
    if (/(?:database_url|api[_-]?key|token|secret|clerk|session)/i.test(url.toString())) {
      fail('unsupported_source');
    }
    if (isPrivateHost(url.hostname)) fail('unsupported_source');
    url.hostname = url.hostname.toLowerCase();
    if (url.port === '443') url.port = '';
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch (error) {
    if (error instanceof EvidenceNormalizationError) throw error;
    fail('unsupported_source');
  }
}

function findExcerpt(content: string, snippet: string): string {
  const normalizedContent = content.trim();
  const normalizedSnippet = snippet.trim();
  if (Buffer.byteLength(normalizedContent, 'utf8') > MAX_CONTENT_BYTES) fail('invalid_excerpt');
  if (Buffer.byteLength(normalizedSnippet, 'utf8') > MAX_EXCERPT_BYTES) fail('invalid_excerpt');
  if (!normalizedContent.toLocaleLowerCase().includes(normalizedSnippet.toLocaleLowerCase())) {
    fail('invalid_excerpt');
  }
  return normalizedSnippet;
}

export function normalizeEvidenceSource(input: unknown): NormalizedEvidenceSource {
  const parsed = evidenceResultSchema.safeParse(input);
  if (!parsed.success) fail('invalid_packet');
  const result = parsed.data;
  if (containsUnsafeResearchText(`${result.title}\n${result.snippet}\n${result.content}`)) {
    fail('unsafe_research_content');
  }
  const canonicalUrl = canonicalizeEvidenceUrl(result.url);
  const excerpt = findExcerpt(result.content, result.snippet);
  const contentHash = createHash('sha256').update(result.content, 'utf8').digest('hex');
  const sourceId = `source-${contentHash.slice(0, 24)}`;

  return Object.freeze({
    sourceId,
    canonicalUrl,
    title: result.title,
    retrievedAt: result.retrievedAt,
    excerpt,
    contentHash,
    classification: classifyHost(new URL(canonicalUrl).hostname),
    providerName: result.providerName,
    providerVersion: result.providerVersion,
  });
}

export function deduplicateEvidenceSources(
  sources: readonly NormalizedEvidenceSource[],
): readonly NormalizedEvidenceSource[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const identity = `${source.canonicalUrl}:${source.contentHash}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}
