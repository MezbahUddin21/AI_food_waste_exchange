export type UserRole = 'donor' | 'ngo' | 'volunteer' | 'government' | 'admin';

/** Attached to request.user by JwtAuthGuard. */
export interface AuthUser {
  id: string; // Supabase auth.users.id == our users.id
  email: string;
  role: UserRole | null; // null until profile is registered
}
