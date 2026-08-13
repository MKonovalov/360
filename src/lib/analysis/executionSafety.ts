import { z } from 'zod';

const safeToolItemSchema = z
  .object({
    url: z.url().max(2_048),
    title: z.string().max(500),
    snippet: z.string().max(8_000),
  })
  .strict();

export type SafeToolItem = z.infer<typeof safeToolItemSchema>;
type StepLike = Readonly<{ toolResults?: readonly { toolName?: string; output?: unknown }[] }>;

export function safeToolResults(
  steps: readonly StepLike[],
  limits: Readonly<{ maxSources: number; maxSourceBytes: number; maxExcerptBytes: number }>,
): readonly SafeToolItem[] {
  const items: SafeToolItem[] = [];
  let sourceBytes = 0;
  for (const step of steps) {
    for (const result of step.toolResults ?? []) {
      if (result.toolName !== 'webSearch') throw new Error('invalid_tool_policy');
      if (!Array.isArray(result.output)) throw new Error('invalid_tool_policy');
      for (const item of result.output) {
        const parsed = safeToolItemSchema.safeParse(item);
        if (!parsed.success) throw new Error('invalid_tool_policy');
        if (parsed.data.snippet.length > limits.maxExcerptBytes) throw new Error('invalid_tool_policy');
        if (/(?:ignore\s+(?:all\s+)?previous|system\s+message|private\s+reasoning|api[_ -]?key|database_url|clerk[_ -]?session)/i.test(`${parsed.data.title}\n${parsed.data.snippet}`)) {
          throw new Error('unsafe_research_content');
        }
        const itemBytes = Buffer.byteLength(`${parsed.data.title}\n${parsed.data.snippet}`, 'utf8');
        if (items.length >= limits.maxSources || sourceBytes + itemBytes > limits.maxSourceBytes) return items;
        items.push(parsed.data);
        sourceBytes += itemBytes;
      }
    }
  }
  return items;
}
