// Simple presentational card — Label-style caption above a Display-style
// number, matching the Start Page's 3-stat-card row (06-UI-SPEC.md Row 1).
export function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <p className="text-[12px] font-normal leading-[1.4] text-slate-500">{label}</p>
      <p className="text-[24px] font-semibold leading-[1.2] text-slate-900">{value}</p>
    </div>
  );
}
