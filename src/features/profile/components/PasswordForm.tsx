'use client';

import React, { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';

import { passwordSchema, PasswordUpdateInput } from '../profile.validation';
import { updatePasswordAction } from '../profile.actions';

export default function PasswordForm() {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<PasswordUpdateInput>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = (data: PasswordUpdateInput) => {
    startTransition(async () => {
      const result = await updatePasswordAction(data);
      
      if (result.success) {
        toast.success(result.message || 'Đổi mật khẩu thành công');
        reset();
      } else {
        toast.error(result.message || 'Đổi mật khẩu thất bại');
        if (result.errors) {
          Object.entries(result.errors).forEach(([field, messages]) => {
            setError(field as keyof PasswordUpdateInput, {
              type: 'server',
              message: messages[0],
            });
          });
        }
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <label className="ml-1 text-[11px] font-black uppercase tracking-widest text-brand-muted">
          Mật khẩu hiện tại
        </label>
        <input 
          type="password" 
          className={`input-shell ${errors.currentPassword ? 'border-red-500 focus:ring-red-500' : ''}`}
          placeholder="••••••••" 
          {...register('currentPassword')}
          disabled={isPending}
        />
        {errors.currentPassword && (
          <p className="ml-1 text-xs text-red-500">{errors.currentPassword.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="ml-1 text-[11px] font-black uppercase tracking-widest text-brand-muted">
            Mật khẩu mới
          </label>
          <input 
            type="password" 
            className={`input-shell ${errors.newPassword ? 'border-red-500 focus:ring-red-500' : ''}`}
            placeholder="••••••••" 
            {...register('newPassword')}
            disabled={isPending}
          />
          {errors.newPassword && (
            <p className="ml-1 text-xs text-red-500">{errors.newPassword.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <label className="ml-1 text-[11px] font-black uppercase tracking-widest text-brand-muted">
            Xác nhận mật khẩu mới
          </label>
          <input 
            type="password" 
            className={`input-shell ${errors.confirmPassword ? 'border-red-500 focus:ring-red-500' : ''}`}
            placeholder="••••••••" 
            {...register('confirmPassword')}
            disabled={isPending}
          />
          {errors.confirmPassword && (
            <p className="ml-1 text-xs text-red-500">{errors.confirmPassword.message}</p>
          )}
        </div>
      </div>

      <div className="pt-4 flex justify-end">
        <button 
          type="submit" 
          className="btn-secondary w-full sm:w-auto px-10 py-3.5 disabled:opacity-50"
          disabled={isPending}
        >
          {isPending ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
        </button>
      </div>
    </form>
  );
}
