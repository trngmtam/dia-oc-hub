import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu phải chứa ít nhất 6 ký tự'),
});

export type LoginInput = z.infer<typeof loginSchema>;
const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{9,11}$/, 'Số điện thoại phải có từ 9 đến 11 chữ số');

const passwordSchema = z
  .string()
  .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
  .regex(/[A-Za-z]/, 'Mật khẩu phải có ít nhất một chữ cái')
  .regex(/[0-9]/, 'Mật khẩu phải có ít nhất một chữ số');

export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Họ tên phải có ít nhất 2 ký tự')
    .max(255, 'Họ tên tối đa 255 ký tự'),
  email: z.string().trim().email('Email không hợp lệ'),
  phone: phoneSchema,
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;

const selfServeRoleSchema = z.enum(['OWNER', 'MANAGER', 'TENANT']);

export const completeGoogleOnboardingSchema = z.object({
  role: selfServeRoleSchema,
  phone: phoneSchema,
});

export const confirmGoogleAccountLinkSchema = z.object({
  confirmed: z.literal(true),
});

export type CompleteGoogleOnboardingInput = z.infer<typeof completeGoogleOnboardingSchema>;
export type ConfirmGoogleAccountLinkInput = z.infer<typeof confirmGoogleAccountLinkSchema>;
