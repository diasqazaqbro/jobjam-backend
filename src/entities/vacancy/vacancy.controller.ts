import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { VacancyService } from './vacancy.service';

@Controller('vacancies')
export class VacancyController {
  constructor(private vacancyService: VacancyService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getAllVacancies(
    @Query('city') city?: string,
    @Query('salaryFrom') salaryFrom?: string,
    @Query('employmentType') employmentType?: string,
    @Query('skills') skills?: string,
    @Query('search') search?: string,
    @Query('source') source?: 'jobjam' | 'hh' | 'all',
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @CurrentUser() user?: any,
  ) {
    const filters: any = {
      source: 'hh', // Always HH
      userId: user?.id, // Required for HH API
    };
    
    if (city) filters.city = city;
    if (salaryFrom) filters.salaryFrom = parseInt(salaryFrom);
    if (employmentType) filters.employmentType = employmentType;
    if (skills) filters.skills = skills.split(',');
    if (search) filters.search = search;
    if (page) filters.page = parseInt(page);
    if (perPage) filters.perPage = parseInt(perPage);

    return this.vacancyService.findAll(filters);
  }

  @Get('similar/:resumeId')
  @UseGuards(JwtAuthGuard)
  async getSimilarVacancies(
    @Param('resumeId') resumeId: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('search') search?: string,
    @Query('city') city?: string,
    @Query('salaryFrom') salaryFrom?: string,
    @Query('onlyWithSalary') onlyWithSalary?: string,
    @CurrentUser() user?: any,
  ) {
    const filters: any = {
      userId: user?.id,
      page: page ? parseInt(page) : 0,
      perPage: perPage ? parseInt(perPage) : 20,
    };

    if (search) filters.search = search;
    if (city) filters.city = city;
    if (salaryFrom) filters.salaryFrom = parseInt(salaryFrom);
    if (onlyWithSalary === 'true') filters.onlyWithSalary = true;

    return this.vacancyService.findSimilarByResume(resumeId, filters);
  }

}
