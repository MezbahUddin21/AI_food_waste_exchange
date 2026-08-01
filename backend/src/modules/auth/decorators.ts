import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AuthUser, UserRole } from './auth.types';

export const IS_PUBLIC_KEY = 'isPublic';
/** Skip JWT auth for a route (health checks, etc.). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
/** Restrict a route to specific roles. Admin always passes. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Inject the authenticated user into a handler parameter. */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
