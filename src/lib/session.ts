import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { SessionPayload } from '@/features/auth/auth.types';

function getJwtKey() {
  const secretKey = process.env.JWT_SECRET;

  if (!secretKey) {
    throw new Error('Missing JWT_SECRET. Set it before running the application.');
  }

  return new TextEncoder().encode(secretKey);
}

export async function encrypt(payload: Omit<SessionPayload, 'exp'>) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d') // 1 day expiration
    .sign(getJwtKey());
}

export async function decrypt(input: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(input, getJwtKey(), {
    algorithms: ['HS256'],
  });
  return payload as unknown as SessionPayload;
}

export async function setSession(sessionPayload: Omit<SessionPayload, 'exp'>) {
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day
  const session = await encrypt(sessionPayload);

  const cookieStore = await cookies();
  cookieStore.set('session', session, {
    expires,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;

  if (!sessionCookie) return null;

  try {
    return await decrypt(sessionCookie);
  } catch {
    return null;
  }
}
