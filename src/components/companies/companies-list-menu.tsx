'use client';

import { useState } from 'react';
import { CompanyFormDialog } from '@/components/companies/company-form-dialog';
import { ExplorerMenu } from '@/components/explorer/explorer-menu';

// List-page Menu: Add (opens the create dialog) above Import and Settings.
export function CompaniesListMenu() {
  const [adding, setAdding] = useState(false);

  return (
    <>
      <ExplorerMenu
        variant="labeled"
        items={[
          { label: 'Add', onSelect: () => setAdding(true) },
          { label: 'Import', href: '/companies/import' },
          { label: 'Settings', href: '/settings' },
        ]}
      />
      <CompanyFormDialog open={adding} onClose={() => setAdding(false)} />
    </>
  );
}
