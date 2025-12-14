import { Processor, Process } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { PrismaService } from "../../shared/database/prisma.service";
import { OpenAIService } from "../../shared/services/openai.service";
import { HHApiService } from "../../shared/services/hh-api.service";
import { AuthService } from "../auth/auth.service";
import {
  ProfileService,
  Experience,
  Education,
} from "../../entities/profile/profile.service";
import {
  AI_APPLICATION_QUEUE,
  AIApplicationJob,
  AIApplicationStatus,
} from "./ai-application-queue.service";

@Processor(AI_APPLICATION_QUEUE)
export class AIApplicationProcessor {
  private readonly logger = new Logger(AIApplicationProcessor.name);

  constructor(
    private prisma: PrismaService,
    private openaiService: OpenAIService,
    private hhApiService: HHApiService,
    private authService: AuthService,
    private profileService: ProfileService
  ) {}

  @Process("process-ai-application")
  async handleAIApplication(
    job: Job<AIApplicationJob & { applicationId: string }>
  ) {
    const { userId, vacancyId, coverLetter, applicationId } = job.data;

    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`🚀 НАЧАЛО ОБРАБОТКИ AI ОТКЛИКА`);
    this.logger.log(`   Job ID: ${job.id}`);
    this.logger.log(`   Application ID: ${applicationId}`);
    this.logger.log(`   User ID: ${userId}`);
    this.logger.log(`   Vacancy ID: ${vacancyId}`);
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    try {
      // Update status to PROCESSING
      this.logger.log("📝 ШАГ 1/9: Обновление статуса на PROCESSING...");
      await this.prisma.application.update({
        where: { id: applicationId },
        data: { status: AIApplicationStatus.PROCESSING },
      });
      this.logger.log("✅ Статус обновлен");
      await job.progress(10);

      // Get vacancy
      this.logger.log("📋 ШАГ 2/9: Получение данных вакансии...");
      const vacancy = await this.prisma.vacancy.findUnique({
        where: { id: vacancyId },
      });

      if (!vacancy) {
        throw new Error("Vacancy not found");
      }

      this.logger.log(`✅ Вакансия найдена:`);
      this.logger.log(`   Название: "${vacancy.title}"`);
      this.logger.log(`   Компания: ${vacancy.company}`);
      this.logger.log(`   Город: ${vacancy.city || "не указан"}`);
      this.logger.log(
        `   Зарплата: ${vacancy.salaryFrom || 0} - ${vacancy.salaryTo || 0} ${
          vacancy.salaryCurrency || ""
        }`
      );
      await job.progress(20);

      // Get user
      this.logger.log("👤 ШАГ 3/9: Получение данных пользователя...");
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error("User not found");
      }

      this.logger.log(`✅ Пользователь найден:`);
      this.logger.log(`   Имя: ${user.firstName} ${user.lastName}`);
      this.logger.log(`   Email: ${user.email}`);
      await job.progress(30);

      // Get valid HH access token
      this.logger.log("🔑 ШАГ 4/9: Получение HH access token...");
      const hhAccessToken = await this.authService.getValidHhAccessToken(
        userId
      );
      this.logger.log(
        `✅ Token получен (длина: ${hhAccessToken.length} символов)`
      );
      await job.progress(40);

      // Get user profile for AI
      this.logger.log("👤 ШАГ 4.5/9: Получение профиля пользователя для AI...");
      const userProfile = await this.profileService.getOrCreateProfile(userId);
      const profileExperience = (userProfile.experience as Experience[]) || [];
      const profileEducation = (userProfile.education as Education) || null;

      this.logger.log(
        `   Опыт работы из профиля: ${profileExperience.length} записей`
      );
      this.logger.log(
        `   Образование из профиля: ${
          profileEducation ? "есть" : "будет сгенерировано AI"
        }`
      );
      await job.progress(45);

      // Generate resume with AI
      this.logger.log("🤖 ШАГ 5/9: ГЕНЕРАЦИЯ РЕЗЮМЕ С ПОМОЩЬЮ AI...");
      this.logger.log(`   Отправка запроса к OpenAI GPT-4o-mini...`);

      // If user has profile data, we'll use it as base and AI will enhance/tailor it
      // If not, AI will generate from scratch
      const generatedResume = await this.openaiService.generateResumeForVacancy(
        {
          vacancyTitle: vacancy.title,
          vacancyDescription: vacancy.description,
          vacancyRequirements: vacancy.requirements || undefined,
          vacancyResponsibilities: vacancy.responsibilities || undefined,
          vacancySkills: vacancy.skills || [],
          company: vacancy.company,
          userFirstName: user.firstName,
          userLastName: user.lastName,
          userEmail: user.email,
          // Pass user profile data to AI
          userExperience: profileExperience,
          userEducation: profileEducation,
        }
      );

