import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { RolesGuard } from './modules/auth/roles.guard';
import { DonationsModule } from './modules/donations/donations.module';
import { MatchingModule } from './modules/matching/matching.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { EmergencyModule } from './modules/emergency/emergency.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AdminModule } from './modules/admin/admin.module';
import { SupabaseModule } from './lib/supabase.module';

/** Unauthenticated liveness probe — also what Render pings to wake the service. */
@Controller('health')
class HealthController {
  @Get()
  health() {
    return { status: 'ok', ts: new Date().toISOString() };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    AuthModule,
    DonationsModule,
    MatchingModule,
    AssignmentsModule,
    EmergencyModule,
    NotificationsModule,
    AnalyticsModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [
    // Global: every route requires a valid Supabase JWT unless marked @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Global: role checks via @Roles(...) decorator.
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
