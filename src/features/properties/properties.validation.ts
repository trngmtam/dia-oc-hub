import { z } from 'zod';

export const propertyStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);

export const propertyBaseSchema = z.object({
  propertyCode: z
    .string()
    .trim()
    .min(1, 'Property code is required')
    .max(50, 'Mã tài sản tối đa 50 ký tự')
    .transform((value) => value.toUpperCase()),
  propertyName: z
    .string()
    .trim()
    .min(1, 'Property name is required')
    .max(255, 'Tên tài sản tối đa 255 ký tự'),
  addressLine: z
    .string()
    .trim()
    .min(1, 'Address is required')
    .max(255, 'Địa chỉ tối đa 255 ký tự'),
  ward: z
    .string()
    .trim()
    .max(100, 'Phường/xã tối đa 100 ký tự')
    .optional()
    .or(z.literal('')),
  district: z
    .string()
    .trim()
    .max(100, 'Quận/huyện tối đa 100 ký tự')
    .optional()
    .or(z.literal('')),
  city: z
    .string()
    .trim()
    .max(100, 'Tỉnh/thành phố tối đa 100 ký tự')
    .optional()
    .or(z.literal('')),
  propertyType: z
    .string()
    .trim()
    .max(50, 'Loại tài sản tối đa 50 ký tự')
    .optional()
    .or(z.literal('')),
  status: propertyStatusSchema.default('ACTIVE'),
});

export const createPropertySchema = propertyBaseSchema;

export const updatePropertySchema = propertyBaseSchema.extend({
  propertyId: z
    .string()
    .trim()
    .min(1, 'Property id is required')
    .regex(/^\d+$/, 'Mã tài sản phải là chuỗi số'),
});

export const deletePropertySchema = z.object({
  propertyId: z
    .string()
    .trim()
    .min(1, 'Property id is required')
    .regex(/^\d+$/, 'Mã tài sản phải là chuỗi số'),
});

export const getPropertyByIdSchema = z.object({
  propertyId: z
    .string()
    .trim()
    .min(1, 'Property id is required')
    .regex(/^\d+$/, 'Mã tài sản phải là chuỗi số'),
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type DeletePropertyInput = z.infer<typeof deletePropertySchema>;
export type GetPropertyByIdInput = z.infer<typeof getPropertyByIdSchema>;
