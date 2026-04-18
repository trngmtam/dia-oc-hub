import { z } from 'zod';

export const idSchema = z
  .string()
  .trim()
  .min(1, 'Id is required')
  .regex(/^\d+$/, 'ID phải là chuỗi số');

const moneySchema = z.coerce
  .number()
  .min(0, 'Số tiền phải lớn hơn hoặc bằng 0')
  .max(999999999999, 'Amount is too large');

const positiveMoneySchema = z.coerce
  .number()
  .positive('Số tiền phải lớn hơn 0')
  .max(999999999999, 'Amount is too large');

export const billingMonthSchema = z.object({
  billingYear: z.coerce.number().int().min(2000).max(2100),
  billingMonth: z.coerce.number().int().min(1).max(12),
  propertyId: idSchema.optional().or(z.literal('')),
});

export const createMonthlyInvoicesSchema = z.object({
  billingYear: z.coerce.number().int().min(2000).max(2100),
  billingMonth: z.coerce.number().int().min(1).max(12),
  propertyId: idSchema.optional().or(z.literal('')),
  invoices: z
    .array(
      z.object({
        leaseId: idSchema,
        utilityAmount: moneySchema.default(0),
        otherFeeAmount: moneySchema.default(0),
      })
    )
    .min(1, 'Cần ít nhất một hóa đơn'),
});

export const createSingleInvoiceSchema = z.object({
  leaseId: idSchema,
  billingYear: z.coerce.number().int().min(2000).max(2100),
  billingMonth: z.coerce.number().int().min(1).max(12),
  utilityAmount: moneySchema.default(0),
  otherFeeAmount: moneySchema.default(0),
});

export const listInvoicesSchema = z.object({
  billingYear: z.coerce.number().int().min(2000).max(2100).optional(),
  billingMonth: z.coerce.number().int().min(1).max(12).optional(),
  propertyId: idSchema.optional().or(z.literal('')),
  status: z
    .enum(['ALL', 'UNPAID', 'PENDING_REVIEW', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'])
    .default('ALL'),
});

export const paymentReviewSchema = z.object({
  paymentId: idSchema,
  verificationNote: z
    .string()
    .trim()
    .max(1000, 'Ghi chú tối đa 1000 ký tự')
    .optional()
    .or(z.literal('')),
});

export const signedProofUrlSchema = z.object({
  paymentId: idSchema,
});

export const receivingAccountSchema = z.object({
  propertyId: idSchema,
  bankCode: z.string().trim().min(1, 'Bank code is required').max(50),
  bankName: z.string().trim().min(1, 'Bank name is required').max(255),
  accountNumber: z.string().trim().min(1, 'Account number is required').max(100),
  accountName: z.string().trim().min(1, 'Account name is required').max(255),
  transferNoteTemplate: z
    .string()
    .trim()
    .max(255, 'Transfer note template is too long')
    .optional()
    .or(z.literal('')),
});

export const submitPaymentProofSchema = z.object({
  invoiceId: idSchema,
  paidAmount: positiveMoneySchema,
  paymentMethod: z.enum(['BANK_TRANSFER_QR', 'BANK_TRANSFER_MANUAL', 'CASH']),
  transferReference: z.string().trim().max(100).optional().or(z.literal('')),
  paymentNote: z.string().trim().max(1000).optional().or(z.literal('')),
});

export type BillingMonthInput = z.infer<typeof billingMonthSchema>;
export type CreateMonthlyInvoicesInput = z.infer<typeof createMonthlyInvoicesSchema>;
export type CreateSingleInvoiceInput = z.infer<typeof createSingleInvoiceSchema>;
export type ListInvoicesInput = z.infer<typeof listInvoicesSchema>;
export type PaymentReviewInput = z.infer<typeof paymentReviewSchema>;
export type SignedProofUrlInput = z.infer<typeof signedProofUrlSchema>;
export type ReceivingAccountInput = z.infer<typeof receivingAccountSchema>;
export type SubmitPaymentProofInput = z.infer<typeof submitPaymentProofSchema>;
