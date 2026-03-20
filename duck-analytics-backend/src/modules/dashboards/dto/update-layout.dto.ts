import { z } from 'zod';

export const updateLayoutSchema = z.object({
  layout: z.array(
    z.object({
      id: z.string(),
      x: z.number(),
      y: z.number(),
      w: z.number(),
      h: z.number(),
    }),
  ),
});

export type UpdateLayoutDto = z.infer<typeof updateLayoutSchema>;
