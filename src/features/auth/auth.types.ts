export type Role = 'OWNER' | 'MANAGER' | 'TENANT' | 'ADMIN';

export interface SessionPayload {
  userId: string;
  email: string;
  role: Role;
  exp: number;
}

export type AuthActionResponse<T = null> = {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  data?: T;
};
