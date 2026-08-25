import { sql, type SQL } from 'drizzle-orm';

function searchApprovalEcmaWhitespace(): SQL<unknown> {
  return sql`
    chr(9) || chr(10) || chr(11) || chr(12) || chr(13) || chr(32) || chr(133) || chr(160) || chr(5760)
    || chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196) || chr(8197) || chr(8198)
    || chr(8199) || chr(8200) || chr(8201) || chr(8202) || chr(8232) || chr(8233) || chr(8239)
    || chr(8287) || chr(12288) || chr(65279)
  `;
}

function searchApprovalTextKey(value: SQL<unknown>): SQL<unknown> {
  const whitespace = searchApprovalEcmaWhitespace();
  return sql`regexp_replace(
    btrim(normalize(${value}, NFKC), ${whitespace}),
    '[' || ${whitespace} || ']+',
    ' ',
    'g'
  )`;
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
  const withoutWww = sql`regexp_replace(${withoutScheme}, '^www\\.', '')`;
  const withoutPath = sql`regexp_replace(${withoutWww}, '[/:?#].*$', '')`;
  const validHost = sql`regexp_replace(${withoutPath}, ':\\d+$', '')`;
  const validDomain = sql`regexp_replace(${validHost}, '\\.$', '')`;
  const fallback = sql`regexp_replace(${withoutWww}, '[/.]+$', '')`;
  const hasUserInfo = sql`
    ${textKey} ~* '^[a-z][a-z\\d+.-]*://[^/?#]*@'
    OR ${textKey} ~ '^[^/?#]*@'
  `;
  const isAscii = sql`octet_length(${textKey}) = length(${textKey})`;
  const isSupportedUrl = sql`
    ${isAscii}
    AND NOT (${hasUserInfo})
    AND ${textKey} ~* '^(?:[a-z][a-z\\d+.-]*://)?[^\\s/?#:]+(?::\\d+)?(?:[/?#].*)?$'
  `;
  return sql`
    CASE
      WHEN ${textKey} IS NULL THEN NULL
      WHEN NOT ${isAscii} OR ${hasUserInfo} THEN NULL
      WHEN ${isSupportedUrl} THEN ${validDomain}
      ELSE ${fallback}
    END
  `;
}

function searchApprovalFormSupported(value: SQL<unknown>): SQL<unknown> {
  const component = sql`COALESCE(${value}, '')`;
  return sql`
    octet_length(${component}) = length(${component})
    AND ${component} !~ '[[:cntrl:]]'
    AND ${component} !~ '%([^0-9A-Fa-f]|$)'
    AND ${component} !~ '%[0-9A-Fa-f]$'
    AND ${component} !~* '%[89A-Fa-f][0-9A-Fa-f]'
    AND ${component} !~* '%00'
  `;
}

function searchApprovalFormDecoded(value: SQL<unknown>): SQL<unknown> {
  const component = sql`COALESCE(${value}, '')`;
  const supported = searchApprovalFormSupported(value);
  return sql`(
    CASE WHEN ${supported} THEN (
      SELECT COALESCE(
        convert_from(
          decode(
            COALESCE(
              string_agg(
                CASE
                  WHEN token = '+' THEN '20'
                  WHEN token ~ '^%[0-9A-Fa-f]{2}$' THEN upper(substring(token FROM 2))
                  ELSE encode(convert_to(token, 'UTF8'), 'hex')
                END,
                '' ORDER BY ordinal
              ),
              ''
            ),
            'hex'
          ),
          'UTF8'
        ),
        ''
      )
      FROM regexp_matches(${component}, '(%[0-9A-Fa-f]{2}|.|\\n|\\r)', 'g')
        WITH ORDINALITY AS query_token(groups, ordinal)
      CROSS JOIN LATERAL (SELECT groups[1] AS token) token_value
    ) ELSE NULL END
  )`;
}

