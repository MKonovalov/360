import { Badge } from '@/components/ui/badge';

// UI-SPEC lock: all 4 buying-signal types share ONE neutral "attention"
// badge style (amber-100/amber-800) — the signal type is carried in the
// label text, never color-coded per type. Do not introduce a distinct
// hue per signal type here.
const SIGNAL_TYPE_LABELS: Record<string, string> = {
  cost_pressure: 'Cost Pressure',
  immature_gbs_org: 'Immature GBS Org',
  new_cfo_or_gbs_head: 'New CFO/GBS Head',
  transformation_announcement: 'Transformation Announcement',
};

export function SignalBadge({ signalType }: { signalType: string }) {
  const label = SIGNAL_TYPE_LABELS[signalType] ?? signalType;

  return (
    <Badge className="bg-amber-100 text-amber-800 text-[12px] font-normal leading-[1.4] [a]:hover:bg-amber-100">
      {label}
    </Badge>
  );
}
