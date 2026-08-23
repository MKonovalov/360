import 'server-only';

import ipaddr from 'ipaddr.js';

import { EvidenceNormalizationError, canonicalizeEvidenceUrl } from './evidence';
import type {
  BoundedArcAgentnetInput,
  BoundedChecklistItem,
  BoundedCompanyProfile,
  BoundedTemplateMetadata,
  ResolvedCompanyAnalysisForArcAgentnet,
  ResolvedTemplateMetadata,
} from './arcAgentnetContracts';

export const ARC_AGENTNET_PAYLOAD_LIMITS = {
  maxRequestBytes: 1 * 1024 * 1024,
  maxIndividualValueBytes: 25 * 1024 * 1024,
  maxJobInputOutputBytes: 100 * 1024 * 1024,
  maxCallbackResultBytes: 5 * 1024 * 1024,
  maxInstructionLength: 20_000,
  maxChecklistItems: 100,
  maxChecklistLabelLength: 500,
  maxEvidenceUrls: 50,
  maxEvidenceUrlLength: 2_048,
  maxTemplateKeyLength: 120,
  maxTemplateNameLength: 500,
  maxCustomAgentIdLength: 500,
  maxCompanyCategoryLength: 200,
  maxPracticeAreaNameLength: 500,
  maxPracticeAreaShortCodeLength: 120,
} as const;

type BuildResult = BoundedArcAgentnetInput | { readonly ok: false; readonly reason: 'invalid_input' | 'payload_too_large' };

const invalidInput = (): { readonly ok: false; readonly reason: 'invalid_input' } => ({ ok: false, reason: 'invalid_input' });

const NON_PUBLIC_IP_RANGES: ReadonlySet<string> = new Set(['private', 'linkLocal', 'carrierGradeNat', 'loopback', 'unspecified', 'multicast', 'reserved', 'uniqueLocal', 'broadcast'] as const);
const IPV4_SPECIAL_USE_RANGES = { nonPublic: [[ipaddr.IPv4.parse('0.0.0.0'), 8], [ipaddr.IPv4.parse('10.0.0.0'), 8], [ipaddr.IPv4.parse('100.64.0.0'), 10], [ipaddr.IPv4.parse('127.0.0.0'), 8], [ipaddr.IPv4.parse('169.254.0.0'), 16], [ipaddr.IPv4.parse('172.16.0.0'), 12], [ipaddr.IPv4.parse('192.0.0.0'), 24], [ipaddr.IPv4.parse('192.0.2.0'), 24], [ipaddr.IPv4.parse('192.88.99.0'), 24], [ipaddr.IPv4.parse('192.168.0.0'), 16], [ipaddr.IPv4.parse('198.18.0.0'), 15], [ipaddr.IPv4.parse('198.51.100.0'), 24], [ipaddr.IPv4.parse('203.0.113.0'), 24], [ipaddr.IPv4.parse('224.0.0.0'), 4], [ipaddr.IPv4.parse('240.0.0.0'), 4]] } satisfies Record<string, [ipaddr.IPv4, number][]>;
const IPV6_SPECIAL_USE_RANGES = { nonPublic: [[ipaddr.IPv6.parse('::'), 128], [ipaddr.IPv6.parse('::1'), 128], [ipaddr.IPv6.parse('100::'), 64], [ipaddr.IPv6.parse('2001:2::'), 48], [ipaddr.IPv6.parse('2001:10::'), 28], [ipaddr.IPv6.parse('2001:db8::'), 32], [ipaddr.IPv6.parse('3fff::'), 20], [ipaddr.IPv6.parse('fc00::'), 7], [ipaddr.IPv6.parse('fe80::'), 10], [ipaddr.IPv6.parse('ff00::'), 8]] } satisfies Record<string, [ipaddr.IPv6, number][]>;

const payloadTooLarge = (): { readonly ok: false; readonly reason: 'payload_too_large' } => ({ ok: false, reason: 'payload_too_large' });

function isPositiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function hasOversizedValue(value: unknown, seen: WeakSet<object>): boolean {
  if (typeof value === 'string') {
    return Buffer.byteLength(value, 'utf8') > ARC_AGENTNET_PAYLOAD_LIMITS.maxIndividualValueBytes;
  }
  if (typeof value !== 'object' || value === null || seen.has(value)) return false;

  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => hasOversizedValue(item, seen));
  return Object.values(value).some((item) => hasOversizedValue(item, seen));
}

