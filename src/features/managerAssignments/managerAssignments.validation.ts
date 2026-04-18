import { z } from 'zod';

const idSchema = z
  .string()
  .trim()
  .min(1, 'Id is required')
  .regex(/^\d+$/, 'ID phải là chuỗi số');

const optionalTextSchema = z
  .string()
  .trim()
  .max(1000, 'Nội dung tối đa 1000 ký tự')
  .optional()
  .or(z.literal(''));

export const propertyInviteSchema = z.object({
  propertyId: idSchema,
});

export const requestPropertyManagerAssignmentSchema = z.object({
  inviteCode: z
    .string()
    .trim()
    .min(8, 'Invite code is required')
    .max(64, 'Invite code is too long'),
});

export const managerAssignmentRequestDecisionSchema = z.object({
  requestId: idSchema,
  rejectionNote: optionalTextSchema,
});

export const ownerEndManagerAssignmentSchema = z.object({
  assignmentId: idSchema,
});

export const managerLeavePropertySchema = z.object({
  propertyId: idSchema,
});

export type PropertyInviteInput = z.infer<typeof propertyInviteSchema>;
export type RequestPropertyManagerAssignmentInput = z.infer<
  typeof requestPropertyManagerAssignmentSchema
>;
export type ManagerAssignmentRequestDecisionInput = z.infer<
  typeof managerAssignmentRequestDecisionSchema
>;
export type OwnerEndManagerAssignmentInput = z.infer<typeof ownerEndManagerAssignmentSchema>;
export type ManagerLeavePropertyInput = z.infer<typeof managerLeavePropertySchema>;
