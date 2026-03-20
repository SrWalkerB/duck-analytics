import { z } from 'zod';
import { createDashboardSchema } from './create-dashboard.dto';

export const updateDashboardSchema = createDashboardSchema.partial();
export type UpdateDashboardDto = z.infer<typeof updateDashboardSchema>;
