import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import { PrismaService } from "../../shared/database/prisma.service";
import { HHApiService } from "../../shared/services/hh-api.service";
import { AuthService } from "../auth/auth.service";
import { OpenAIService } from "../../shared/services/openai.service";

export const AI_APPLICATION_QUEUE = "ai-application";

export interface AIApplicationJob {
  userId: string;
  vacancyId: string;
  coverLetter?: string;
  resumeId?: string; // If provided, use existing resume (simple apply mode)
}

export enum AIApplicationStatus {
  QUEUED = "QUEUED",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

@Injectable()
export class AIApplicationQueueService {
  private readonly logger = new Logger(AIApplicationQueueService.name);

  constructor(
    @InjectQueue(AI_APPLICATION_QUEUE) private aiApplicationQueue: Queue,
    private prisma: PrismaService,
    private hhApiService: HHApiService,
    private authService: AuthService,
    private openaiService: OpenAIService,
  ) {}

  /**
   * Add application to queue (fast, non-blocking)
   */
  async addToQueue(
    userId: string,
    vacancyId: string,
    coverLetter?: string
  ): Promise<{ jobId: string; queuePosition: number; status: string }> {
    this.logger.log(
      `Adding application to queue: user=${userId}, vacancy=${vacancyId}`
    );

    // Check if vacancy exists
    const vacancy = await this.prisma.vacancy.findUnique({
      where: { id: vacancyId },
    });

    if (!vacancy) {
      throw new NotFoundException("Vacancy not found");
    }

    // Check if already applied or in queue
    const existing = await this.prisma.application.findFirst({
      where: { userId, vacancyId },
    });

    if (existing) {
      throw new Error("You have already applied to this vacancy");
    }

    // Create pending application record (resumeId will be filled by processor)
    const application = await this.prisma.application.create({
      data: {
        userId,
        vacancyId,
        resumeId: null, // Will be updated by processor when resume is created
        coverLetter,
        status: AIApplicationStatus.QUEUED,
      },
    });

    // Add to queue
    const job = await this.aiApplicationQueue.add(
      "process-ai-application",
      {
        userId,
        vacancyId,
        coverLetter,
        applicationId: application.id,
      } as AIApplicationJob & { applicationId: string },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: false, // Keep completed jobs for history
        removeOnFail: false, // Keep failed jobs for debugging
      }
    );

    // Get queue position
    let queuePosition = -1;
    try {
      const waiting = await this.aiApplicationQueue.getWaiting();
      queuePosition = waiting.findIndex((j) => j.id === job.id);
    } catch (error) {
      this.logger.warn("Could not get queue position");
    }

    this.logger.log(
      `Job added to queue: ${job.id}, position: ${
        queuePosition >= 0 ? queuePosition + 1 : "unknown"
      }`
    );

    return {
      jobId: job.id.toString(),
      queuePosition: queuePosition >= 0 ? queuePosition + 1 : null,
      status: AIApplicationStatus.QUEUED,
    };
  }

  /**
   * Get all applications for user with queue status
   */
  async getUserApplications(userId: string) {
    const applications = await this.prisma.application.findMany({
      where: { userId },
      include: {
        vacancy: {
          select: {
            id: true,
            title: true,
            company: true,
            city: true,
            salaryFrom: true,
            salaryTo: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Enrich with queue information
    const enriched = await Promise.all(
      applications.map(async (app) => {
        let queueInfo = null;

        if (
          app.status === AIApplicationStatus.QUEUED ||
          app.status === AIApplicationStatus.PROCESSING
        ) {
          // Try to find job in queue
          const jobs = await this.aiApplicationQueue.getJobs([
            "waiting",
            "active",
            "delayed",
          ]);
          const job = jobs.find(
            (j) => (j.data as any).applicationId === app.id
          );

          if (job) {
            const state = await job.getState();
            const waiting = await this.aiApplicationQueue.getWaiting();
            const position = waiting.findIndex((j) => j.id === job.id);

            queueInfo = {
              jobId: job.id,
              position: position >= 0 ? position + 1 : null,
              state,
              progress: job.progress(),
            };
          }
        }

        return {
          ...app,
          queueInfo,
        };
      })
    );

    return enriched;
  }

  /**
   * Get single application status
   */
  async getApplicationStatus(applicationId: string, userId: string) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        vacancy: true,
        resume: true,
      },
    });

    if (!application) {
      throw new NotFoundException("Application not found");
    }

    if (application.userId !== userId) {
      throw new Error("Not authorized");
    }

    // Get queue info if applicable
    let queueInfo = null;
    if (
      application.status === AIApplicationStatus.QUEUED ||
      application.status === AIApplicationStatus.PROCESSING
    ) {
      const jobs = await this.aiApplicationQueue.getJobs([
        "waiting",
        "active",
        "delayed",
      ]);
      const job = jobs.find(
        (j) => (j.data as any).applicationId === application.id
      );

      if (job) {
        const state = await job.getState();
        const waiting = await this.aiApplicationQueue.getWaiting();
        const position = waiting.findIndex((j) => j.id === job.id);

        queueInfo = {
          jobId: job.id,
          position: position >= 0 ? position + 1 : null,
          state,
          progress: job.progress(),
        };
      }
    }

    return {
      ...application,
      queueInfo,
    };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.aiApplicationQueue.getWaitingCount(),
      this.aiApplicationQueue.getActiveCount(),
      this.aiApplicationQueue.getCompletedCount(),
      this.aiApplicationQueue.getFailedCount(),
      this.aiApplicationQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  }

  /**
   * Cancel application (remove from queue)
   */
  async cancelApplication(applicationId: string, userId: string) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      throw new NotFoundException("Application not found");
    }

