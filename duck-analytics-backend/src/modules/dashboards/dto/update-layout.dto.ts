import { z } from 'zod';

export const updateLayoutSchema = z.object({
  layout: z.array(
    z.object({
      id: z.string(),
      x: z.number(),
      y: z.number(),
      w: z.number(),
      h: z.number(),
      tabId: z.string().optional().nullable(),
      title: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
    }),
  ),
});

export type UpdateLayoutDto = z.infer<typeof updateLayoutSchema>;
