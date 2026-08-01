import { Module } from '@nestjs/common';
import { MlClient } from '../../lib/ml.client';
import { DonationsController } from './donations.controller';
import { DonationsService } from './donations.service';

@Module({
  controllers: [DonationsController],
  providers: [DonationsService, MlClient],
  exports: [DonationsService, MlClient],
})
export class DonationsModule {}
