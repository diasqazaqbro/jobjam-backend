import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { VacancyModule } from '../../entities/vacancy/vacancy.module';
import { UserModule } from '../../entities/user/user.module';

@Module({
  imports: [VacancyModule, UserModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

