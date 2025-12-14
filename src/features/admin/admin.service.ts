import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { VacancyService } from '../../entities/vacancy/vacancy.service';
import { UserService } from '../../entities/user/user.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private vacancyService: VacancyService,
    private userService: UserService,
  ) {}

  async getStats() {
    const [usersCount, employersCount, vacanciesCount, resumesCount, applicationsCount] =
      await Promise.all([
        this.prisma.user.count({ where: { role: 'USER' } }),
        this.prisma.user.count({ where: { role: 'EMPLOYER' } }),
        this.prisma.vacancy.count(),
        this.prisma.resume.count(),
        this.prisma.application.count(),
      ]);

    return {
      usersCount,
      employersCount,
      vacanciesCount,
      resumesCount,
      applicationsCount,
    };
  }

  async getAllUsers(filters?: { role?: string }) {
    return this.userService.findAll(filters as any);
  }

  async deleteUser(id: string) {
    return this.userService.delete(id);
  }

  async updateUser(id: string, data: any) {
    return this.userService.update(id, data);
  }

  async getAllVacancies() {
    return this.prisma.vacancy.findMany({
      include: {
        employer: {
          select: {
            id: true,
            companyName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteVacancy(id: string) {
    return this.vacancyService.adminDelete(id);
  }

  async updateVacancy(id: string, data: any) {
    return this.vacancyService.adminUpdate(id, data);
  }
}