      this.logger.log("✅ AI РЕЗЮМЕ СГЕНЕРИРОВАНО:");
      this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      this.logger.log(`   📌 Название: "${generatedResume.title}"`);
      this.logger.log(
        `   🎯 Навыки (${generatedResume.skills?.length || 0}): ${(
          generatedResume.skills || []
        )
          .slice(0, 5)
          .join(", ")}${(generatedResume.skills?.length || 0) > 5 ? "..." : ""}`
      );

      if (generatedResume.experience && generatedResume.experience.length > 0) {
        this.logger.log(
          `   💼 Опыт работы (${generatedResume.experience.length} мест):`
        );
        generatedResume.experience.forEach((exp, idx) => {
          this.logger.log(`      ${idx + 1}. ${exp.position} в ${exp.company}`);
          this.logger.log(
            `         ${exp.start} - ${exp.end || "настоящее время"}`
          );
          this.logger.log(
            `         Описание: ${exp.description.substring(0, 100)}${
              exp.description.length > 100 ? "..." : ""
            }`
          );
        });
      } else {
        this.logger.log(`   💼 Опыт работы: не указан`);
      }

      if (generatedResume.education) {
        this.logger.log(
          `   🎓 Образование: ${generatedResume.education.name} (${generatedResume.education.year})`
        );
        this.logger.log(
          `      Факультет: ${
            generatedResume.education.organization || "не указан"
          }`
        );
      } else {
        this.logger.log(`   🎓 Образование: не указано`);
      }
      this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      await job.progress(60);

      // Create resume in HH
      this.logger.log("📤 ШАГ 6/9: СОЗДАНИЕ РЕЗЮМЕ В HEADHUNTER...");

      const hhVacancyId = vacancy.hhVacancyId
        ? parseInt(vacancy.hhVacancyId, 10)
        : undefined;

      const resumeProfilePayload = this.buildResumeProfilePayload(
        generatedResume,
        user,
        hhVacancyId
      );

      this.logger.log(`   Отправка resume_profile payload в HH API...`);
      this.logger.log(`   Entry point: ${resumeProfilePayload.entry_point}`);
      this.logger.log(
        `   Vacancy ID: ${resumeProfilePayload.vacancy_id || "не указан"}`
      );

      const hhResumeProfile = await this.hhApiService.createResumeProfile(
        hhAccessToken,
        resumeProfilePayload
      );

      const hhResumeId = hhResumeProfile?.resume?.id;

      if (!hhResumeId) {
        this.logger.error("❌ ОШИБКА: HH не вернул resume ID");
        this.logger.error(
          `   Полный ответ HH: ${JSON.stringify(hhResumeProfile, null, 2)}`
        );
        throw new Error("Failed to get resume ID from HeadHunter response");
      }

      this.logger.log(`✅ Резюме создано в HH!`);
      this.logger.log(`   HH Resume ID: ${hhResumeId}`);
      this.logger.log(`   URL: https://hh.kz/resume/${hhResumeId}`);
      await job.progress(70);

      // Update resume with full data
      this.logger.log("🔄 ШАГ 6.2/9: ОБНОВЛЕНИЕ РЕЗЮМЕ ПОЛНЫМИ ДАННЫМИ...");
      const updatePayload = this.buildResumeUpdatePayload(
        generatedResume,
        user,
        hhVacancyId,
        vacancy.company // Pass company name for unique title
      );

      this.logger.log(
        `   Уникальное название: "${updatePayload.resume.title}"`
      );
      this.logger.log(
        `   Обновление навыков: ${generatedResume.skills?.length || 0} шт.`
      );
      this.logger.log(
        `   Обновление опыта: ${generatedResume.experience?.length || 0} мест`
      );

      await this.hhApiService.updateResumeProfile(
        hhAccessToken,
        hhResumeId,
        updatePayload
      );

      this.logger.log(`✅ Резюме обновлено полными данными!`);
      await job.progress(75);

      // 7. Publish resume
      this.logger.log("📢 ШАГ 7/9: ПУБЛИКАЦИЯ РЕЗЮМЕ...");
      try {
        await this.hhApiService.publishResume(hhAccessToken, hhResumeId);
        this.logger.log("✅ Резюме успешно опубликовано!");
      } catch (error: any) {
        this.logger.warn("⚠️ Не удалось опубликовать резюме");
        this.logger.warn(`   Причина: ${error.message}`);
        this.logger.warn(
          "   Резюме создано, но может потребоваться ручная публикация"
        );
        // Continue anyway, as this is not critical
      }
      await job.progress(80);

