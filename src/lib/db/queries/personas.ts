import { eq } from 'drizzle-orm';
import { db } from '../index';
import { persona } from '../schema';

export async function listPersonas() {
  return db.select().from(persona);
}

// Used to resolve a CSV row's plain-text persona_name to a generated
// serial id during seeding (the CSV author doesn't know DB ids).
export async function getPersonaByName(name: string) {
  const rows = await db.select().from(persona).where(eq(persona.name, name));
  return rows[0];
}
