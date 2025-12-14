import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { ApplicationService } from './application.service';
import { Role } from '@prisma/client';

@Controller('applications')
export class ApplicationController {
  constructor(private applicationService: ApplicationService) {}

  // User: Apply to vacancy
  @Post('apply')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER)
  async applyToVacancy(
    @CurrentUser() user: any,
    @Body() data: { vacancyId: string; resumeId: string; coverLetter?: string }
  ) {
    return this.applicationService.apply(user.id, data.vacancyId, data.resumeId, data.coverLetter);
  }

  // User: Apply to vacancy with AI-generated resume
  @Post('apply-with-ai')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER)
  async applyWithAI(
    @CurrentUser() user: any,
    @Body() data: { vacancyId: string; coverLetter?: string }
  ) {
    return this.applicationService.applyWithAI(user.id, data.vacancyId, data.coverLetter);
  }
}

