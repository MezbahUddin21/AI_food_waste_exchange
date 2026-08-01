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
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { SUPABASE } from '../../lib/supabase.module';
import { IS_PUBLIC_KEY } from './decorators';
import type { AuthUser, UserRole } from './auth.types';

/**
 * Verifies Supabase access tokens locally — no network round-trip per request.
 *
 * Newer Supabase projects sign with asymmetric keys (ES256/RS256); we verify
 * those against the project's public JWKS endpoint (fetched once and cached by
 * jose). Older projects sign HS256 with the legacy JWT secret, which we fall
 * back to if configured. The user's role is loaded from our users table and
 * cached for 60s to keep per-request DB load minimal.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private roleCache = new Map<string, { role: UserRole | null; at: number }>();
  private jwks: ReturnType<typeof createRemoteJWKSet>;
  private hsSecret?: Uint8Array;

  constructor(
    private reflector: Reflector,
    config: ConfigService,
    @Inject(SUPABASE) private supabase: SupabaseClient,
  ) {
    const url = config.getOrThrow<string>('SUPABASE_URL');
    this.jwks = createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`));
    const secret = config.get<string>('SUPABASE_JWT_SECRET');
    if (secret) this.hsSecret = new TextEncoder().encode(secret);
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    if (!token) throw new UnauthorizedException('Missing bearer token');

    const payload = await this.verify(token);

    const user: AuthUser = {
      id: payload.sub as string,
      email: (payload.email as string) ?? '',
      role: await this.getRole(payload.sub as string),
    };
    req.user = user;
    return true;
  }

  private async verify(token: string): Promise<JWTPayload> {
    // Asymmetric (ES256/RS256) — the default on current Supabase projects.
    try {
      const { payload } = await jwtVerify(token, this.jwks);
      return payload;
    } catch (jwksErr) {
      // Legacy HS256 fallback if a JWT secret is configured.
      if (this.hsSecret) {
        try {
          const { payload } = await jwtVerify(token, this.hsSecret, {
            algorithms: ['HS256'],
          });
          return payload;
        } catch {
          /* fall through to unified error */
        }
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
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
    // Only cache real roles: a null means "not registered yet", and caching it
    // would 403 the user for 60s right after they complete registration.
    if (role) this.roleCache.set(userId, { role, at: Date.now() });
    return role;
  }
}
