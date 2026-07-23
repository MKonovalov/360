import { pgTable, pgEnum, serial, text, integer, boolean, date, timestamp } from 'drizzle-orm/pg-core';

// D-07: fixed-but-extensible enum, seeded with the 4 known signal types.
// Adding a 5th type is a `drizzle-kit generate` migration (ALTER TYPE ... ADD VALUE),
// not a schema redesign.
export const signalTypeEnum = pgEnum('signal_type', [
  'cost_pressure',
  'immature_gbs_org',
  'new_cfo_or_gbs_head',
  'transformation_announcement',
]);

// D-05: 3-tier strength, not a numeric score.
export const signalStrengthEnum = pgEnum('signal_strength', ['low', 'medium', 'high']);

export const company = pgTable('company', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  industry: text('industry'),
  // ... remaining firmographic fields land in Phase 2 per COMP-01
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const persona = pgTable('persona', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  title: text('title'),
  // ... remaining Persona fields land in Phase 3 per PERS-01..04
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// DATA-03: typed, dated, sourced signal record — never free text.
export const signal = pgTable('signal', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull().references(() => company.id),
  signalType: signalTypeEnum('signal_type').notNull(),
  strength: signalStrengthEnum('strength').notNull(), // D-05
  source: text('source'), // e.g. "manual", a URL, future enrichment-API name
  detectedAt: date('detected_at').notNull(), // when the signal was TRUE, not when entered
  note: text('note'), // D-06: supplementary free text alongside typed fields
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// DATA-02: many-to-many Company<->Persona with date-range metadata,
// supports "previous companies" (career history) from day one.
export const companyPersonaRole = pgTable('company_persona_role', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull().references(() => company.id),
  personaId: integer('persona_id').notNull().references(() => persona.id),
  title: text('title'),
  isCurrent: boolean('is_current').notNull().default(false),
  startDate: date('start_date'),
  endDate: date('end_date'),
});
