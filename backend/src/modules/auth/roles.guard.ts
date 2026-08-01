import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './decorators';
import type { AuthUser, UserRole } from './auth.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required?.length) return true;

    const user: AuthUser | undefined = ctx.switchToHttp().getRequest().user;
    if (!user) return false; // public route with @Roles makes no sense; deny
    if (user.role === 'admin') return true; // admin passes everything
    if (!user.role || !required.includes(user.role)) {
      throw new ForbiddenException(`Requires role: ${required.join(' or ')}`);
    }
    return true;
  }
}
