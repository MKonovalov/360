// Active-route detection for the sidebar nav, extracted as a pure function
// so the /companies/[id] highlight can never be silently broken by a
// drive-by "simplification" (QLTY-01; PITFALLS Pitfall 7). The key is the
// ROUTE segment ('personas'), not the visible label ('Key Personas').

export type NavKey = 'start' | 'companies' | 'personas' | 'reviews' | 'signals' | 'offerings' | 'settings';

export function getActiveNavKey(pathname: string): NavKey | null {
  if (pathname === '/') return 'start'; // exact — every route is a prefix match for '/'
  // Boundary guard: sibling prefixes like /companies-archive must not match.
  if (pathname === '/companies' || pathname.startsWith('/companies/')) return 'companies';
  if (pathname === '/personas' || pathname.startsWith('/personas/')) return 'personas';
  if (pathname === '/reviews' || pathname.startsWith('/reviews/')) return 'reviews';
  // Prefix-match style mirrors /companies — /signals/<id> detail routes ship
  // in later plans; the boundary guard below still rejects /signals-archive.
  if (pathname === '/signals' || pathname.startsWith('/signals/')) return 'signals';
  // Same prefix-match style as /signals — a future /offerings/[id] detail
  // route still highlights, while the boundary guard rejects /offerings-archive.
  if (pathname === '/offerings' || pathname.startsWith('/offerings/')) return 'offerings';
  // /settings is a leaf page with no detail routes — exact match only, so a
  // sibling prefix like /settings-archive can never false-highlight it.
  if (pathname === '/settings') return 'settings';
  return null; // /sign-in, '', unknown
}
