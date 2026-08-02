import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

// ANLZ-04: per-company pending-proposal count badge on the Company detail
// panel. Presentational — the caller (company-detail.tsx) fetches the count
// server-side and passes it in. Renders nothing when the queue is empty (an
// empty queue earns no visual noise, UI-SPEC §3). Links to /reviews — the
// badge is the detail panel's doorway to the queue.
export function ProposalBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <Link href="/reviews">
      <Badge className="bg-amber-100 text-amber-800 text-[12px] font-normal leading-[1.4] [a]:hover:bg-amber-100">
        {count} pending
      </Badge>
    </Link>
  );
}
