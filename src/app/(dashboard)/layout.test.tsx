import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const layoutSource = readFileSync(resolve(process.cwd(), 'src/app/(dashboard)/layout.tsx'), 'utf8');

describe('DashboardLayout capability boundary', () => {
	it('passes only a capability-derived remount key and boolean to the client provider', () => {
		// Given / When
		const providerOpening = layoutSource.match(/<DebugLaunchPreferenceProvider[^>]*>/u)?.[0] ?? '';

		// Then
		expect(providerOpening).toContain("key={canUseDebugLaunches ? 'debug-enabled' : 'debug-disabled'}");
		expect(providerOpening).toContain('canUseDebugLaunches={canUseDebugLaunches}');
		expect(providerOpening).not.toContain('userId');
		expect(providerOpening).not.toContain('authenticatedUserId');
		expect(providerOpening).not.toContain('debugAdminConfig');
	});
});
