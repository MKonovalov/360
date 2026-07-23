import { auth } from '@clerk/nextjs/server';

// NOTE: this page intentionally does NOT call requireStaffAccess() — it
// stays public-with-a-conditional, matching the deleted index.astro's
// behavior of not redirecting anonymous visitors, just showing different
// text. This is the one documented exception to "always gate via
// requireStaffAccess()".
export default async function Home() {
  const { userId } = await auth();

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col justify-center px-6 py-16">
      <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold">ArcLumen 360</h1>
        {userId ? (
          <p className="mt-2 text-sm text-slate-500">
            Signed in (staff). Dashboard data loads here in 01-04.
          </p>
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
