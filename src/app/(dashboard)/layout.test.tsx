import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const layoutSource = readFileSync(resolve(process.cwd(), 'src/app/(dashboard)/layout.tsx'), 'utf8');
const layoutCode = layoutSource
	.split('\n')
	.filter((line) => !line.trim().startsWith('//'))
	.join('\n');

// Regression guard: this layout used to mount its own
// DebugLaunchPreferenceProvider, but (dashboard) is only one of several
// sibling route trees under the app root (/companies, /personas sit
// outside it) -- a provider mounted here never survived navigation to
// those routes and got torn down (clearing sessionStorage) on every
// crossing. The single provider now mounts once at the true app root
// (src/app/layout.tsx / src/app/layout.test.tsx).
describe('DashboardLayout debug launch preference boundary', () => {
	it('does not mount its own DebugLaunchPreferenceProvider', () => {
		expect(layoutCode).not.toContain('DebugLaunchPreferenceProvider');
		expect(layoutCode).not.toContain('debugAdminConfig');
	});

	it('still gates the group behind requireStaffAccess and renders the shared AppShellLayout', () => {
		expect(layoutCode).toContain('await requireStaffAccess()');
		expect(layoutCode).toContain('<AppShellLayout>{children}</AppShellLayout>');
	});
});
