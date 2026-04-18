'use client';

import React, { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Phone } from 'lucide-react';
import toast from 'react-hot-toast';

import { personalInfoSchema, PersonalInfoInput } from '../profile.validation';
import { updatePersonalProfileAction } from '../profile.actions';

interface PersonalInfoFormProps {
  initialData: {
    fullName: string;
    phone: string;
    email: string;
  };
}

export default function PersonalInfoForm({ initialData }: PersonalInfoFormProps) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<PersonalInfoInput>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      fullName: initialData.fullName || '',
      phone: initialData.phone || '',
    },
  });

  const onSubmit = (data: PersonalInfoInput) => {
    startTransition(async () => {
      const result = await updatePersonalProfileAction(data);

      if (result.success) {
        toast.success(result.message || 'Cập nhật thành công');
      } else {
        toast.error(result.message || 'Cập nhật thất bại');
        if (result.errors) {
          Object.entries(result.errors).forEach(([field, messages]) => {
            setError(field as keyof PersonalInfoInput, {
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="ml-1 text-[11px] font-black uppercase tracking-widest text-brand-muted">
            Họ và tên
          </label>
          <input
            type="text"
            className={`input-shell ${errors.fullName ? 'border-red-500 focus:ring-red-500' : ''}`}
            placeholder="Nguyễn Văn A"
            {...register('fullName')}
            disabled={isPending}
          />
          {errors.fullName && (
            <p className="ml-1 text-xs text-red-500">{errors.fullName.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <label className="ml-1 text-[11px] font-black uppercase tracking-widest text-brand-muted">
            Số điện thoại
          </label>
          <div className="relative">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-muted/50" />
            <input
              type="tel"
              className={`input-shell pl-11 ${errors.phone ? 'border-red-500 focus:ring-red-500' : ''}`}
              placeholder="09xx xxx xxx"
              {...register('phone')}
              disabled={isPending}
            />
          </div>
          {errors.phone && (
            <p className="ml-1 text-xs text-red-500">{errors.phone.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="ml-1 text-[11px] font-black uppercase tracking-widest text-brand-muted">
          Email đăng nhập
        </label>
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-muted/50" />
          <input
            type="email"
            className="input-shell pl-11 opacity-70 cursor-not-allowed"
            defaultValue={initialData.email}
            disabled
          />
        </div>
        <p className="ml-1 mt-2 text-[11px] font-bold text-brand-muted/70">
          Email này được gắn cố định với tài khoản và không thể thay đổi.
        </p>
      </div>

      <div className="pt-4 flex justify-end">
        <button
          type="submit"
          className="btn-primary w-full sm:w-auto px-10 py-3.5 disabled:opacity-50"
          disabled={isPending}
        >
          {isPending ? 'Đang lưu...' : 'Lưu thông tin'}
        </button>
      </div>
    </form>
  );
}
