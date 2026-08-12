import { z as zodV3 } from 'zod/v3';

import type { BoundedOutputSchema } from './customAgentContracts';

function customOutputFieldModelSchema(field: BoundedOutputSchema['properties'][string]) {
  const primitive = field.type === 'string'
    ? zodV3.string().max(4_000)
    : field.type === 'number'
      ? zodV3.number().finite()
      : field.type === 'boolean'
        ? zodV3.boolean()
        : zodV3.array(
            field.items?.type === 'string'
              ? zodV3.string().max(4_000)
              : field.items?.type === 'number'
                ? zodV3.number().finite()
                : zodV3.boolean(),
          ).max(field.maxItems ?? 20);
  const withEnum = field.enum === undefined || field.type !== 'string'
    ? primitive
    : zodV3.string().max(4_000).refine((value) => field.enum?.includes(value) === true, 'enum_value');
  return field.nullable === true ? withEnum.nullable() : withEnum;
}

export function buildCustomModelOutputSchema(
  groundedModelOutputSchema: zodV3.AnyZodObject,
  customSchema: BoundedOutputSchema,
) {
  const customShape: Record<string, zodV3.ZodTypeAny> = {};
  for (const [name, field] of Object.entries(customSchema.properties)) {
    const valueSchema = customOutputFieldModelSchema(field);
    customShape[name] = customSchema.required.includes(name) ? valueSchema : valueSchema.optional();
  }

  return groundedModelOutputSchema.extend({
    custom: zodV3.object(customShape).strict(),
  });
}
