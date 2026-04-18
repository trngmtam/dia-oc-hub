import { z } from 'zod';

export const alertTypes = [
  'OVERDUE_INVOICE',
  'LEASE_EXPIRING',
  'VACANT_UNIT',
  'PENDING_PAYMENT_REVIEW',
] as const;

export const idSchema = z
  .string()
  .trim()
  .min(1, 'Id is required')
  .regex(/^\d+$/, 'ID phải là chuỗi số');

export const listAlertsSchema = z.object({
  status: z.enum(['OPEN', 'RESOLVED', 'ALL']).default('OPEN'),
});

export const markAlertReadSchema = z.object({
  alertRecipientId: idSchema,
});

export type ListAlertsInput = z.infer<typeof listAlertsSchema>;
export type MarkAlertReadInput = z.infer<typeof markAlertReadSchema>;
export type AlertType = typeof alertTypes[number];
