import { Controller, Post, Get, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AIApplicationQueueService } from './ai-application-queue.service';
import { Role } from '@prisma/client';

@Controller('ai-applications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.USER)
export class AIApplicationQueueController {
  constructor(private aiApplicationQueueService: AIApplicationQueueService) {}

  /**
   * Add application to queue (AI generation mode)
   * Perfect for swipe actions
   */
  @Post('queue')
  async addToQueue(
    @CurrentUser() user: any,
    @Body() data: { vacancyId: string; coverLetter?: string },
  ) {
    return this.aiApplicationQueueService.addToQueue(
      user.id,
      data.vacancyId,
      data.coverLetter,
    );
  }

  /**
   * Simple apply with existing resume (selection mode)
   * AI generates only cover letter
   */
  @Post('simple-apply')
  async simpleApply(
    @CurrentUser() user: any,
    @Body() data: { vacancyId: string; resumeId: string },
  ) {
    return this.aiApplicationQueueService.simpleApply(
      user.id,
      data.vacancyId,
      data.resumeId,
    );
  }

  /**
   * Get all user applications with queue status
   */
  @Get()
  async getMyApplications(@CurrentUser() user: any) {
    return this.aiApplicationQueueService.getUserApplications(user.id);
  }

  /**
   * Get single application status
   */
  @Get(':id')
  async getApplicationStatus(
    @CurrentUser() user: any,
    @Param('id') applicationId: string,
  ) {
    return this.aiApplicationQueueService.getApplicationStatus(applicationId, user.id);
  }

  /**
   * Get queue statistics
   */
  @Get('queue/stats')
  async getQueueStats() {
    return this.aiApplicationQueueService.getQueueStats();
  }

  /**
   * Cancel application (remove from queue)
   */
  @Delete(':id')
  async cancelApplication(
    @CurrentUser() user: any,
    @Param('id') applicationId: string,
  ) {
    return this.aiApplicationQueueService.cancelApplication(applicationId, user.id);
  }
}

