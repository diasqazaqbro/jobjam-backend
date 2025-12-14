import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './shared/database/database.module';
import { QueueModule } from './shared/queue/queue.module';
import { AuthModule } from './features/auth/auth.module';
import { UserModule } from './entities/user/user.module';
import { VacancyModule } from './entities/vacancy/vacancy.module';
import { ResumeModule } from './entities/resume/resume.module';
import { ApplicationModule } from './entities/application/application.module';
import { ProfileModule } from './entities/profile/profile.module';
import { AdminModule } from './features/admin/admin.module';
import { AIApplicationQueueModule } from './features/ai-application-queue/ai-application-queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    QueueModule,
    AuthModule,
    UserModule,
    VacancyModule,
    ResumeModule,
    ApplicationModule,
    ProfileModule,
    AdminModule,
    AIApplicationQueueModule,
  ],
})
export class AppModule {}
