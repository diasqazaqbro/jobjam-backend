import { Module } from '@nestjs/common';
import { ApplicationController } from './application.controller';
import { ApplicationService } from './application.service';
import { DatabaseModule } from '../../shared/database/database.module';
import { OpenAIService } from '../../shared/services/openai.service';
import { HHApiService } from '../../shared/services/hh-api.service';
import { AuthModule } from '../../features/auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ApplicationController],
  providers: [ApplicationService, OpenAIService, HHApiService],
  exports: [ApplicationService],
})
export class ApplicationModule {}

