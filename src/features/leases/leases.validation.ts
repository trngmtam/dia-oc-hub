import { z } from 'zod';

const idSchema = z
  .string()
  .trim()
  .min(1, 'Id is required')
  .regex(/^\d+$/, 'ID phải là chuỗi số');

const optionalMoneySchema = z.coerce
  .number()
  .min(0, 'Giá trị phải lớn hơn hoặc bằng 0');

const optionalTextSchema = z
  .string()
  .trim()
  .max(1000, 'Nội dung tối đa 1000 ký tự')
  .optional()
  .or(z.literal(''));

export const unitInviteSchema = z.object({
  unitId: idSchema,
});

export const requestUnitConnectionSchema = z.object({
  inviteCode: z
    .string()
    .trim()
    .min(8, 'Invite code is required')
    .max(64, 'Invite code is too long'),
});

export const rejectConnectionRequestSchema = z.object({
  requestId: idSchema,
  rejectionNote: optionalTextSchema,
});

export const getConnectionRequestSchema = z.object({
  requestId: idSchema,
});

export const approveUnitConnectionAndCreateLeaseSchema = z
  .object({
    requestId: idSchema,
    startDate: z.string().trim().min(1, 'Start date is required'),
    endDate: z.string().trim().min(1, 'End date is required'),
    dueDayOfMonth: z.coerce.number().int().min(1).max(28),
    baseRent: z.coerce.number().positive('Tiền thuê cơ bản phải lớn hơn 0'),
    depositAmount: optionalMoneySchema,
    managementFee: optionalMoneySchema,
    utilityNote: optionalTextSchema,
  })
  .refine((value) => new Date(value.endDate) > new Date(value.startDate), {
    message: 'Ngày kết thúc phải sau ngày bắt đầu',
    path: ['endDate'],
  });

export const requestEarlyTerminationSchema = z.object({
  leaseId: idSchema,
  note: optionalTextSchema,
});

export const executeLeaseTerminationSchema = z.object({
  leaseId: idSchema,
});

export type UnitInviteInput = z.infer<typeof unitInviteSchema>;
export type RequestUnitConnectionInput = z.infer<typeof requestUnitConnectionSchema>;
export type RejectConnectionRequestInput = z.infer<typeof rejectConnectionRequestSchema>;
export type GetConnectionRequestInput = z.infer<typeof getConnectionRequestSchema>;
export type ApproveUnitConnectionAndCreateLeaseInput = z.infer<
  typeof approveUnitConnectionAndCreateLeaseSchema
>;
export type RequestEarlyTerminationInput = z.infer<typeof requestEarlyTerminationSchema>;
export type ExecuteLeaseTerminationInput = z.infer<typeof executeLeaseTerminationSchema>;
