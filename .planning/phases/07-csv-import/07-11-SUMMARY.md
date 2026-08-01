# Plan 11 Summary — ExplorerMenu href wiring + Import History route pages

## What was done

### 1. `src/components/explorer/explorer-menu.tsx`
- Added `href?: string` to the items prop type: `{ label: string; disabled?: boolean; href?: string }[]`
- Added `import Link from 'next/link'`
- Changed the `items.map` render: when `item.href && !item.disabled`, renders `<DropdownMenuItem asChild><Link href={item.href}>{item.label}</Link></DropdownMenuItem>`; otherwise renders the original `<DropdownMenuItem disabled={item.disabled}>{item.label}</DropdownMenuItem>` path unchanged (no regression for disabled/no-href items)

### 2. `src/app/companies/page.tsx`
- Changed `items={[{ label: 'Import', disabled: true }]}` → `items={[{ label: 'Import', href: '/companies/import' }]}`
- `disabled` key dropped entirely — item is now live

### 3. `src/app/personas/page.tsx`
- Same change: `items={[{ label: 'Import', href: '/personas/import' }]}`

### 4. `src/app/companies/import/history/page.tsx` (new)
- Async default export Server Component
- Calls `await requireStaffAccess()` first
- Calls `await listImportBatchesWithRollbackStatus('company')`
- Renders `<ImportHistoryTable batches={batches} entityType="company" />` inside a `p-8` shell with heading

### 5. `src/app/personas/import/history/page.tsx` (new)
- Identical pattern with `'persona'`

## Verification
- `npx tsc --noEmit` → clean (no output)
- `npm run build` → ✓ Compiled successfully; both `/companies/import/history` and `/personas/import/history` appear as `ƒ (Dynamic)` routes
- All 8 grep verification checks pass

## Files changed
- `src/components/explorer/explorer-menu.tsx` (edited)
- `src/app/companies/page.tsx` (edited)
- `src/app/personas/page.tsx` (edited)
- `src/app/companies/import/history/page.tsx` (created)
- `src/app/personas/import/history/page.tsx` (created)
