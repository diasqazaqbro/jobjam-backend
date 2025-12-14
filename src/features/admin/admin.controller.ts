import { Controller, Get, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { Role } from '@prisma/client';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('stats')
  async getStats() {
    return this.adminService.getStats();
  }

  // Users management
  @Get('users')
  async getUsers(@Query('role') role?: string) {
    return this.adminService.getAllUsers(role ? { role } : undefined);
  }

  @Put('users/:id')
  async updateUser(@Param('id') id: string, @Body() data: any) {
    return this.adminService.updateUser(id, data);
  }

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  // Vacancies management
  @Get('vacancies')
  async getVacancies() {
    return this.adminService.getAllVacancies();
  }

  @Put('vacancies/:id')
  async updateVacancy(@Param('id') id: string, @Body() data: any) {
    return this.adminService.updateVacancy(id, data);
  }

  @Delete('vacancies/:id')
  async deleteVacancy(@Param('id') id: string) {
    return this.adminService.deleteVacancy(id);
  }
}

