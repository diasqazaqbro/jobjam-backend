import { Controller, Get, Post, Body, UseGuards, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { ResumeService } from './resume.service';
import { Role } from '@prisma/client';

@Controller('resumes')
export class ResumeController {
  constructor(private resumeService: ResumeService) {}

  // Get user's resumes
  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER)
  async getMyResumes(@CurrentUser() user: any) {
    return this.resumeService.getMyResumes(user.id);
  }

  // Sync resumes from HeadHunter
  @Post('sync-from-hh')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER)
  async syncFromHH(@CurrentUser() user: any) {
    return this.resumeService.syncResumesFromHH(user.id);
  }
}