      // 7.5. Generate cover letter with AI
      this.logger.log(
        "✍️ ШАГ 7.5/9: ГЕНЕРАЦИЯ СОПРОВОДИТЕЛЬНОГО ПИСЬМА С ПОМОЩЬЮ AI..."
      );
      let aiCoverLetter = coverLetter || "";

      // Always generate cover letter with AI if not provided
      if (!aiCoverLetter) {
        this.logger.log(
          "   Отправка запроса к OpenAI GPT-4o-mini для генерации письма..."
        );
        aiCoverLetter = await this.openaiService.generateCoverLetter({
          vacancyTitle: vacancy.title,
          vacancyDescription: vacancy.description || "",
          company: vacancy.company || "",
          userFirstName: user.firstName || "",
          userLastName: user.lastName || "",
          userExperience: generatedResume.experience,
          resumeSkills: generatedResume.skills,
        });

        if (!aiCoverLetter || aiCoverLetter.trim().length === 0) {
          throw new Error("AI вернул пустое сопроводительное письмо");
        }

        this.logger.log("✅ Сопроводительное письмо сгенерировано AI!");
        this.logger.log(`   Длина: ${aiCoverLetter.length} символов`);
        this.logger.log(`   Превью: ${aiCoverLetter.substring(0, 100)}...`);
      } else {
        this.logger.log(
          "✅ Используется предоставленное сопроводительное письмо"
        );
        this.logger.log(`   Длина: ${aiCoverLetter.length} символов`);
      }

      await job.progress(85);

      // 8. Apply to vacancy in HH (if it's HH vacancy)
      if (vacancy.hhVacancyId) {
        this.logger.log("📨 ШАГ 8/9: ОТПРАВКА ОТКЛИКА В HH...");
        this.logger.log(`   Vacancy ID: ${vacancy.hhVacancyId}`);
        this.logger.log(`   Resume ID: ${hhResumeId}`);
        this.logger.log(
          `   Cover letter: ${
            aiCoverLetter ? `да (${aiCoverLetter.length} символов)` : "нет"
          }`
        );

        try {
          await this.hhApiService.applyToVacancy(
            hhAccessToken,
            vacancy.hhVacancyId,
            hhResumeId,
            aiCoverLetter
          );
          this.logger.log("✅ Отклик успешно отправлен в HH!");
        } catch (error: any) {
          this.logger.warn("⚠️ Не удалось отправить отклик в HH напрямую");
          this.logger.warn(`   Причина: ${error.message}`);
          this.logger.warn(
            `   Резюме создано, но отклик нужно отправить вручную`
          );
          // Continue anyway - resume is created
        }
      } else {
        this.logger.log("⏭️ Пропуск отправки отклика (не HH вакансия)");
      }

      await job.progress(90);

      // Save resume to local DB
      this.logger.log("💾 ШАГ 9/9: Сохранение резюме в локальную БД...");
      const localResume = await this.prisma.resume.create({
        data: {
          userId,
          title: generatedResume.title,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone || "",
          position: generatedResume.title,
          skills: generatedResume.skills,
          status: "ACTIVE",
          experience: generatedResume.experience
            ? JSON.stringify(generatedResume.experience)
            : null,
          education: generatedResume.education
            ? JSON.stringify(generatedResume.education)
            : null,
        },
      });
      this.logger.log(`✅ Резюме сохранено локально (ID: ${localResume.id})`);

      // Update application with resume and status
      this.logger.log("🔄 Обновление статуса отклика на COMPLETED...");
      await this.prisma.application.update({
        where: { id: applicationId },
        data: {
          resumeId: localResume.id,
          status: AIApplicationStatus.COMPLETED,
        },
      });

      await job.progress(100);

