'use client';

import { useState } from 'react';
import { PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CompanyFormDialog } from '@/components/companies/company-form-dialog';

export function AddCompanyButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" aria-label="Add company" onClick={() => setOpen(true)}>
        <PlusIcon className="size-4" />
        Add
      </Button>
      <CompanyFormDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
