import { Injectable, NotFoundException, ForbiddenException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { OpenAIService } from '../../shared/services/openai.service';
import { HHApiService } from '../../shared/services/hh-api.service';
import { AuthService } from '../../features/auth/auth.service';

@Injectable()
export class ApplicationService {
  private readonly logger = new Logger(ApplicationService.name);

  constructor(
    private prisma: PrismaService,
    private openaiService: OpenAIService,
    private hhApiService: HHApiService,
    private authService: AuthService,
  ) {}

  async findByUser(userId: string) {
    return this.prisma.application.findMany({
      where: { userId },
      include: {
        vacancy: {
          include: {
            employer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                companyName: true,
                companyLogo: true,
              },
            },
          },
        },
        resume: {
          select: {
            id: true,
            title: true,
            position: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByVacancy(vacancyId: string, employerId: string) {
    // Verify vacancy belongs to employer
    const vacancy = await this.prisma.vacancy.findUnique({
      where: { id: vacancyId },
    });

    if (!vacancy) {
      throw new NotFoundException('Vacancy not found');
    }

    if (vacancy.employerId !== employerId) {
      throw new ForbiddenException('You do not own this vacancy');
    }

    return this.prisma.application.findMany({
      where: { vacancyId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        resume: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async apply(userId: string, vacancyId: string, resumeId: string, coverLetter?: string) {
    // Check if vacancy exists
    const vacancy = await this.prisma.vacancy.findUnique({
      where: { id: vacancyId },
    });

    if (!vacancy) {
      throw new NotFoundException('Vacancy not found');
    }

    if (vacancy.status !== 'ACTIVE') {
      throw new ConflictException('Vacancy is not active');
    }

    // Check if resume exists and belongs to user
    const resume = await this.prisma.resume.findUnique({
      where: { id: resumeId },
    });

    if (!resume || resume.userId !== userId) {
      throw new ForbiddenException('Resume not found or does not belong to you');
    }

    // Check if already applied
    const existingApplication = await this.prisma.application.findFirst({
      where: {
        userId,
        vacancyId,
      },
    });

    if (existingApplication) {
      throw new ConflictException('You have already applied to this vacancy');
    }

    return this.prisma.application.create({
      data: {
        userId,
        vacancyId,
        resumeId,
        coverLetter,
        status: 'PENDING',
      },
      include: {
        vacancy: true,
        resume: true,
      },
    });
  }

  async updateStatus(applicationId: string, employerId: string, status: string) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { vacancy: true },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.vacancy.employerId !== employerId) {
      throw new ForbiddenException('You do not own this vacancy');
    }

    return this.prisma.application.update({
      where: { id: applicationId },
      data: { status },
    });
  }

  async cancel(applicationId: string, userId: string) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.userId !== userId) {
      throw new ForbiddenException('This application does not belong to you');
    }

    await this.prisma.application.delete({
      where: { id: applicationId },
    });

    return { message: 'Application cancelled successfully' };
  }

  /**
   * Apply to vacancy with AI-generated resume
   * Flow:
   * 1. Get vacancy from DB
   * 2. Generate resume content with AI based on vacancy
   * 3. Create resume in HH via API
   * 4. Apply to vacancy in HH
   * 5. Save application in local DB
   */
  async applyWithAI(userId: string, vacancyId: string, coverLetter?: string) {
    this.logger.log(`Starting AI-powered application for user ${userId} to vacancy ${vacancyId}`);

    // 1. Get vacancy from DB
    const vacancy = await this.prisma.vacancy.findUnique({
      where: { id: vacancyId },
    });

    if (!vacancy) {
      throw new NotFoundException('Vacancy not found');
    }

    if (vacancy.status !== 'ACTIVE') {
      throw new ConflictException('Vacancy is not active');
    }

    // Check if already applied
    const existingApplication = await this.prisma.application.findFirst({
      where: { userId, vacancyId },
    });

    if (existingApplication) {
      throw new ConflictException('You have already applied to this vacancy');
    }

    // Get user info
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get valid HH access token
    const hhAccessToken = await this.authService.getValidHhAccessToken(userId);

    try {
      // 2. Generate resume with AI
      this.logger.log('Generating resume with AI...');
      const generatedResume = await this.openaiService.generateResumeForVacancy({
        vacancyTitle: vacancy.title,
        vacancyDescription: vacancy.description,
        vacancyRequirements: vacancy.requirements || undefined,
        vacancyResponsibilities: vacancy.responsibilities || undefined,
        vacancySkills: vacancy.skills || [],
        company: vacancy.company,
        userFirstName: user.firstName,
        userLastName: user.lastName,
        userEmail: user.email,
      });

      this.logger.log('Resume generated successfully');

      // 3. Create resume in HH
      this.logger.log('Creating resume in HeadHunter...');
      
      // Parse vacancy ID for HH (if it's HH vacancy)
      const hhVacancyId = vacancy.hhVacancyId 
        ? parseInt(vacancy.hhVacancyId, 10) 
        : undefined;

      const resumeProfilePayload = this.buildResumeProfilePayload(
        generatedResume,
        user,
        hhVacancyId,
      );

      const hhResumeProfile = await this.hhApiService.createResumeProfile(
        hhAccessToken,
        resumeProfilePayload,
      );

      const hhResumeId = hhResumeProfile?.resume?.id;
      
      if (!hhResumeId) {
        throw new Error('Failed to get resume ID from HeadHunter response');
      }

      this.logger.log(`Resume created in HH with ID: ${hhResumeId}`);

      // 4. Apply to vacancy in HH (if it's HH vacancy)
      if (vacancy.hhVacancyId) {
        this.logger.log('Applying to vacancy in HeadHunter...');
        try {
          await this.hhApiService.applyToVacancy(
            hhAccessToken,
            vacancy.hhVacancyId,
            hhResumeId,
            coverLetter,
          );
          this.logger.log('Successfully applied to vacancy in HH');
        } catch (error: any) {
          this.logger.warn('Failed to apply to HH vacancy directly:', error.message);
          // Continue anyway - resume is created
        }
      }

      // 5. Save application in local DB
      // First, create resume record in our DB
      const localResume = await this.prisma.resume.create({
        data: {
          userId,
          title: generatedResume.title,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone || '',
          position: generatedResume.title,
          skills: generatedResume.skills,
          status: 'ACTIVE',
          // Store HH resume ID in a custom field
          experience: generatedResume.experience 
            ? JSON.stringify(generatedResume.experience)
            : null,
          education: generatedResume.education
            ? JSON.stringify(generatedResume.education)
            : null,
        },
      });

      const application = await this.prisma.application.create({
        data: {
          userId,
          vacancyId,
          resumeId: localResume.id,
          coverLetter,
          status: 'PENDING',
        },
        include: {
          vacancy: true,
          resume: true,
        },
      });

      this.logger.log(`Application created successfully: ${application.id}`);

      return {
        application,
        generatedResume,
        hhResumeId,
        message: 'Successfully applied to vacancy with AI-generated resume',
      };
    } catch (error: any) {
      this.logger.error('Failed to apply with AI:', error.message);
      throw new ConflictException(
        `Failed to apply with AI: ${error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Build payload for HH resume_profile API
   */
  private buildResumeProfilePayload(
    generated: any,
    user: any,
    vacancyId?: number,
  ): any {
    const currentYear = new Date().getFullYear();
    
    // Build experience array
    const experience = generated.experience?.map((exp: any) => ({
      company: exp.company || 'Не указано',
      position: exp.position || generated.title,
      description: exp.description || 'Опыт работы на указанной позиции',
      start: exp.start || `${currentYear - 2}-01-01`,
      end: exp.end || null,
    })) || [];

    // Build education
    const education = generated.education || {
      level: 'higher',
      name: 'Высшее учебное заведение',
      organization: 'Факультет',
      year: currentYear - 5,
    };

    return {
      entry_point: vacancyId ? 'vacancy_response' : 'default',
      vacancy_id: vacancyId,
      resume: {
        title: generated.title,
        skill_set: generated.skills || [],
        experience: experience,
        schedules: [{ id: 'fullDay' }],
        employments: [{ id: 'full' }],
        professional_roles: [{ id: '96' }], // Default role - можно улучшить
      },
      profile: {
        first_name: user.firstName,
        last_name: user.lastName,
        gender: { id: 'male' }, // Default - можно улучшить
        area: { id: '159' }, // Almaty - можно улучшить
        citizenship: [{ id: '40' }], // Kazakhstan
        language: [
          {
            id: 'rus',
            level: { id: 'native' },
          },
        ],
        education: {
          level: { id: education.level || 'higher' },
          primary: [
            {
              name: education.name,
              organization: education.organization || '',
              year: education.year,
            },
          ],
        },
      },
      additional_properties: {},
    };
  }
}

