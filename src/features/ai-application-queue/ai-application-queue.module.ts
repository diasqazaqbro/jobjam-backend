import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AIApplicationQueueService, AI_APPLICATION_QUEUE } from './ai-application-queue.service';
import { AIApplicationProcessor } from './ai-application.processor';
import { AIApplicationQueueController } from './ai-application-queue.controller';
import { DatabaseModule } from '../../shared/database/database.module';
import { OpenAIService } from '../../shared/services/openai.service';
import { HHApiService } from '../../shared/services/hh-api.service';
import { AuthModule } from '../auth/auth.module';
import { ProfileModule } from '../../entities/profile/profile.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    ProfileModule,
    BullModule.registerQueue({
      name: AI_APPLICATION_QUEUE,
    }),
  ],
  controllers: [AIApplicationQueueController],
  providers: [
    AIApplicationQueueService,
    AIApplicationProcessor,
    OpenAIService,
    HHApiService,
  ],
  exports: [AIApplicationQueueService],
})
export class AIApplicationQueueModule {}

