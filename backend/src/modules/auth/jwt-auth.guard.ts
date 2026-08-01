import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { SupabaseClient } from '@supabase/supabase-js';
import * as jwt from 'jsonwebtoken';
import { SUPABASE } from '../../lib/supabase.module';
import { IS_PUBLIC_KEY } from './decorators';
import type { AuthUser, UserRole } from './auth.types';

/**
 * Verifies the Supabase access token (HS256, signed with the project JWT secret)
 * locally — no network round-trip per request. The user's role is loaded from our
 * users table and cached for 60s to keep per-request DB load minimal.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private roleCache = new Map<string, { role: UserRole | null; at: number }>();

  constructor(
    private reflector: Reflector,
    private config: ConfigService,
    @Inject(SUPABASE) private supabase: SupabaseClient,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    if (!token) throw new UnauthorizedException('Missing bearer token');

    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, this.config.getOrThrow('SUPABASE_JWT_SECRET'), {
        algorithms: ['HS256'],
      }) as jwt.JwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user: AuthUser = {
      id: payload.sub as string,
      email: (payload.email as string) ?? '',
      role: await this.getRole(payload.sub as string),
    };
    req.user = user;
    return true;
  }

  private async getRole(userId: string): Promise<UserRole | null> {
    const cached = this.roleCache.get(userId);
    if (cached && Date.now() - cached.at < 60_000) return cached.role;

    const { data } = await this.supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    const role = (data?.role as UserRole) ?? null;
    this.roleCache.set(userId, { role, at: Date.now() });
    return role;
  }
}
