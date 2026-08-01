import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as WebSocket from 'ws';

export const SUPABASE = 'SUPABASE_CLIENT';

/**
 * Single service-role Supabase client for the whole app.
 * service_role bypasses RLS — all authorization is enforced in our guards/services.
 */
@Global()
@Module({
  providers: [
    {
      provide: SUPABASE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): SupabaseClient =>
        createClient(
          config.getOrThrow<string>('SUPABASE_URL'),
          config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
          {
            auth: { persistSession: false },
            // Node 20 has no native WebSocket; realtime is unused server-side but
            // the client still initializes it, so provide the ws implementation.
            realtime: { transport: WebSocket as never },
          },
        ),
    },
  ],
  exports: [SUPABASE],
})
export class SupabaseModule {}
