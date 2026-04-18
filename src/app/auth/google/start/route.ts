import { NextRequest, NextResponse } from 'next/server';
import { beginGoogleAuth } from '@/features/auth/auth.actions';

export async function GET(request: NextRequest) {
  const response = await beginGoogleAuth({
    origin: request.nextUrl.origin,
  });

  if (!response.success || !response.data?.url) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set(
      'error',
      response.message || 'Đăng nhập Google chưa được cấu hình. Hãy thêm GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET.',
    );
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(response.data.url);
}
