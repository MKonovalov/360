'use client';

import { useState } from 'react';
import { refreshCompanyCount } from '../app/actions';

export function RefreshCompanyCount({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);

  return (
    <div className="mt-4 flex items-center gap-3">
      <p className="text-sm text-slate-500">{count} companies (live).</p>
      <button
        type="button"
        className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        onClick={async () => {
          const next = await refreshCompanyCount();
          setCount(next);
        }}
      >
        Refresh
      </button>
    </div>
  );
}
