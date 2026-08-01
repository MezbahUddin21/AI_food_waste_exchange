import { Module } from '@nestjs/common';
import { DonationsModule } from '../donations/donations.module';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';

@Module({
  imports: [DonationsModule],
  controllers: [MatchingController],
  providers: [MatchingService],
})
export class MatchingModule {}
