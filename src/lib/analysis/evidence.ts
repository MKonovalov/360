import { createHash } from 'node:crypto';

import ipaddr from 'ipaddr.js';

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

const NON_PUBLIC_IP_RANGES: ReadonlySet<string> = new Set([
  'private', 'linkLocal', 'carrierGradeNat', 'loopback', 'unspecified', 'multicast', 'reserved',
  'uniqueLocal', 'broadcast', 'rfc6145', 'rfc6052', '6to4', 'teredo',
] as const);
const IPV4_SPECIAL_USE_RANGES = { nonPublic: [
  [ipaddr.IPv4.parse('0.0.0.0'), 8], [ipaddr.IPv4.parse('10.0.0.0'), 8], [ipaddr.IPv4.parse('100.64.0.0'), 10],
  [ipaddr.IPv4.parse('127.0.0.0'), 8], [ipaddr.IPv4.parse('169.254.0.0'), 16], [ipaddr.IPv4.parse('172.16.0.0'), 12],
  [ipaddr.IPv4.parse('192.0.0.0'), 24], [ipaddr.IPv4.parse('192.0.2.0'), 24], [ipaddr.IPv4.parse('192.88.99.0'), 24],
  [ipaddr.IPv4.parse('192.168.0.0'), 16], [ipaddr.IPv4.parse('198.18.0.0'), 15], [ipaddr.IPv4.parse('198.51.100.0'), 24],
  [ipaddr.IPv4.parse('203.0.113.0'), 24], [ipaddr.IPv4.parse('224.0.0.0'), 4], [ipaddr.IPv4.parse('240.0.0.0'), 4],
] } satisfies Record<string, [ipaddr.IPv4, number][]>;
const IPV6_SPECIAL_USE_RANGES = { nonPublic: [
  [ipaddr.IPv6.parse('::'), 128], [ipaddr.IPv6.parse('::1'), 128], [ipaddr.IPv6.parse('100::'), 64],
  [ipaddr.IPv6.parse('64:ff9b::'), 96], [ipaddr.IPv6.parse('64:ff9b:1::'), 48], [ipaddr.IPv6.parse('2001:2::'), 48],
  [ipaddr.IPv6.parse('2001:10::'), 28], [ipaddr.IPv6.parse('2001:20::'), 28], [ipaddr.IPv6.parse('2001:db8::'), 32],
  [ipaddr.IPv6.parse('2002::'), 16], [ipaddr.IPv6.parse('3fff::'), 20], [ipaddr.IPv6.parse('fc00::'), 7],
  [ipaddr.IPv6.parse('fe80::'), 10], [ipaddr.IPv6.parse('ff00::'), 8],
] } satisfies Record<string, [ipaddr.IPv6, number][]>;

export function isNonPublicHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (ipaddr.isValid(normalized)) {
    const address = ipaddr.parse(normalized);
    if (address instanceof ipaddr.IPv6 && address.isIPv4MappedAddress()) {
      return isNonPublicHost(address.toIPv4Address().toString());
    }
    if (address instanceof ipaddr.IPv6 && address.toByteArray().slice(0, 12).every((byte) => byte === 0)) {
      return true;
    }
    const specialUse = address instanceof ipaddr.IPv4
      ? ipaddr.subnetMatch(address, IPV4_SPECIAL_USE_RANGES, 'public') !== 'public'
      : ipaddr.subnetMatch(address, IPV6_SPECIAL_USE_RANGES, 'public') !== 'public';
    return specialUse || NON_PUBLIC_IP_RANGES.has(address.range());
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
    if (isNonPublicHost(url.hostname)) fail('unsupported_source');
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
