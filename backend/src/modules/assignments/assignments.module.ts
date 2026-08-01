import { Module } from '@nestjs/common';
import { DonationsModule } from '../donations/donations.module';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';

@Module({
  imports: [DonationsModule],
  controllers: [AssignmentsController],
  providers: [AssignmentsService],
})
export class AssignmentsModule {}