function searchApprovalFormEncoded(value: SQL<unknown>): SQL<unknown> {
  return sql`(
    SELECT COALESCE(
      string_agg(
        CASE
          WHEN token = ' ' THEN '+'
          WHEN token ~ '^[A-Za-z0-9*._-]$' THEN token
          ELSE (
            SELECT string_agg('%' || upper(substring(hex_value FROM byte_offset FOR 2)), '')
            FROM generate_series(1, length(hex_value), 2) AS byte_position(byte_offset)
          )
        END,
        '' ORDER BY ordinal
      ),
      ''
    )
    FROM (
      SELECT groups[1] AS token, ordinal, encode(convert_to(groups[1], 'UTF8'), 'hex') AS hex_value
      FROM regexp_matches(COALESCE(${value}, ''), '(.|\\n|\\r)', 'g')
        WITH ORDINALITY AS query_token(groups, ordinal)
    ) encoded_token
  )`;
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
  const linkedinBase = canonicalBase;
  const query = sql`NULLIF(substring(${hashless} FROM '\\?([^#]*)$'), '')`;
  const querySupported = sql`${query} IS NULL OR ${searchApprovalFormSupported(query)}`;
  const urlBaseSupported = sql`
    ${urlBase} ~* '^https?://[A-Za-z0-9._-]+(?:/[^?#]*)?$'
    AND octet_length(${urlBase}) = length(${urlBase})
    AND ${urlBase} !~ '[[:space:]]'
    AND ${urlBase} !~ '(^|/)\\.{1,2}(/|$)'
    AND ${urlBase} !~* '%([^0-9A-Fa-f]|$)'
    AND ${urlBase} !~* '%[0-9A-Fa-f]$'
    AND ${urlBase} !~* '%[89A-Fa-f][0-9A-Fa-f]'
    AND ${urlBase} !~* '%2e'
  `;
  const retainedQuery = sql`(
    WITH raw_parameters AS (
      SELECT parameter, ordinal,
        split_part(parameter, '=', 1) AS raw_key,
        CASE WHEN strpos(parameter, '=') = 0 THEN '' ELSE substring(parameter FROM strpos(parameter, '=') + 1) END AS raw_value,
        strpos(parameter, '=') > 0 AS has_equals
      FROM regexp_split_to_table(COALESCE(${query}, ''), '&') WITH ORDINALITY
        AS query_parameter(parameter, ordinal)
      WHERE parameter <> ''
    ),
    decoded_parameters AS (
      SELECT parameter, ordinal, has_equals,
        ${searchApprovalFormDecoded(sql`raw_key`)} AS parameter_key,
        ${searchApprovalFormDecoded(sql`raw_value`)} AS parameter_value
      FROM raw_parameters
    ),
    encoded_parameters AS (
      SELECT
        ${searchApprovalFormEncoded(sql`parameter_key`)} || '=' || ${searchApprovalFormEncoded(sql`parameter_value`)} AS parameter,
        parameter_key,
        ordinal
      FROM decoded_parameters
      WHERE lower(parameter_key) NOT LIKE 'utm_%'
        AND lower(parameter_key) NOT IN ('fbclid', 'gclid', 'dclid', 'msclkid', 'mc_cid', 'mc_eid', 'trk')
    )
    SELECT string_agg(parameter, '&' ORDER BY parameter_key COLLATE "C", ordinal)
    FROM encoded_parameters
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
      WHEN ${urlBaseSupported} AND ${querySupported} THEN ${validUrl}
      WHEN ${textKey} ~* '^[a-z][a-z\\d+.-]*://' THEN NULL
      ELSE ${fallback}
    END
  `;
}

export function searchApprovalLinkedInMatchKey(value: SQL<unknown>): SQL<unknown> {
  const canonical = searchApprovalLinkedInKey(value);
  return sql`
    regexp_replace(
      regexp_replace(${canonical}, '^https://www\\.linkedin\\.com', 'https://linkedin.com'),
      '^http://www\\.linkedin\\.com',
      'http://linkedin.com'
    )
  `;
}
