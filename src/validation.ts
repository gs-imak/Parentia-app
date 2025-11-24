import { z } from 'zod';

export const ParsedOutputSchema = z.object({
  summary: z.string(),
  items: z.array(z.string()),
  category: z.string(),
});

export type ParsedOutput = z.infer<typeof ParsedOutputSchema>;
