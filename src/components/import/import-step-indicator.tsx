import { CircleCheckIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// The four visible wizard screens (07-UI-SPEC.md "Wizard shell"). The
// underlying Server Actions are 5 calls — validate and commit both live on the
// "Validate & Confirm" screen — so this list intentionally does not mirror the
// action names one-for-one.
export type ImportStep = 'upload' | 'map' | 'validate' | 'done';

const STEPS: { id: ImportStep; label: string }[] = [
  { id: 'upload', label: 'Upload' },
  { id: 'map', label: 'Map' },
  { id: 'validate', label: 'Validate & Confirm' },
  { id: 'done', label: 'Done' },
];

// Forward-only progress indicator — v1 has no back-navigation between steps
// (07-UI-SPEC.md resolves 07-RESEARCH.md Open Question #2 this way), so the
// pills are deliberately non-interactive: `pointer-events-none` keeps the
// Badge primitive's hover affordance from implying a click target that does
// nothing.
export function ImportStepIndicator({ currentStep }: { currentStep: ImportStep }) {
  const currentIndex = STEPS.findIndex((step) => step.id === currentStep);

  return (
    <ol className="flex flex-wrap items-center" aria-label="Import progress">
      {STEPS.map((step, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <li
            key={step.id}
            className="flex items-center"
            aria-current={isCurrent ? 'step' : undefined}
          >
            {index > 0 ? (
              <span aria-hidden="true" className="mx-2 h-px w-8 shrink-0 bg-slate-200" />
            ) : null}
            <Badge
              variant="ghost"
              className={cn(
                // Label role (12px/400) — overrides the Badge base's
                // text-xs/font-medium so the indicator stays inside the app's
                // 4-role / 2-weight type system.
                'pointer-events-none rounded-4xl border-b-2 border-b-transparent text-[12px] leading-[1.4] font-normal',
                isComplete && 'text-slate-500',
                isCurrent && 'border-b-indigo-600 text-indigo-600',
                !isComplete && !isCurrent && 'text-slate-400'
              )}
            >
              {isComplete ? <CircleCheckIcon className="text-slate-400" aria-hidden="true" /> : null}
              {step.label}
            </Badge>
          </li>
        );
      })}
    </ol>
  );
}
