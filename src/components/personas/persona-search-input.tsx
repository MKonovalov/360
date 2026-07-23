'use client';

import { useQueryState, parseAsString, debounce } from 'nuqs';
import { Input } from '@/components/ui/input';

// D-09: debounce the search box at ~300ms so a fast typist doesn't trigger a
// Server Component re-fetch on every keystroke; clearing the field (empty
// string) skips the debounce so results widen back out immediately.
export function PersonaSearchInput() {
  const [search, setSearch] = useQueryState(
    'search',
    parseAsString.withDefault('').withOptions({ shallow: false })
  );

  return (
    <Input
      placeholder="Search personas..."
      defaultValue={search}
      onChange={(e) =>
        setSearch(e.target.value || null, {
          limitUrlUpdates: e.target.value === '' ? undefined : debounce(300),
        })
      }
    />
  );
}