      this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      this.logger.log(`✅ ✅ ✅ ОТКЛИК УСПЕШНО ЗАВЕРШЕН! ✅ ✅ ✅`);
      this.logger.log(`   Job ID: ${job.id}`);
      this.logger.log(`   Application ID: ${applicationId}`);
      this.logger.log(`   Local Resume ID: ${localResume.id}`);
      this.logger.log(`   HH Resume ID: ${hhResumeId}`);
      this.logger.log(`   HH Resume URL: https://hh.kz/resume/${hhResumeId}`);
      this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      return {
        success: true,
        applicationId,
        resumeId: localResume.id,
        hhResumeId,
      };
    } catch (error: any) {
      this.logger.error(
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      );
      this.logger.error(`❌ ❌ ❌ ОШИБКА ОБРАБОТКИ ОТКЛИКА ❌ ❌ ❌`);
      this.logger.error(`   Job ID: ${job.id}`);
      this.logger.error(`   Application ID: ${applicationId}`);
      this.logger.error(`   Ошибка: ${error.message}`);
      this.logger.error(`   Stack: ${error.stack}`);
      this.logger.error(
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      );

      // Update application status to FAILED
      try {
        await this.prisma.application.update({
          where: { id: applicationId },
          data: {
            status: AIApplicationStatus.FAILED,
          },
        });
        this.logger.log("📝 Статус отклика обновлен на FAILED");
      } catch (dbError: any) {
        this.logger.error(
          `❌ Не удалось обновить статус в БД: ${dbError.message}`
        );
      }

      throw error;
    }
  }

  /**
   * Build payload for HH resume_profile API (initial creation)
   */
  private buildResumeProfilePayload(
    generated: any,
    user: any,
    vacancyId?: number
  ): any {
    return {
      entry_point: vacancyId ? "vacancy_response" : "default",
      vacancy_id: vacancyId,
      update_profile: true,
    };
  }

  /**
   * Build payload for updating resume profile with full data
   */
  private buildResumeUpdatePayload(
    generated: any,
    user: any,
    vacancyId?: number,
    companyName?: string
  ): any {
    const currentYear = new Date().getFullYear();

    // Build experience array with detailed descriptions
    const experience =
      generated.experience?.map((exp: any) => ({
        company: exp.company || "Не указано",
        position: exp.position || generated.title,
        description: exp.description || "Опыт работы на указанной позиции",
        start: exp.start || `${currentYear - 2}-01-01`,
        end: exp.end || null,
        area: { id: "159" }, // Almaty by default
      })) || [];

    // Build education
    const education = generated.education || {
      level: "higher",
      name: "Казахский национальный университет им. аль-Фараби",
      organization: "Факультет информационных технологий",
      year: currentYear - 5,
    };

    // Use AI-generated title as is
    const uniqueTitle = generated.title;

    return {
      current_screen_id: "experience",
      resume: {
        title: uniqueTitle, // Unique title to avoid duplicates
        skill_set: generated.skills || [],
        experience: experience,
        schedules: [{ id: "fullDay" }],
        employments: [{ id: "full" }],
        professional_roles: [{ id: "96" }], // IT специалист
      },
      // Note: profile fields like education are set during resume creation
      // and don't need to be updated here
      additional_properties: {},
    };
  }

  /**
   * Process simple application (with existing resume)
   * Generates cover letter and applies to vacancy
   */
  @Process("process-simple-application")
  async handleSimpleApplication(
    job: Job<AIApplicationJob & { applicationId: string; resumeId: string }>
  ) {
    const { userId, vacancyId, resumeId, applicationId } = job.data;

    this.logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    this.logger.log("📋 НАЧАЛО ОБРАБОТКИ ПРОСТОГО ОТКЛИКА (РЕЖИМ ВЫБОРА)");
    this.logger.log(`   Job ID: ${job.id}`);
    this.logger.log(`   Application ID: ${applicationId}`);
    this.logger.log(`   User ID: ${userId}`);
    this.logger.log(`   Vacancy ID: ${vacancyId}`);
    this.logger.log(`   Resume ID: ${resumeId}`);
    this.logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    try {
      // 1. Update status to PROCESSING
      this.logger.log("📝 ШАГ 1/6: Обновление статуса на PROCESSING...");
      await this.prisma.application.update({
        where: { id: applicationId },
        data: { status: AIApplicationStatus.PROCESSING },
      });
      this.logger.log("✅ Статус обновлен");
      await job.progress(10);

      // 2. Fetch Vacancy
      this.logger.log("📋 ШАГ 2/6: Получение данных вакансии...");
      const vacancy = await this.prisma.vacancy.findUnique({
        where: { id: vacancyId },
      });
      if (!vacancy) {
        throw new Error(`Vacancy with ID ${vacancyId} not found.`);
      }
      this.logger.log(`✅ Вакансия: ${vacancy.title} (${vacancy.company})`);
      await job.progress(20);

      // 3. Find resume
      this.logger.log("💼 ШАГ 3/6: Поиск резюме...");
      const resume = await this.prisma.resume.findFirst({
        where: {
          userId,
          OR: [{ id: resumeId }, { hhResumeId: resumeId }],
        },
      });

      if (!resume) {
        throw new Error(`Resume not found: ${resumeId}`);
      }

      this.logger.log(`✅ Резюме: ${resume.title}`);
      this.logger.log(`   Local ID: ${resume.id}`);
      this.logger.log(`   HH Resume ID: ${resume.hhResumeId}`);
      await job.progress(30);

      // 4. Get user info
      this.logger.log("👤 ШАГ 4/6: Получение данных пользователя...");
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true, email: true },
      });

      if (!user) {
        throw new Error(`User with ID ${userId} not found.`);
      }

      this.logger.log(`✅ Пользователь: ${user.firstName} ${user.lastName}`);
      await job.progress(40);

      // 5. Get HH access token
      this.logger.log("🔑 ШАГ 5/6: Получение HH access token...");
      const hhAccessToken = await this.authService.getValidHhAccessToken(
        userId
      );
      if (!hhAccessToken) {
        throw new Error("HeadHunter token not found or expired");
      }
      this.logger.log("✅ Token получен");
      await job.progress(50);

      // 6. Generate cover letter with AI
      this.logger.log(
        "✍️ ШАГ 6/6: ГЕНЕРАЦИЯ СОПРОВОДИТЕЛЬНОГО ПИСЬМА С ПОМОЩЬЮ AI..."
      );
      this.logger.log(
        "   Отправка запроса к OpenAI GPT-4o-mini для генерации письма..."
      );

      const coverLetter = await this.openaiService.generateCoverLetter({
        vacancyTitle: vacancy.title,
        vacancyDescription: vacancy.description || "",
        company: vacancy.company || "",
        userFirstName: user.firstName || "",
        userLastName: user.lastName || "",
        userExperience: resume.experience
          ? JSON.parse(resume.experience as any)
          : undefined,
        resumeSkills: resume.skills,
      });

      if (!coverLetter || coverLetter.trim().length === 0) {
        throw new Error("AI вернул пустое сопроводительное письмо");
      }

      this.logger.log(`✅ Сопроводительное письмо сгенерировано AI!`);
      this.logger.log(`   Длина: ${coverLetter.length} символов`);
      this.logger.log(`   Превью: ${coverLetter.substring(0, 100)}...`);

      await job.progress(70);

      // 7. Apply to vacancy in HH
      if (vacancy.hhVacancyId && resume.hhResumeId) {
        if (!coverLetter || coverLetter.trim().length === 0) {
          throw new Error("Сопроводительное письмо не может быть пустым");
        }

        this.logger.log("📨 Отправка отклика в HH...");
        this.logger.log(`   Vacancy ID: ${vacancy.hhVacancyId}`);
        this.logger.log(`   Resume ID: ${resume.hhResumeId}`);
        this.logger.log(`   Cover letter: да (${coverLetter.length} символов)`);

        try {
          await this.hhApiService.applyToVacancy(
            hhAccessToken,
            vacancy.hhVacancyId,
            resume.hhResumeId,
            coverLetter
          );

          this.logger.log("✅ ✅ ✅ ОТКЛИК ОТПРАВЛЕН В HH! ✅ ✅ ✅");
        } catch (error: any) {
          this.logger.error("❌ Не удалось отправить отклик в HH");
          this.logger.error(`   Причина: ${error.message}`);
          throw new Error(`Failed to apply to HH: ${error.message}`);
        }
      } else {
        this.logger.warn("⚠️ Не HH вакансия или резюме");
      }

      await job.progress(90);

      // 8. Update application status
      this.logger.log("💾 Обновление статуса на COMPLETED...");
      await this.prisma.application.update({
        where: { id: applicationId },
        data: {
          coverLetter: coverLetter || undefined,
          status: AIApplicationStatus.COMPLETED,
        },
      });

      await job.progress(100);

      this.logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      this.logger.log("✅ ✅ ✅ ПРОСТОЙ ОТКЛИК УСПЕШНО ЗАВЕРШЕН! ✅ ✅ ✅");
      this.logger.log(`   Job ID: ${job.id}`);
      this.logger.log(`   Application ID: ${applicationId}`);
      this.logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      return {
        success: true,
        applicationId,
      };
    } catch (error: any) {
      this.logger.error(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      );
      this.logger.error("❌ ❌ ❌ ОШИБКА ОБРАБОТКИ ПРОСТОГО ОТКЛИКА ❌ ❌ ❌");
      this.logger.error(`   Job ID: ${job.id}`);
      this.logger.error(`   Application ID: ${applicationId}`);
      this.logger.error(`   Ошибка: ${error.message}`);
      this.logger.error(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      );

      // Update application status to FAILED
      await this.prisma.application.update({
        where: { id: applicationId },
        data: {
          status: AIApplicationStatus.FAILED,
          failedReason: error.message,
        },
      });

      throw error;
    }
  }
}
