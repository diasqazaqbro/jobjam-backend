import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';

export interface Experience {
  company: string;
  position: string;
  description: string;
  start: string;
  end?: string | null;
}

export interface Education {
  level: string; // 'higher' | 'secondary'
  name: string;
  organization: string;
  year: number;
}

export interface UserProfileData {
  experience?: Experience[];
  education?: Education;
}

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get user profile (create if doesn't exist)
   */
  async getOrCreateProfile(userId: string) {
    let profile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      profile = await this.prisma.userProfile.create({
        data: {
          userId,
          experience: null,
          education: null,
        },
      });
      this.logger.log(`Created new profile for user ${userId}`);
    }

    return {
      id: profile.id,
      userId: profile.userId,
      experience: profile.experience as any as Experience[] | null,
      education: profile.education as any as Education | null,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: UserProfileData) {
    const profile = await this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        experience: data.experience as any || null,
        education: data.education as any || null,
      },
      update: {
        experience: data.experience as any || null,
        education: data.education as any || null,
      },
    });

    this.logger.log(`Updated profile for user ${userId}`);

    return {
      id: profile.id,
      userId: profile.userId,
      experience: profile.experience as any as Experience[] | null,
      education: profile.education as any as Education | null,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  /**
   * Add experience to profile
   */
  async addExperience(userId: string, experience: Experience) {
    const profile = await this.getOrCreateProfile(userId);
    
    const experiences = (profile.experience as any as Experience[]) || [];
    experiences.push(experience);

    return this.updateProfile(userId, { 
      experience: experiences,
      education: profile.education || undefined,
    });
  }

  /**
   * Remove experience from profile
   */
  async removeExperience(userId: string, index: number) {
    const profile = await this.getOrCreateProfile(userId);
    
    const experiences = (profile.experience as any as Experience[]) || [];
    if (index < 0 || index >= experiences.length) {
      throw new NotFoundException('Experience not found');
    }

    experiences.splice(index, 1);

    return this.updateProfile(userId, { 
      experience: experiences,
      education: profile.education || undefined,
    });
  }

  /**
   * Set education in profile
   */
  async setEducation(userId: string, education: Education) {
    const profile = await this.getOrCreateProfile(userId);

    return this.updateProfile(userId, {
      experience: (profile.experience as any as Experience[]) || undefined,
      education,
    });
  }

  /**
   * Remove education from profile
   */
  async removeEducation(userId: string) {
    const profile = await this.getOrCreateProfile(userId);

    return this.updateProfile(userId, {
      experience: (profile.experience as any as Experience[]) || undefined,
      education: undefined,
    });
  }

  /**
   * Import data from existing HH resume
   */
  async importFromResume(userId: string, resumeId: string) {
    this.logger.log(`📥 Импорт данных из резюме: ${resumeId} для пользователя: ${userId}`);
    
    // Find resume by local ID or HH resume ID
    const resume = await this.prisma.resume.findFirst({
      where: {
        userId,
        OR: [
          { id: resumeId },
          { hhResumeId: resumeId },
        ],
      },
    });

    if (!resume) {
      this.logger.error(`❌ Резюме не найдено: ${resumeId}`);
      this.logger.error(`   User ID: ${userId}`);
      
      // Log all user's resumes for debugging
      const allResumes = await this.prisma.resume.findMany({
        where: { userId },
      });
      this.logger.error(`   Доступные резюме пользователя (${allResumes.length}):`);
      allResumes.forEach(r => {
        this.logger.error(`     - Local ID: ${r.id}, HH ID: ${r.hhResumeId || 'none'}, Title: ${r.title}`);
      });
      
      throw new NotFoundException('Resume not found');
    }

    this.logger.log(`✅ Резюме найдено: ${resume.title}`);
    this.logger.log(`   Local ID: ${resume.id}`);
    this.logger.log(`   HH Resume ID: ${resume.hhResumeId || 'none'}`);
    this.logger.log(`   Has experience field: ${resume.experience ? 'yes' : 'no'}`);
    this.logger.log(`   Has education field: ${resume.education ? 'yes' : 'no'}`);
    this.logger.log(`   Has hhRawJson: ${resume.hhRawJson ? 'yes' : 'no'}`);

    let experienceData = null;
    let educationData = null;

    // Try to parse from local fields first
    if (resume.experience) {
      experienceData = typeof resume.experience === 'string' 
        ? JSON.parse(resume.experience) 
        : resume.experience;
    }

    if (resume.education) {
      educationData = typeof resume.education === 'string' 
        ? JSON.parse(resume.education) 
        : resume.education;
    }

    // If no local data, try to parse from HH raw JSON
    if ((!experienceData || !educationData) && resume.hhRawJson) {
      this.logger.log(`📦 Парсинг данных из hhRawJson...`);
      const hhData = resume.hhRawJson as any;

      // Parse experience from HH
      if (!experienceData && hhData.experience && Array.isArray(hhData.experience) && hhData.experience.length > 0) {
        experienceData = hhData.experience.map((exp: any) => ({
          company: exp.company || 'Компания',
          position: exp.position || resume.title,
          description: exp.description || `Опыт работы в компании ${exp.company} на позиции ${exp.position}. Период работы: ${exp.start} - ${exp.end || 'настоящее время'}.`,
          start: exp.start,
          end: exp.end || null,
        }));
        this.logger.log(`   ✅ Импортировано ${experienceData.length} мест работы из HH`);
      }

      // Parse education from HH
      if (!educationData && hhData.education) {
        const hhEdu = hhData.education;
        if (hhEdu.primary && Array.isArray(hhEdu.primary) && hhEdu.primary.length > 0) {
          const primaryEdu = hhEdu.primary[0];
          educationData = {
            level: hhEdu.level?.id === 'higher' || hhEdu.level?.id === 'unfinished_higher' ? 'higher' : 'secondary',
            name: primaryEdu.name || 'Учебное заведение',
            organization: primaryEdu.organization || primaryEdu.result || 'Факультет',
            year: primaryEdu.year || new Date().getFullYear() - 5,
          };
          this.logger.log(`   ✅ Импортировано образование из HH: ${educationData.name}`);
        } else if (hhEdu.level) {
          // Fallback if no primary education but level exists
          educationData = {
            level: hhEdu.level.id === 'higher' || hhEdu.level.id === 'unfinished_higher' ? 'higher' : 'secondary',
            name: 'Высшее учебное заведение',
            organization: 'Факультет',
            year: new Date().getFullYear() - 5,
          };
          this.logger.log(`   ⚠️ Импортирован только уровень образования из HH: ${hhEdu.level.name}`);
        }
      }
    }

    this.logger.log(`📊 Итоговые данные для профиля:`);
    this.logger.log(`   Опыт работы: ${experienceData ? `${experienceData.length} мест` : 'нет'}`);
    this.logger.log(`   Образование: ${educationData ? educationData.name : 'нет'}`);

    if (!experienceData && !educationData) {
      this.logger.warn(`⚠️ В резюме нет данных для импорта!`);
      this.logger.warn(`   Попробуйте выбрать другое резюме с заполненным опытом или образованием.`);
    }

    return this.updateProfile(userId, {
      experience: experienceData,
      education: educationData,
    });
  }
}

