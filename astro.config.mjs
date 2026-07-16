import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel/serverless';
import tailwind from '@astrojs/tailwind';
import clerk from '@clerk/astro';

// output:'server' is REQUIRED: cookies (Clerk __session) only work under SSR,
// never on a static build.
export default defineConfig({
  output: 'server',
  adapter: vercel(),
  site: 'https://360.arclumenpartners.com',
  integrations: [tailwind(), clerk()],
});
