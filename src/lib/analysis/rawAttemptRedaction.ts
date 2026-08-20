import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

import type { RawAttemptRedactedValue } from './rawAttemptContracts';

const SENSITIVE_TEXT = [
  /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/,
  /(?:\+?\d[\d(). -]{7,}\d)/,
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{16,}\b/,
  /\b(?:bearer\s+)[A-Za-z0-9._~+/=-]{8,}/i,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
  /(?:api[_-]?key|token|secret|password|passwd|credential|authorization|database_url|session|cookie)\s*[=:]\s*[^\s,;]{4,}/i,
  /["'](?:api[_-]?key|token|secret|password|credential|authorization|session|cookie)["']\s*:/i,
  /(?:chain[- ]of[- ]thought|private reasoning|system message|developer message)/i,
] as const;

const SENSITIVE_URL_KEY = /^(?:api[_-]?key|apikey|access[_-]?token|token|secret|password|passwd|credential|authorization|auth|database_url|session|cookie|clerk)$/i;
const ENCODED_OCTET = /%[0-9a-f]{2}/i;
const MAX_DECODE_PASSES = 3;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function metadata(value: string, redaction: RawAttemptRedactedValue['redaction']): RawAttemptRedactedValue {
  return { value: null, sha256: sha256(value), originalLength: value.length, redaction, truncated: false };
}

function decodedCandidates(value: string): readonly string[] | undefined {
  const candidates = [value];
  let candidate = value;
  for (let pass = 0; pass < MAX_DECODE_PASSES; pass += 1) {
    if (!ENCODED_OCTET.test(candidate)) return candidates;
    try {
      const decoded = decodeURIComponent(candidate.replaceAll('+', ' '));
      if (decoded === candidate) return candidates;
      candidates.push(decoded);
      candidate = decoded;
    } catch (error) {
      if (error instanceof URIError) return undefined;
      throw error;
    }
  }
  return candidates;
}

function containsSensitiveText(value: string): boolean {
  const candidates = decodedCandidates(value);
  return candidates === undefined
    || candidates.some((candidate) => SENSITIVE_TEXT.some((pattern) => pattern.test(candidate)));
}

function containsSensitiveUrlKey(value: string): boolean {
  const candidates = decodedCandidates(value);
  return candidates === undefined || candidates.some((candidate) => SENSITIVE_URL_KEY.test(candidate));
}

export function redactRawAttemptText(
  value: string,
  maxLength: number,
  isPersona: boolean,
): RawAttemptRedactedValue {
  if (isPersona) return metadata(value, 'persona');
  if (containsSensitiveText(value)) return metadata(value, 'sensitive');
  const normalized = value.trim();
  const truncated = normalized.length > maxLength;
  return {
    value: normalized.slice(0, maxLength),
    sha256: sha256(value),
    originalLength: value.length,
    redaction: 'none',
    truncated,
  };
}

export function redactRawAttemptUrl(value: string, isPersona: boolean): RawAttemptRedactedValue {
  if (isPersona) return metadata(value, 'persona');
  if (containsSensitiveText(value)) return metadata(value, 'unsafe_url');
  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    if (error instanceof TypeError) return metadata(value, 'unsafe_url');
    throw error;
  }
  const fragment = new URLSearchParams(url.hash.slice(1));
  const hasSensitiveField = [...url.searchParams, ...fragment].some(([key, fieldValue]) =>
    containsSensitiveUrlKey(key)
    || containsSensitiveText(key)
    || containsSensitiveText(fieldValue));
  if (
    url.protocol !== 'https:'
    || url.username !== ''
    || url.password !== ''
    || !isPublicHostname(url.hostname)
    || hasSensitiveField
    || containsSensitiveUrlKey(url.hash.slice(1).split(/[=&]/, 1)[0] ?? '')
  ) {
    return metadata(value, 'unsafe_url');
  }
  return {
    value: url.toString(),
    sha256: sha256(value),
    originalLength: value.length,
    redaction: 'none',
    truncated: false,
  };
}

function isPublicHostname(value: string): boolean {
  const hostname = value.toLowerCase().replace(/^\[|\]$/g, '');
  const ipVersion = isIP(hostname);
  if (ipVersion === 4) return isPublicIpv4(hostname);
  if (ipVersion === 6) return isPublicIpv6(hostname);
  return hostname.includes('.')
    && !hostname.endsWith('.local')
    && !hostname.endsWith('.internal')
    && !hostname.endsWith('.localhost')
    && !hostname.endsWith('.lan')
    && !hostname.endsWith('.home');
}

function isPublicIpv4(value: string): boolean {
  const octets = value.split('.').map(Number);
  const [first, second] = octets;
  if (first === undefined || second === undefined) return false;
  return first !== 0
    && first !== 10
    && first !== 127
    && !(first === 100 && second >= 64 && second <= 127)
    && !(first === 169 && second === 254)
    && !(first === 172 && second >= 16 && second <= 31)
    && !(first === 192 && (second === 0 || second === 168))
    && !(first === 198 && (second === 18 || second === 19 || second === 51))
    && !(first === 203 && second === 0)
    && first < 224;
}

function isPublicIpv6(value: string): boolean {
  if (value === '::' || value === '::1') return false;
  if (/^(?:fc|fd|fe[89ab]|ff)/i.test(value)) return false;
  const mappedIpv4 = value.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  return mappedIpv4 === undefined || isPublicIpv4(mappedIpv4);
}