    if (application.userId !== userId) {
      throw new Error("Not authorized");
    }

    // Remove from queue if still there
    const jobs = await this.aiApplicationQueue.getJobs([
      "waiting",
      "active",
      "delayed",
    ]);
    const job = jobs.find(
      (j) => (j.data as any).applicationId === application.id
    );

    if (job) {
      await job.remove();
      this.logger.log(`Job ${job.id} removed from queue`);
    }

    // Delete application
    await this.prisma.application.delete({
      where: { id: applicationId },
    });

    return { message: "Application cancelled successfully" };
  }

  /**
   * Simple apply with existing resume (selection mode) - NON-BLOCKING
   * Adds job to queue for async processing
   */
  async simpleApply(
    userId: string,
    vacancyId: string,
    resumeIdOrHhResumeId: string
  ): Promise<{ jobId: string; queuePosition: number | null; status: AIApplicationStatus }> {
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.log('📋 РЕЖИМ ВЫБОРА - ДОБАВЛЕНИЕ В ОЧЕРЕДЬ');
    this.logger.log(`   User: ${userId}`);
    this.logger.log(`   Vacancy: ${vacancyId}`);
    this.logger.log(`   Resume: ${resumeIdOrHhResumeId}`);
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 1. Check if vacancy exists
    const vacancy = await this.prisma.vacancy.findUnique({
      where: { id: vacancyId },
    });

    if (!vacancy) {
      throw new NotFoundException("Vacancy not found");
    }

    this.logger.log(`✅ Вакансия: ${vacancy.title}`);

    // 2. Check if already applied
    const existing = await this.prisma.application.findFirst({
      where: { userId, vacancyId },
    });

    if (existing) {
      throw new Error("You have already applied to this vacancy");
    }

    // 3. Find resume by local ID or hhResumeId
    let resume = await this.prisma.resume.findFirst({
      where: {
        userId,
        OR: [
          { id: resumeIdOrHhResumeId },
          { hhResumeId: resumeIdOrHhResumeId },
        ],
      },
    });

    if (!resume) {
      throw new NotFoundException(`Resume not found: ${resumeIdOrHhResumeId}`);
    }

    this.logger.log(`✅ Резюме найдено: ${resume.title}`);

    // 4. Create application record (QUEUED status)
    const application = await this.prisma.application.create({
      data: {
        userId,
        vacancyId,
        resumeId: resume.id, // Store local resume ID
        status: AIApplicationStatus.QUEUED,
      },
    });

    this.logger.log(`✅ Application created (ID: ${application.id})`);

    // 5. Add job to queue (NON-BLOCKING)
    const job = await this.aiApplicationQueue.add(
      'process-simple-application', // Different job type
      {
        userId,
        vacancyId,
        resumeId: resumeIdOrHhResumeId, // Pass resume ID for simple apply
        applicationId: application.id,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: false,
        removeOnFail: false,
      }
    );

    // Update application with jobId
    await this.prisma.application.update({
      where: { id: application.id },
      data: { jobId: job.id.toString() },
    });

    // Get queue position
    const waiting = await this.aiApplicationQueue.getWaiting();
    const queuePosition = waiting.findIndex(j => j.id === job.id);

    this.logger.log(`✅ Job added to queue (ID: ${job.id})`);
    this.logger.log(`   Queue position: ${queuePosition >= 0 ? queuePosition + 1 : 'processing'}`);
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return {
      jobId: job.id.toString(),
      queuePosition: queuePosition >= 0 ? queuePosition : null,
      status: AIApplicationStatus.QUEUED,
    };
  }
}
