import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { User, Role } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async create(data: {
    email: string;
    password?: string;
    firstName: string;
    lastName: string;
    role: Role;
    phone?: string;
    companyName?: string;
    companyDescription?: string;
    companyWebsite?: string;
    companyLogo?: string;
    hhId?: string | null;
    hhAccessToken?: string | null;
    hhRefreshToken?: string | null;
    hhExpiresAt?: Date | null;
  }): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({
      where: { id },
    });
  }

  async findAll(filters?: { role?: Role }): Promise<Partial<User>[]> {
    return this.prisma.user.findMany({
      where: filters,
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        phone: true,
        companyName: true,
        createdAt: true,
        password: false,
        avatarUrl: false,
        companyDescription: false,
        companyWebsite: false,
        companyLogo: false,
        updatedAt: false,
      },
    });
  }

  async findByHhId(hhId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { hhId },
    });
  }

  async createFromHh(data: {
    hhId: string;
    email: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    phone?: string;
    role: Role;
    hhAccessToken: string;
    hhRefreshToken: string;
    hhExpiresAt: Date;
    companyName?: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        hhId: data.hhId,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: data.role,
        hhAccessToken: data.hhAccessToken,
        hhRefreshToken: data.hhRefreshToken,
        hhExpiresAt: data.hhExpiresAt,
        companyName: data.companyName,
      },
    });
  }

  async updateHhTokens(
    userId: string,
    data: {
      hhAccessToken?: string;
      hhRefreshToken?: string;
      hhExpiresAt?: Date;
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      role?: Role;
      companyName?: string;
    },
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.hhAccessToken && { hhAccessToken: data.hhAccessToken }),
        ...(data.hhRefreshToken && { hhRefreshToken: data.hhRefreshToken }),
        ...(data.hhExpiresAt && { hhExpiresAt: data.hhExpiresAt }),
        ...(data.firstName && { firstName: data.firstName }),
        ...(data.lastName && { lastName: data.lastName }),
        ...(data.email && { email: data.email }),
        ...(data.phone && { phone: data.phone }),
        ...(data.role && { role: data.role }),
        ...(data.companyName && { companyName: data.companyName }),
      },
    });
  }
}
