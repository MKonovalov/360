import { auth } from '@clerk/nextjs/server';
import { listCompanies } from '../lib/db/queries/companies';
import { RefreshCompanyCount } from '../components/RefreshCompanyCount';

// NOTE: this page intentionally does NOT call requireStaffAccess() — it
// stays public-with-a-conditional, matching the deleted index.astro's
// behavior of not redirecting anonymous visitors, just showing different
// text. This is the one documented exception to "always gate via
// requireStaffAccess()".
export default async function Home() {
  const { userId } = await auth();

  // The live DB read only happens for signed-in staff — anonymous visitors
  // must never trigger a database query.
  let signedInContent: React.ReactNode = null;
  if (userId) {
    const companies = await listCompanies();
    signedInContent = (
      <>
        <p className="mt-2 text-sm text-slate-500">
          {companies.length} companies loaded.
        </p>
        <RefreshCompanyCount initialCount={companies.length} />
      </>
    );
  }

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col justify-center px-6 py-16">
      <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold">ArcLumen 360</h1>
        {userId ? (
          signedInContent
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            Not signed in.{' '}
            <a className="text-indigo-600 underline" href="/sign-in">
              Sign in
            </a>
            .
          </p>
        )}
      </div>
    </main>
  );
}
