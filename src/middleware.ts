import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from '@/lib/session';

// Define public and protected routes
const publicRoutes = ['/login', '/register', '/auth/google', '/onboarding'];
const authRoutes = ['/owner', '/manager', '/tenant'];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  const isPublicRoute = publicRoutes.some(route => path.startsWith(route));
  const isProtectedRoute = authRoutes.some(route => path.startsWith(route));

  // Skip middleware for static files, API, and images
  if (path.startsWith('/_next') || path.startsWith('/api') || path.match(/\.(png|jpg|jpeg|gif|webp)$/)) {
    return NextResponse.next();
  }

  // Get session cookie
  const cookie = request.cookies.get('session')?.value;
  
  let session = null;
  if (cookie) {
    try {
      session = await decrypt(cookie);
    } catch {
      session = null;
    }
  }

  // Redirect unauthenticated users to login if trying to access protected routes
  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Role-based access control
  if (session && isProtectedRoute) {
    const rolePrefix = `/${session.role.toLowerCase()}`;
    
    // If the user tries to access a path assigned to another role
    if (!path.startsWith(rolePrefix)) {
      return NextResponse.redirect(new URL(`${rolePrefix}/dashboard`, request.url));
    }
  }

  // Redirect authenticated users away from public routes like /login
  if (session && isPublicRoute) {
    const rolePrefix = `/${session.role.toLowerCase()}`;
    return NextResponse.redirect(new URL(`${rolePrefix}/dashboard`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
