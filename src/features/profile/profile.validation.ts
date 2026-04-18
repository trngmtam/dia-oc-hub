import { z } from 'zod';

export const personalInfoSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Họ tên phải có ít nhất 2 ký tự')
    .max(255, 'Họ tên tối đa 255 ký tự'),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9]{9,11}$/, 'Số điện thoại phải có từ 9 đến 11 chữ số')
    .optional()
    .or(z.literal('')),
});

export const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  newPassword: z
    .string()
    .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
    .regex(/[A-Za-z]/, 'Mật khẩu phải có ít nhất một chữ cái')
    .regex(/[0-9]/, 'Mật khẩu phải có ít nhất một chữ số'),
  confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu mới'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Mật khẩu xác nhận không khớp",
  path: ["confirmPassword"],
});

export type PersonalInfoInput = z.infer<typeof personalInfoSchema>;
export type PasswordUpdateInput = z.infer<typeof passwordSchema>;
