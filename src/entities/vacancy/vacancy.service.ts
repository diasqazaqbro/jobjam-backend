import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { Vacancy, VacancyStatus } from '@prisma/client';
import { HHApiService, HHVacancy } from '../../shared/services/hh-api.service';
import { AuthService } from '../../features/auth/auth.service';

@Injectable()
export class VacancyService {
  private readonly logger = new Logger(VacancyService.name);

  constructor(
    private prisma: PrismaService,
    private hhApiService: HHApiService,
    private authService: AuthService,
  ) {}

  async findById(id: string): Promise<Vacancy | null> {
    return this.prisma.vacancy.findUnique({
      where: { id },
      include: {
        employer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
            companyLogo: true,
            email: true,
            phone: true,
          },
        },
      },
    });
  }

  async findAll(filters?: {
    city?: string;
    salaryFrom?: number;
    employmentType?: string;
    skills?: string[];
    search?: string;
    userId?: string; // Required for fetching HH vacancies
    source?: 'jobjam' | 'hh' | 'all'; // Filter by source (now only 'hh' is used)
    page?: number;
    perPage?: number;
  }): Promise<{ items: Vacancy[]; total: number; page: number; perPage: number; pages: number }> {
    const page = filters?.page || 0;
    const perPage = filters?.perPage || 20;
    const source = filters?.source || 'hh'; // Default to HH only

    // Only get HH vacancies - require userId
    let hhVacancies: Vacancy[] = [];
    let hhTotal = 0;

    if (filters?.userId) {
      try {
        const hhAccessToken = await this.authService.getValidHhAccessToken(filters.userId);
        
        const hhParams: any = {
          page: page,
          per_page: perPage,
        };
        if (filters.city) hhParams.area = filters.city;
        if (filters.salaryFrom) hhParams.salary = filters.salaryFrom;
        if (filters.search) hhParams.text = filters.search;

        const hhResponse = await this.hhApiService.getVacancies(hhAccessToken, hhParams);
        hhTotal = hhResponse.found;
        
        // Convert HH vacancies to our format and get from DB or create
        hhVacancies = await Promise.all(
          hhResponse.items.map((hhVacancy) => this.upsertHhVacancy(hhVacancy)),
        );
      } catch (error) {
        this.logger.warn('Failed to fetch HH vacancies', error);
        // Return empty if HH API fails
      }
    } else {
      // No userId - return empty
      this.logger.warn('No userId provided for fetching HH vacancies');
    }

    const pages = Math.ceil(hhTotal / perPage);

    return {
      items: hhVacancies,
      total: hhTotal,
      page,
      perPage,
      pages,
    };
  }

  /**
   * Upsert HH vacancy (create if not exists, update if exists)
   */
  private async upsertHhVacancy(hhVacancy: HHVacancy): Promise<Vacancy> {
    const existing = await this.prisma.vacancy.findUnique({
      where: { hhVacancyId: hhVacancy.id },
    });

    const vacancyData = {
      hhVacancyId: hhVacancy.id,
      source: 'hh',
      title: hhVacancy.name,
      company: hhVacancy.employer?.name || 'Не указано',
      description: hhVacancy.description || '',
      requirements: hhVacancy.requirement || null,
      responsibilities: hhVacancy.responsibility || null,
      salaryFrom: hhVacancy.salary?.from || null,
      salaryTo: hhVacancy.salary?.to || null,
      salaryCurrency: hhVacancy.salary?.currency || 'KZT',
      city: hhVacancy.area?.name || 'Не указано',
      employmentType: hhVacancy.employment?.name || null,
      experienceLevel: hhVacancy.experience?.name || null,
      skills: hhVacancy.key_skills?.map((s) => s.name) || [],
      hhUrl: hhVacancy.alternate_url,
      hhPublishedAt: hhVacancy.published_at ? new Date(hhVacancy.published_at) : null,
      hhRawJson: hhVacancy as any,
      status: VacancyStatus.ACTIVE,
    };

    if (existing) {
      return this.prisma.vacancy.update({
        where: { id: existing.id },
        data: vacancyData,
      });
    } else {
      return this.prisma.vacancy.create({
        data: vacancyData,
      });
    }
  }

  async findByEmployer(employerId: string): Promise<Vacancy[]> {
    return this.prisma.vacancy.findMany({
      where: { employerId },
      include: {
        _count: {
          select: { applications: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(employerId: string, data: Partial<Vacancy>): Promise<Vacancy> {
    return this.prisma.vacancy.create({
      data: {
        ...data,
        employerId,
      } as any,
    });
  }

  async update(id: string, employerId: string, data: Partial<Vacancy>): Promise<Vacancy> {
    return this.prisma.vacancy.update({
      where: {
        id,
        employerId, // Ensure owner
      },
      data,
    });
  }

  async delete(id: string, employerId: string): Promise<void> {
    await this.prisma.vacancy.delete({
      where: {
        id,
        employerId,
      },
    });
  }

  async incrementViews(id: string): Promise<void> {
    await this.prisma.vacancy.update({
      where: { id },
      data: {
        viewsCount: {
          increment: 1,
        },
      },
    });
  }

  /**
   * Find vacancies similar to a resume
   */
  async findSimilarByResume(
    resumeId: string,
    filters?: {
      userId?: string;
      page?: number;
      perPage?: number;
      search?: string;
      city?: string;
      salaryFrom?: number;
      onlyWithSalary?: boolean;
    }
  ): Promise<{ items: Vacancy[]; total: number; page: number; perPage: number; pages: number }> {
    const page = filters?.page || 0;
    const perPage = filters?.perPage || 20;

    if (!filters?.userId) {
      throw new Error('User ID is required to fetch similar vacancies');
    }

    try {
      // Get HH access token
      const hhAccessToken = await this.authService.getValidHhAccessToken(filters.userId);
      if (!hhAccessToken) {
        throw new Error('HeadHunter access token not found');
      }

      // Prepare params for HH API
      const hhParams: any = {
        page,
        per_page: perPage,
      };

      if (filters.search) hhParams.text = filters.search;
      if (filters.city) hhParams.area = filters.city;
      if (filters.salaryFrom) hhParams.salary = filters.salaryFrom;
      if (filters.onlyWithSalary) hhParams.only_with_salary = true;

      // Fetch similar vacancies from HH
      const hhResponse = await this.hhApiService.getSimilarVacancies(
        hhAccessToken,
        resumeId,
        hhParams,
      );

      // Convert HH vacancies to our format and upsert to DB
      const vacancies = await Promise.all(
        hhResponse.items.map((hhVacancy: any) =>
          this.upsertHhVacancy(hhVacancy)
        )
      );

      return {
        items: vacancies,
        total: hhResponse.found,
        page: hhResponse.page,
        perPage: hhResponse.per_page,
        pages: hhResponse.pages,
      };
    } catch (error: any) {
      this.logger.error('Failed to fetch similar vacancies', error.message);
      throw new Error('Failed to fetch similar vacancies from HeadHunter');
    }
  }

  // Admin methods
  async adminDelete(id: string): Promise<void> {
    await this.prisma.vacancy.delete({
      where: { id },
    });
  }

  async adminUpdate(id: string, data: Partial<Vacancy>): Promise<Vacancy> {
    return this.prisma.vacancy.update({
      where: { id },
      data,
    });
  }
}
