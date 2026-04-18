import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { Role } from '@/features/auth/auth.types';

const GOOGLE_STATE_COOKIE = 'google_oauth_state';
const GOOGLE_ONBOARDING_COOKIE = 'google_onboarding';
const TEMP_COOKIE_DURATION_MS = 15 * 60 * 1000;

type GoogleOAuthStatePayload = {
  nonce: string;
  redirectTo?: string;
};

export type GoogleOnboardingPayload =
  | {
      mode: 'create';
      provider: 'google';
      providerAccountId: string;
      providerEmail: string;
      fullName: string;
    }
  | {
      mode: 'link';
      provider: 'google';
      providerAccountId: string;
      providerEmail: string;
      fullName: string;
      existingUserId: string;
      existingRole: Role;
      existingFullName: string;
      existingStatus: string;
    };

export function isGoogleAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function getOAuthKey() {
  const secretKey = process.env.JWT_SECRET;

  if (!secretKey) {
    throw new Error('Missing JWT_SECRET. Set it before running the application.');
  }

  return new TextEncoder().encode(secretKey);
}

async function signTemporaryToken<T extends Record<string, unknown>>(payload: T) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(getOAuthKey());
}

async function verifyTemporaryToken<T>(token: string): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, getOAuthKey(), {
      algorithms: ['HS256'],
    });

    return payload as unknown as T;
  } catch {
    return null;
  }
}

async function setTemporaryCookie(name: string, token: string) {
  const cookieStore = await cookies();
  cookieStore.set(name, token, {
    expires: new Date(Date.now() + TEMP_COOKIE_DURATION_MS),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

async function getTemporaryCookie<T>(name: string) {
  const cookieStore = await cookies();
  const value = cookieStore.get(name)?.value;
  if (!value) return null;

  return await verifyTemporaryToken<T>(value);
}

async function clearTemporaryCookie(name: string) {
  const cookieStore = await cookies();
  cookieStore.delete(name);
}

export async function setGoogleOAuthState(payload: GoogleOAuthStatePayload) {
  const token = await signTemporaryToken(payload);
  await setTemporaryCookie(GOOGLE_STATE_COOKIE, token);
}

export async function getGoogleOAuthState() {
  return await getTemporaryCookie<GoogleOAuthStatePayload>(GOOGLE_STATE_COOKIE);
}

export async function clearGoogleOAuthState() {
  await clearTemporaryCookie(GOOGLE_STATE_COOKIE);
}

export async function setGoogleOnboardingPayload(payload: GoogleOnboardingPayload) {
  const token = await signTemporaryToken(payload);
  await setTemporaryCookie(GOOGLE_ONBOARDING_COOKIE, token);
}

export async function getGoogleOnboardingPayload() {
  return await getTemporaryCookie<GoogleOnboardingPayload>(GOOGLE_ONBOARDING_COOKIE);
}

export async function clearGoogleOnboardingPayload() {
  await clearTemporaryCookie(GOOGLE_ONBOARDING_COOKIE);
}

export function buildGoogleRedirectUri(origin: string) {
  return process.env.GOOGLE_REDIRECT_URI || `${origin}/auth/google/callback`;
}
