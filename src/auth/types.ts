export type AuthRole = 'admin' | 'user';

export interface AuthUser {
  login: string;
  roles: AuthRole[];
}

export interface SessionPayload {
  login: string;
  roles: AuthRole[];
  exp: number;
}
