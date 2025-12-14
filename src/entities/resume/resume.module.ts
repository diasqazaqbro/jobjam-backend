import { Module } from '@nestjs/common';
import { ResumeService } from './resume.service';
import { ResumeController } from './resume.controller';
import { DatabaseModule } from '../../shared/database/database.module';
import { AuthModule } from '../../features/auth/auth.module';
import { HHApiService } from '../../shared/services/hh-api.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ResumeController],
  providers: [ResumeService, HHApiService],
  exports: [ResumeService],
})
export class ResumeModule {}

