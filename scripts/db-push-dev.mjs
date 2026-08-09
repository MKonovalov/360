import { spawnSync } from 'node:child_process';

if (process.env.NODE_ENV !== 'development' || process.env.ALLOW_DB_PUSH !== '1') {
  console.error('db:push is development-only; set NODE_ENV=development and ALLOW_DB_PUSH=1 explicitly.');
  process.exitCode = 1;
} else {
  const result = spawnSync('drizzle-kit', ['push', '--config=drizzle.config.ts'], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
}
