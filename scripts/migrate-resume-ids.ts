import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateResumeIds() {
  console.log('🔄 Начинаем миграцию hhResumeId...');

  // Получаем все резюме где hhResumeId = null
  const resumes = await prisma.resume.findMany({
    where: {
      hhResumeId: null,
    },
  });

  console.log(`📊 Найдено ${resumes.length} резюме без hhResumeId`);

  let updated = 0;
  let skipped = 0;

  for (const resume of resumes) {
    // Если id выглядит как HH ID (длинный хеш), используем его
    if (resume.id.length > 30 && !resume.id.includes('-')) {
      try {
        await prisma.resume.update({
          where: { id: resume.id },
          data: { hhResumeId: resume.id },
        });
        console.log(`✅ Обновлено: ${resume.title} (${resume.id})`);
        updated++;
      } catch (error) {
        console.error(`❌ Ошибка обновления ${resume.id}:`, error);
      }
    } else {
      console.log(`⏭️ Пропущено (локальное резюме): ${resume.title} (${resume.id})`);
      skipped++;
    }
  }

  console.log('');
  console.log('✅ Миграция завершена!');
  console.log(`   Обновлено: ${updated}`);
  console.log(`   Пропущено: ${skipped}`);
}

migrateResumeIds()
  .then(() => {
    console.log('✅ Готово!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });

