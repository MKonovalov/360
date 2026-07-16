import { createClient } from '@sanity/client';

// Reads from PUBLIC_ env so it is safe on the client too if ever needed.
export const sanity = createClient({
  projectId: import.meta.env.PUBLIC_SANITY_PROJECT_ID,
  dataset: import.meta.env.PUBLIC_SANITY_DATASET,
  apiVersion: '2024-01-01',
  useCdn: false,
});

export interface ShortLinkRecord {
  _id: string;
  title: string;
  targetUrl: string;
  contactName?: string;
}
