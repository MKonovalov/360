import { launchAnalysisRun } from '@/lib/analysis/launchAnalysisRun';
import { requireDebugAdminAccess } from '@/lib/auth/requireDebugAdminAccess';

export async function POST(request: Request): Promise<Response> {
  const { userId } = await requireDebugAdminAccess();
  return launchAnalysisRun({ request, userId, debugCaptureEnabled: true });
}
