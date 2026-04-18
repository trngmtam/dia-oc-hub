import { NextRequest, NextResponse } from 'next/server';
import { handleGoogleCallback } from '@/features/auth/auth.actions';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');

  if (!code || !state) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'Google không trả về đủ thông tin đăng nhập');
    return NextResponse.redirect(loginUrl);
  }

  const response = await handleGoogleCallback({
    origin: request.nextUrl.origin,
    code,
    state,
  });

  if (!response.success || !response.data?.redirectTo) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', response.message || 'Không thể hoàn tất đăng nhập Google');
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(new URL(response.data.redirectTo, request.url));
}
