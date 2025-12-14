import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { ProfileService, UserProfileData, Experience, Education } from './profile.service';
import { Role } from '@prisma/client';

@Controller('profile')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.USER)
export class ProfileController {
  constructor(private profileService: ProfileService) {}

  @Get()
  async getProfile(@CurrentUser() user: any) {
    return this.profileService.getOrCreateProfile(user.id);
  }

  @Put()
  async updateProfile(
    @CurrentUser() user: any,
    @Body() data: UserProfileData,
  ) {
    return this.profileService.updateProfile(user.id, data);
  }

  @Post('experience')
  async addExperience(
    @CurrentUser() user: any,
    @Body() experience: Experience,
  ) {
    return this.profileService.addExperience(user.id, experience);
  }

  @Delete('experience/:index')
  async removeExperience(
    @CurrentUser() user: any,
    @Param('index', ParseIntPipe) index: number,
  ) {
    return this.profileService.removeExperience(user.id, index);
  }

  @Put('education')
  async setEducation(
    @CurrentUser() user: any,
    @Body() education: Education,
  ) {
    return this.profileService.setEducation(user.id, education);
  }

  @Delete('education')
  async removeEducation(@CurrentUser() user: any) {
    return this.profileService.removeEducation(user.id);
  }

  @Post('import/:resumeId')
  async importFromResume(
    @CurrentUser() user: any,
    @Param('resumeId') resumeId: string,
  ) {
    return this.profileService.importFromResume(user.id, resumeId);
  }
}

