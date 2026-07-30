import { Skeleton } from '@/components/ui/skeleton';

// Suspense fallback for /personas — shadcn Skeleton rows matching the
// Table's 48px row-height minimum (UI-SPEC "List row minimum height").
export default function PersonasLoading() {
  return (
    <div className="p-8">
      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