function normalizeRequiredText(value: string, maxLength: number): string | null {
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : null;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isPrivateDomainHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (ipaddr.isValid(normalized)) {
    const address = ipaddr.parse(normalized);
    const specialUse = address instanceof ipaddr.IPv6 && address.isIPv4MappedAddress()
      ? isPrivateDomainHost(address.toIPv4Address().toString())
      : address instanceof ipaddr.IPv4
        ? ipaddr.subnetMatch(address, IPV4_SPECIAL_USE_RANGES, 'public') !== 'public'
        : ipaddr.subnetMatch(address, IPV6_SPECIAL_USE_RANGES, 'public') !== 'public';
    if (specialUse) return true;
    if (address instanceof ipaddr.IPv6 && address.isIPv4MappedAddress()) {
      return NON_PUBLIC_IP_RANGES.has(address.toIPv4Address().range());
    }
    return NON_PUBLIC_IP_RANGES.has(address.range());
  }
  if (normalized === 'localhost' || normalized.endsWith('.localhost')) return true;
  if (normalized.endsWith('.local') || normalized.endsWith('.internal') || normalized.endsWith('.test')) return true;
  return false;
}

function normalizeCompanyDomain(rawDomain: string | null): string | null {
  if (rawDomain === null) return null;
  const raw = rawDomain.trim();
  if (raw.length === 0) return null;

  try {
    const isUnbracketedIpv6 = ipaddr.isValid(raw) && ipaddr.parse(raw) instanceof ipaddr.IPv6;
    const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(raw)
      ? raw
      : isUnbracketedIpv6
        ? `https://[${raw}]`
        : `https://${raw}`;
    const url = new URL(candidate);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (
      url.username !== '' ||
      url.password !== '' ||
      url.pathname !== '/' ||
      url.search !== '' ||
      url.hash !== '' ||
      url.port !== '' ||
      url.hostname === '' ||
      isPrivateDomainHost(url.hostname)
    ) return null;

    return url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/^www\./, '');
  } catch {
    return null;
  }
}

function normalizeTemplate(template: ResolvedTemplateMetadata): BoundedTemplateMetadata | null {
  const templateKey = normalizeRequiredText(template.templateKey, ARC_AGENTNET_PAYLOAD_LIMITS.maxTemplateKeyLength);
  const templateName = normalizeRequiredText(template.templateName, ARC_AGENTNET_PAYLOAD_LIMITS.maxTemplateNameLength);
  if (
    templateKey === null ||
    templateName === null ||
    !isPositiveInteger(template.templateId) ||
    !isPositiveInteger(template.templateVersionId) ||
    !isPositiveInteger(template.templateVersion) ||
    template.targetType !== 'company'
  ) return null;

  switch (template.kind) {
    case 'fixed':
      return (template.customAgentId === undefined || template.customAgentId === null) &&
        (template.customAgentName === undefined || template.customAgentName === null) &&
        (template.customAgentVersion === undefined || template.customAgentVersion === null)
        ? {
            kind: 'fixed',
            templateId: template.templateId,
            templateVersionId: template.templateVersionId,
            templateKey,
            templateName,
            templateVersion: template.templateVersion,
            targetType: 'company',
            customAgentId: null,
            customAgentName: null,
            customAgentVersion: null,
          }
        : null;
    case 'custom': {
      const customAgentId = normalizeRequiredText(template.customAgentId ?? '', ARC_AGENTNET_PAYLOAD_LIMITS.maxCustomAgentIdLength);
      const customAgentName = normalizeRequiredText(template.customAgentName ?? '', ARC_AGENTNET_PAYLOAD_LIMITS.maxTemplateNameLength);
      const customAgentVersion = template.customAgentVersion;
      return customAgentId !== null &&
        customAgentName !== null &&
        customAgentVersion !== null &&
        customAgentVersion !== undefined &&
        isPositiveInteger(customAgentVersion)
        ? {
            kind: 'custom',
            templateId: template.templateId,
            templateVersionId: template.templateVersionId,
            templateKey,
            templateName,
            templateVersion: template.templateVersion,
            targetType: 'company',
            customAgentId,
            customAgentName,
            customAgentVersion,
          }
        : null;
    }
    default:
      return assertNever(template.kind);
  }
}

