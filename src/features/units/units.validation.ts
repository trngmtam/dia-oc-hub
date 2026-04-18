import { z } from 'zod';

const nullableDecimalInput = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return Number.NaN;
    return parsed;
  })
  .refine((value) => value === null || (!Number.isNaN(value) && value >= 0), {
    message: 'Giá trị phải là số không âm',
  });

export const createUnitSchema = z.object({
  propertyId: z
    .string()
    .trim()
    .min(1, 'Property id is required')
    .regex(/^\d+$/, 'Mã tài sản phải là chuỗi số'),
  unitCode: z
    .string()
    .trim()
    .min(1, 'Unit code is required')
    .max(50, 'Mã căn hộ tối đa 50 ký tự')
    .transform((value) => value.toUpperCase()),
  unitName: z
    .string()
    .trim()
    .max(255, 'Tên căn hộ tối đa 255 ký tự')
    .optional()
    .or(z.literal('')),
  floorNumber: z.coerce.number().int().optional(),
  bedroomCount: z.coerce.number().int().optional(),
  bathroomCount: z.coerce.number().int().optional(),
  areaSqm: nullableDecimalInput,
  furnishingStatus: z
    .string()
    .trim()
    .max(50, 'Tình trạng nội thất tối đa 50 ký tự')
    .optional()
    .or(z.literal('')),
  defaultMonthlyRent: nullableDecimalInput,
  defaultDeposit: nullableDecimalInput,
});

export const updateUnitSchema = createUnitSchema.extend({
  unitId: z
    .string()
    .trim()
    .min(1, 'Unit id is required')
    .regex(/^\d+$/, 'Mã căn hộ phải là chuỗi số'),
});

export const deleteUnitSchema = z.object({
  unitId: z
    .string()
    .trim()
    .min(1, 'Unit id is required')
    .regex(/^\d+$/, 'Mã căn hộ phải là chuỗi số'),
});

export const getUnitsByPropertyIdSchema = z.object({
  propertyId: z
    .string()
    .trim()
    .min(1, 'Property id is required')
    .regex(/^\d+$/, 'Mã tài sản phải là chuỗi số'),
});

export const getUnitByIdSchema = z.object({
  propertyId: z
    .string()
    .trim()
    .min(1, 'Property id is required')
    .regex(/^\d+$/, 'Mã tài sản phải là chuỗi số'),
  unitId: z
    .string()
    .trim()
    .min(1, 'Unit id is required')
    .regex(/^\d+$/, 'Mã căn hộ phải là chuỗi số'),
});

export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
export type DeleteUnitInput = z.infer<typeof deleteUnitSchema>;
export type GetUnitsByPropertyIdInput = z.infer<typeof getUnitsByPropertyIdSchema>;
export type GetUnitByIdInput = z.infer<typeof getUnitByIdSchema>;
