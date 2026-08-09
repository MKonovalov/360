export type FixtureDatabaseUrl = Readonly<{ identity: string; marker: string }>;

export function parseFixtureDatabaseUrl(value: string | undefined): FixtureDatabaseUrl | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') return undefined;
    const hostname = url.hostname.replace(/-pooler(?=\.)/, '');
    return {
      identity: `${url.username}@${hostname}:${url.port}${url.pathname}`,
      marker: url.hash.slice(1),
    };
  } catch (error: unknown) {
    if (error instanceof TypeError) return undefined;
    throw error;
  }
}
