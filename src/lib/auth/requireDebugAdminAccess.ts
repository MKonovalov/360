import { auth } from '@clerk/nextjs/server';
import { notFound } from 'next/navigation';

import { debugAdminConfig } from './debugAdminConfig';

export async function requireDebugAdminAccess(): Promise<{ readonly userId: string }> {
  const { userId } = await auth();
  if (
    !debugAdminConfig.captureEnabled
    || userId === null
    || !debugAdminConfig.adminUserIds.includes(userId)
  ) {
    notFound();
  }

  return { userId };
}
