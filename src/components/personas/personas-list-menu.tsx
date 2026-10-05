'use client';

import { useState } from 'react';
import { ExplorerMenu } from '@/components/explorer/explorer-menu';
import { PersonaFormDialog } from '@/components/personas/persona-form-dialog';

// List-page Menu: Add (opens the create dialog) above Import and Settings.
export function PersonasListMenu() {
  const [adding, setAdding] = useState(false);

  return (
    <>
      <ExplorerMenu
        variant="labeled"
        items={[
          { label: 'Add', onSelect: () => setAdding(true) },
          { label: 'Import', href: '/personas/import' },
          { label: 'Settings', href: '/settings' },
        ]}
      />
      <PersonaFormDialog open={adding} onClose={() => setAdding(false)} />
    </>
  );
}