function normalizeChecklist(checklist: readonly BoundedChecklistItem[]): readonly BoundedChecklistItem[] | null {
  if (checklist.length > ARC_AGENTNET_PAYLOAD_LIMITS.maxChecklistItems) return null;

  const normalized: BoundedChecklistItem[] = [];
  for (const item of checklist) {
    const label = normalizeRequiredText(item.label, ARC_AGENTNET_PAYLOAD_LIMITS.maxChecklistLabelLength);
    if (label === null || !isPositiveInteger(item.id) || typeof item.required !== 'boolean') return null;
    normalized.push({ id: item.id, label, required: item.required });
  }
  return normalized;
}

function normalizeEvidenceUrls(urls: readonly string[]): readonly string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const rawUrl of urls) {
    if (normalized.length >= ARC_AGENTNET_PAYLOAD_LIMITS.maxEvidenceUrls) break;
    if (Buffer.byteLength(rawUrl, 'utf8') > ARC_AGENTNET_PAYLOAD_LIMITS.maxEvidenceUrlLength) continue;

    try {
      const canonicalUrl = canonicalizeEvidenceUrl(rawUrl);
      if (Buffer.byteLength(canonicalUrl, 'utf8') > ARC_AGENTNET_PAYLOAD_LIMITS.maxEvidenceUrlLength) continue;
      if (seen.has(canonicalUrl)) continue;
      seen.add(canonicalUrl);
      normalized.push(canonicalUrl);
    } catch (error: unknown) {
      if (error instanceof EvidenceNormalizationError) continue;
      throw error;
    }
  }
  return normalized;
}

function normalizeProfile(profile: ResolvedCompanyAnalysisForArcAgentnet['company']['profile']): BoundedCompanyProfile | null {
  const { headcount } = profile;
  if (headcount !== undefined && headcount !== null && (!Number.isSafeInteger(headcount) || headcount < 0)) return null;

  return {
    industry: normalizeOptionalText(profile.industry),
    headcount: headcount ?? null,
    headquarters: normalizeOptionalText(profile.headquarters),
    description: normalizeOptionalText(profile.description),
  };
}

function assertNever(value: never): never {
  throw new Error(`Unexpected Arc-agentnet template kind: ${String(value)}`);
}

export function buildBoundedArcAgentnetInput(input: ResolvedCompanyAnalysisForArcAgentnet): BuildResult {
  if (hasOversizedValue(input, new WeakSet<object>())) return payloadTooLarge();

  const companyName = normalizeOptionalText(input.company.name);
  const profile = normalizeProfile(input.company.profile);
  const template = normalizeTemplate(input.template);
  const instruction = normalizeRequiredText(input.resolvedInstruction, ARC_AGENTNET_PAYLOAD_LIMITS.maxInstructionLength);
  const category = normalizeRequiredText(input.buyingSignalCategory, ARC_AGENTNET_PAYLOAD_LIMITS.maxCompanyCategoryLength);
  const practiceAreaName = normalizeRequiredText(input.practiceArea.name, ARC_AGENTNET_PAYLOAD_LIMITS.maxPracticeAreaNameLength);
  const shortCode = normalizeRequiredText(input.practiceArea.shortCode, ARC_AGENTNET_PAYLOAD_LIMITS.maxPracticeAreaShortCodeLength);
  const checklist = normalizeChecklist(input.checklist);

  if (
    companyName === null ||
    profile === null ||
    template === null ||
    instruction === null ||
    category === null ||
    practiceAreaName === null ||
    shortCode === null ||
    checklist === null ||
    !isPositiveInteger(input.company.id) ||
    !isPositiveInteger(input.practiceArea.id)
  ) return invalidInput();

  const payload: BoundedArcAgentnetInput = {
    schemaVersion: 1,
    analysis: {
      subjectType: 'company',
      company: {
        id: input.company.id,
        name: companyName,
        domain: normalizeCompanyDomain(input.company.domain),
        profile,
      },
      practiceArea: { id: input.practiceArea.id, name: practiceAreaName, shortCode },
      buyingSignalCategory: category,
      template,
      resolvedInstructions: instruction,
      checklist,
      publicEvidenceUrls: normalizeEvidenceUrls(input.publicEvidenceUrls),
    },
  };

  const serializedBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
  if (
    serializedBytes > ARC_AGENTNET_PAYLOAD_LIMITS.maxRequestBytes ||
    serializedBytes + ARC_AGENTNET_PAYLOAD_LIMITS.maxCallbackResultBytes > ARC_AGENTNET_PAYLOAD_LIMITS.maxJobInputOutputBytes
  ) return payloadTooLarge();

  return payload;
}
