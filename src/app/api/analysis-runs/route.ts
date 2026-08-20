import { launchAnalysisRun } from '@/lib/analysis/launchAnalysisRun';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';

export async function POST(request: Request): Promise<Response> {
  const { userId } = await requireStaffAccess();
  return launchAnalysisRun({ request, userId, debugCaptureEnabled: false });
}
