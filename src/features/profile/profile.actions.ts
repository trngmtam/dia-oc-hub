'use server';

import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { personalInfoSchema, passwordSchema, PersonalInfoInput, PasswordUpdateInput } from './profile.validation';
import { ProfileActionResponse } from './profile.types';
import { revalidatePath } from 'next/cache';

export async function updatePersonalProfileAction(data: PersonalInfoInput): Promise<ProfileActionResponse> {
  const session = await getSession();
  if (!session) return { success: false, message: 'Chưa đăng nhập' };

  const parsed = personalInfoSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await prisma.user.update({
      where: { id: BigInt(session.userId) },
      data: {
        fullName: parsed.data.fullName,
        phone: parsed.data.phone || null,
      },
    });

    revalidatePath('/profile');
    
    return { success: true, message: 'Cập nhật thông tin thành công' };
  } catch (error) {
    console.error('updatePersonalProfileAction error:', error);
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return { success: false, errors: { phone: ['Số điện thoại đã được sử dụng'] } };
    }
    return { success: false, message: 'Không thể cập nhật thông tin' };
  }
}

export async function updatePasswordAction(data: PasswordUpdateInput): Promise<ProfileActionResponse> {
  const session = await getSession();
  if (!session) return { success: false, message: 'Chưa đăng nhập' };

  const parsed = passwordSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: BigInt(session.userId) },
    });

    if (!user) return { success: false, message: 'Tài khoản không tồn tại' };

    const passwordsMatch = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!passwordsMatch) {
      return { success: false, errors: { currentPassword: ['Mật khẩu hiện tại không chính xác'] } };
    }

    const newPasswordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    
    await prisma.user.update({
      where: { id: BigInt(session.userId) },
      data: { passwordHash: newPasswordHash },
    });

    return { success: true, message: 'Đổi mật khẩu thành công' };
  } catch (error) {
    console.error('updatePasswordAction error:', error);
    return { success: false, message: 'Không thể cập nhật mật khẩu' };
  }
}
