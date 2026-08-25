import { sql, type SQL } from 'drizzle-orm';

function searchApprovalTextKey(value: SQL<unknown>): SQL<unknown> {
  return sql`regexp_replace(normalize(btrim(${value}), NFKC), '\\s+', ' ', 'g')`;
}

export function searchApprovalEmailKey(value: SQL<unknown>): SQL<unknown> {
  return sql`lower(${searchApprovalTextKey(value)})`;
}

export function searchApprovalNameKey(value: SQL<unknown>): SQL<unknown> {
  return sql`lower(${searchApprovalTextKey(value)})`;
}

export function searchApprovalDomainKey(value: SQL<unknown>): SQL<unknown> {
  const textKey = searchApprovalTextKey(value);
  const withoutScheme = sql`regexp_replace(lower(${textKey}), '^[a-z][a-z\\d+.-]*://', '')`;
  const withoutPath = sql`regexp_replace(regexp_replace(${withoutScheme}, '^www\\.', ''), '[/:?#].*$', '')`;
  return sql`regexp_replace(${withoutPath}, '[/.]+$', '')`;
}

export function searchApprovalLinkedInKey(value: SQL<unknown>): SQL<unknown> {
  const textKey = searchApprovalTextKey(value);
  const hashless = sql`regexp_replace(${textKey}, '#.*$', '')`;
  const urlBase = sql`regexp_replace(split_part(${hashless}, '?', 1), '/+$', '')`;
  const absoluteAuthority = sql`substring(lower(${urlBase}) FROM '^[a-z][a-z\\d+.-]*://[^/?#]+')`;
  const canonicalBase = sql`
    CASE
      WHEN ${urlBase} ~* '^[a-z][a-z\\d+.-]*://[^/?#]+' THEN
        ${absoluteAuthority} || substring(${urlBase} FROM length(${absoluteAuthority}) + 1)
      ELSE lower(${urlBase})
    END
  `;
  const linkedinBase = sql`
    regexp_replace(
      regexp_replace(${canonicalBase}, '^https://www\\.linkedin\\.com', 'https://linkedin.com'),
      '^http://www\\.linkedin\\.com',
      'http://linkedin.com'
    )
  `;
  const query = sql`NULLIF(substring(${hashless} FROM '\\?([^#]*)$'), '')`;
  const retainedQuery = sql`(
    SELECT string_agg(parameter, '&' ORDER BY parameter_key COLLATE "C", ordinal)
    FROM regexp_split_to_table(COALESCE(${query}, ''), '&') WITH ORDINALITY
      AS query_parameter(parameter, ordinal)
    CROSS JOIN LATERAL (SELECT split_part(parameter, '=', 1) AS parameter_key) key_parts
    WHERE parameter <> ''
      AND lower(parameter_key) NOT LIKE 'utm_%'
      AND lower(parameter_key) NOT IN ('fbclid', 'gclid', 'dclid', 'msclkid', 'mc_cid', 'mc_eid', 'trk')
  )`;
  const validUrl = sql`
    ${linkedinBase}
    || CASE
      WHEN ${retainedQuery} IS NULL OR ${retainedQuery} = '' THEN ''
      ELSE '?' || ${retainedQuery}
    END
  `;
  const fallback = sql`regexp_replace(regexp_replace(lower(${textKey}), '[?#].*$', ''), '/+$', '')`;

  return sql`
    CASE
      WHEN ${textKey} ~* '^[a-z][a-z\\d+.-]*://[^/?#]+' THEN ${validUrl}
      ELSE ${fallback}
    END
  `;
}
