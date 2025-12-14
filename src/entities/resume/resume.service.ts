import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { Resume, ResumeStatus } from '@prisma/client';
import { HHApiService } from '../../shared/services/hh-api.service';
import { AuthService } from '../../features/auth/auth.service';

@Injectable()
export class ResumeService {
  private readonly logger = new Logger(ResumeService.name);

  constructor(
    private prisma: PrismaService,
    private hhApiService: HHApiService,
    private authService: AuthService,
  ) {}

  async findById(id: string, userId?: string): Promise<Resume | null> {
    // If userId provided and resume looks like HH ID (long string), try to get from HH API
    if (userId && id.length > 20) {
      try {
        const hhAccessToken = await this.authService.getValidHhAccessToken(userId);
        const hhResume = await this.hhApiService.getResume(hhAccessToken, id);
        
        // Convert HH resume to our format
        return {
          id: hhResume.id,
          userId,
          title: hhResume.title || '',
          firstName: hhResume.first_name || '',
          lastName: hhResume.last_name || '',
          email: hhResume.contact?.find((c: any) => c.type === 'email')?.value || '',
          phone: hhResume.contact?.find((c: any) => c.type === 'cell')?.value || '',
          city: hhResume.area?.name || '',
          position: hhResume.title || '',
          salary: hhResume.salary?.amount || null,
          skills: hhResume.skill_set || [],
          status: hhResume.status?.id === 'published' ? 'ACTIVE' : 'DRAFT',
          createdAt: hhResume.created_at ? new Date(hhResume.created_at) : new Date(),
          updatedAt: hhResume.updated_at ? new Date(hhResume.updated_at) : new Date(),
          hhResumeId: hhResume.id,
          hhUrl: hhResume.alternate_url,
          hhRawJson: hhResume,
        } as any;
      } catch (error) {
        this.logger.warn('Failed to fetch HH resume, falling back to local', error);
      }
    }

    // Fallback to local resume
    return this.prisma.resume.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async findByUser(userId: string): Promise<Resume[]> {
    // First, try to get resumes from HH API
    try {
      const hhAccessToken = await this.authService.getValidHhAccessToken(userId);
      const hhResumes = await this.hhApiService.getResumes(hhAccessToken);
      
      // Convert HH resumes to our format
      return hhResumes.items.map((hhResume: any) => ({
        id: hhResume.id,
        userId,
        title: hhResume.title || '',
        firstName: hhResume.first_name || '',
        lastName: hhResume.last_name || '',
        email: hhResume.contact?.find((c: any) => c.type === 'email')?.value || '',
        phone: hhResume.contact?.find((c: any) => c.type === 'cell')?.value || '',
        city: hhResume.area?.name || '',
        position: hhResume.title || '',
        salary: hhResume.salary?.amount || null,
        skills: hhResume.skill_set || [],
        status: hhResume.status?.id === 'published' ? 'ACTIVE' : 'DRAFT',
        createdAt: hhResume.created_at ? new Date(hhResume.created_at) : new Date(),
        updatedAt: hhResume.updated_at ? new Date(hhResume.updated_at) : new Date(),
        // HH specific fields
        hhResumeId: hhResume.id,
        hhUrl: hhResume.alternate_url,
        hhRawJson: hhResume,
      } as any));
    } catch (error) {
      this.logger.warn('Failed to fetch HH resumes, falling back to local resumes', error);
      // Fallback to local resumes if HH API fails
      return this.prisma.resume.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
    }
  }

  async findAll(filters?: {
    city?: string;
    position?: string;
    skills?: string[];
  }): Promise<Resume[]> {
    const where: any = {
      status: ResumeStatus.ACTIVE,
    };

    if (filters?.city) {
      where.city = { contains: filters.city, mode: 'insensitive' };
    }

    if (filters?.position) {
      where.position = { contains: filters.position, mode: 'insensitive' };
    }

    if (filters?.skills && filters.skills.length > 0) {
      where.skills = { hasSome: filters.skills };
    }

    return this.prisma.resume.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async create(userId: string, data: Partial<Resume>): Promise<Resume> {
    return this.prisma.resume.create({
      data: {
        ...data,
        userId,
      } as any,
    });
  }

  async update(id: string, userId: string, data: Partial<Resume>): Promise<Resume> {
    // Check if this is a HH resume (ID is long string or has hhResumeId)
    const existingResume = await this.findById(id, userId);
    
    if (existingResume && (id.length > 20 || (existingResume as any).hhResumeId)) {
      // Update via HH API
      const hhResumeId = (existingResume as any).hhResumeId || id;
      const hhAccessToken = await this.authService.getValidHhAccessToken(userId);
      
      // Get current resume from HH to preserve existing data
      let currentHhResume: any = {};
      try {
        currentHhResume = await this.hhApiService.getResume(hhAccessToken, hhResumeId);
      } catch (error) {
        this.logger.warn('Failed to get current HH resume, using provided data only', error);
      }

      // Convert our format to HH API format
      // Only include fields that are provided (partial update)
      const hhResumeData: any = {
        resume: {
          ...(data.title || data.position ? { title: data.title || data.position } : {}),
          ...(data.skills ? { 
            skill_set: Array.isArray(data.skills) 
              ? data.skills as string[]
              : (typeof data.skills === 'string' ? (data.skills as string).split(',').map((s: string) => s.trim()) : [])
          } : {}),
          ...(data.salary !== undefined ? {
            salary: data.salary ? {
              amount: typeof data.salary === 'number' ? data.salary : parseInt(data.salary as any),
              currency: 'KZT',
            } : null,
          } : {}),
        },
        profile: {
          ...(data.firstName ? { first_name: data.firstName } : {}),
          ...(data.lastName ? { last_name: data.lastName } : {}),
          ...(data.birthDate ? { birth_date: new Date(data.birthDate).toISOString().split('T')[0] } : {}),
        },
      };

      // Merge with existing data if available
      if (currentHhResume.resume) {
        hhResumeData.resume = {
          ...currentHhResume.resume,
          ...hhResumeData.resume,
        };
      }
      if (currentHhResume.profile) {
        hhResumeData.profile = {
          ...currentHhResume.profile,
          ...hhResumeData.profile,
        };
      }

      // Update via HH API
      const updatedHhResume = await this.hhApiService.updateResumeProfile(
        hhAccessToken,
        hhResumeId,
        hhResumeData,
      );

      // Return updated resume in our format
      const updatedResume = updatedHhResume.resume || updatedHhResume;
      const updatedProfile = updatedHhResume.profile || {};
      
      return {
        id: updatedResume.id,
        userId,
        title: updatedResume.title || '',
        firstName: updatedProfile.first_name || updatedResume.first_name || '',
        lastName: updatedProfile.last_name || updatedResume.last_name || '',
        email: updatedResume.contact?.[0]?.value || updatedResume.contact?.find((c: any) => c.type === 'email')?.value || '',
        phone: updatedResume.contact?.[1]?.value || updatedResume.contact?.find((c: any) => c.type === 'cell')?.value || '',
        city: updatedResume.area?.name || '',
        position: updatedResume.title || '',
        salary: updatedResume.salary?.amount || null,
        skills: updatedResume.skill_set || [],
        status: updatedResume.status?.id === 'published' ? 'ACTIVE' : 'DRAFT',
        createdAt: updatedResume.created_at ? new Date(updatedResume.created_at) : new Date(),
        updatedAt: updatedResume.updated_at ? new Date(updatedResume.updated_at) : new Date(),
        hhResumeId: updatedResume.id,
        hhUrl: updatedResume.alternate_url,
        hhRawJson: updatedResume,
      } as any;
    }

    // Fallback to local update
    return this.prisma.resume.update({
      where: {
        id,
        userId,
      },
      data,
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.prisma.resume.delete({
      where: {
        id,
        userId,
      },
    });
  }

  /**
   * Get user's resumes (from HH API and DB)
   */
  async getMyResumes(userId: string): Promise<any[]> {
    // Get resumes from HH API
    const hhResumes = await this.findByUser(userId);
    
    // Auto-sync: Save HH resumes to DB if not exists
    try {
      for (const hhResume of hhResumes) {
        if (!hhResume.hhResumeId) continue; // Skip local-only resumes
        
        const existing = await this.prisma.resume.findFirst({
          where: {
            userId,
            hhResumeId: hhResume.hhResumeId,
          },
        });

        if (!existing) {
          // Save to DB
          await this.prisma.resume.create({
            data: {
              userId,
              title: hhResume.title || 'Резюме',
              firstName: hhResume.firstName || '',
              lastName: hhResume.lastName || '',
              email: hhResume.email || '',
              phone: hhResume.phone || '',
              city: hhResume.city || 'Алматы',
              position: hhResume.position || '',
              salary: hhResume.salary || null,
              skills: hhResume.skills || [],
              about: null,
              status: hhResume.status === 'ACTIVE' ? ResumeStatus.ACTIVE : ResumeStatus.DRAFT,
              experience: (hhResume.hhRawJson as any)?.experience ? JSON.stringify((hhResume.hhRawJson as any).experience) : null,
              education: (hhResume.hhRawJson as any)?.education ? JSON.stringify((hhResume.hhRawJson as any).education) : null,
              hhResumeId: hhResume.hhResumeId,
              hhUrl: hhResume.hhUrl,
              hhRawJson: hhResume.hhRawJson as any,
            },
          });
          this.logger.log(`✅ Авто-синхронизация: сохранено ${hhResume.title} (${hhResume.hhResumeId})`);
        }
      }
    } catch (error: any) {
      this.logger.warn('Auto-sync failed, but continuing:', error.message);
    }
    
    return hhResumes;
  }

  /**
   * Sync resumes from HeadHunter to local DB
   */
  async syncResumesFromHH(userId: string): Promise<{ synced: number; skipped: number; resumes: any[] }> {
    this.logger.log(`🔄 Синхронизация резюме с HH для пользователя ${userId}`);
    
    try {
      const hhAccessToken = await this.authService.getValidHhAccessToken(userId);
      const hhResumes = await this.hhApiService.getResumes(hhAccessToken);
      
      this.logger.log(`📥 Получено ${hhResumes.items.length} резюме с HH`);

      let synced = 0;
      let skipped = 0;
      const savedResumes = [];

      for (const hhResume of hhResumes.items) {
        // Check if resume already exists in DB
        const existing = await this.prisma.resume.findFirst({
          where: {
            userId,
            hhResumeId: hhResume.id,
          },
        });

        if (existing) {
          this.logger.log(`⏭️ Резюме уже существует: ${hhResume.title}`);
          skipped++;
          savedResumes.push(existing);
          continue;
        }

        // Save to local DB
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        
        const saved = await this.prisma.resume.create({
          data: {
            userId,
            title: hhResume.title || 'Резюме',
            firstName: user?.firstName || hhResume.first_name || '',
            lastName: user?.lastName || hhResume.last_name || '',
            email: hhResume.contact?.find((c: any) => c.type?.id === 'email')?.value || user?.email || '',
            phone: hhResume.contact?.find((c: any) => c.type?.id === 'cell')?.value?.formatted || user?.phone || '',
            city: hhResume.area?.name || 'Алматы',
            position: hhResume.title || '',
            salary: hhResume.salary?.amount || null,
            skills: hhResume.skill_set || [],
            about: hhResume.skills || null,
            status: hhResume.status?.id === 'published' ? ResumeStatus.ACTIVE : ResumeStatus.DRAFT,
            experience: hhResume.experience ? JSON.stringify(hhResume.experience) : null,
            education: hhResume.education ? JSON.stringify(hhResume.education) : null,
            hhResumeId: hhResume.id,
            hhUrl: hhResume.alternate_url,
            hhRawJson: hhResume as any,
          },
        });

        this.logger.log(`✅ Сохранено: ${saved.title} (HH ID: ${saved.hhResumeId})`);
        synced++;
        savedResumes.push(saved);
      }

      this.logger.log(`✅ Синхронизация завершена: синхронизировано ${synced}, пропущено ${skipped}`);

      return {
        synced,
        skipped,
        resumes: savedResumes,
      };
    } catch (error: any) {
      this.logger.error('Failed to sync resumes from HH', error.message);
      throw new Error('Failed to sync resumes from HeadHunter');
    }
  }
}

