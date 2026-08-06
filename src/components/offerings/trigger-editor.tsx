'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createTriggerAction } from '@/app/actions/offerings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// OFR-05: single-field trigger creation on the Matrix tab. A Popover (not a
// Sheet) is proportionate for one text input. sortOrder is server-computed
// (T-30-03) — only { offeringId, triggerText } crosses the boundary; a tampered
// id still resolves through the DB FK on trigger.offering_id (T-30-06-03).
export function TriggerEditor({
  offeringId,
  trigger,
}: {
  offeringId: number;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [triggerText, setTriggerText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setTriggerText('');
      setError(null);
    }
  }

  const canSave = triggerText.trim().length > 0;

  function handleSubmit() {
    if (!canSave) return;

    startTransition(async () => {
      try {
        const result = await createTriggerAction({
          offeringId,
          triggerText: triggerText.trim(),
        });
        if (!result.ok) {
          // Generic copy only — never the Server Action's raw reason.
          setError('Could not save this trigger. Please try again.');
          return;
        }
        setOpen(false);
        setTriggerText('');
        router.refresh();
      } catch {
        setError('Could not save this trigger. Please try again.');
      }
    });
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent>
        <Input
          value={triggerText}
          onChange={(e) => setTriggerText(e.target.value)}
          placeholder="Trigger text"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSubmit}
            disabled={!canSave || pending}
          >
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
