import { PrismaClient, Role, VacancyStatus, ResumeStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const CITIES = ['Алматы', 'Астана', 'Шымкент', 'Караганда', 'Актобе', 'Тараз', 'Павлодар', 'Усть-Каменогорск'];

// Данные для работодателей
const EMPLOYERS = [
  {
    email: 'hr@kaspi.kz',
    firstName: 'Айгерим',
    lastName: 'Сейдахметова',
    companyName: 'Kaspi.kz',
    companyDescription: 'Крупнейшая финтех-компания Казахстана, предоставляющая инновационные финансовые и e-commerce решения',
    companyWebsite: 'https://kaspi.kz',
    phone: '+77001234567',
  },
  {
    email: 'jobs@beeline.kz',
    firstName: 'Данияр',
    lastName: 'Жумабаев',
    companyName: 'Beeline Kazakhstan',
    companyDescription: 'Ведущий оператор мобильной связи с современными digital решениями',
    companyWebsite: 'https://beeline.kz',
    phone: '+77001234568',
  },
  {
    email: 'hr@chocofamily.kz',
    firstName: 'Мадина',
    lastName: 'Калиева',
    companyName: 'Chocofamily Technologies',
    companyDescription: 'IT-холдинг, объединяющий e-commerce платформы: Chocotravel, Chocolife, Chocofood',
    companyWebsite: 'https://chocofamily.kz',
    phone: '+77001234569',
  },
  {
    email: 'career@jusan.kz',
    firstName: 'Ерлан',
    lastName: 'Нурланов',
    companyName: 'Jusan Bank',
    companyDescription: 'Современный цифровой банк с инновационным подходом к банковским услугам',
    companyWebsite: 'https://jusan.kz',
    phone: '+77001234570',
  },
  {
    email: 'hr@nomad-insurance.kz',
    firstName: 'Асель',
    lastName: 'Токтарова',
    companyName: 'Nomad Insurance',
    companyDescription: 'Первая полностью цифровая страховая компания в Казахстане',
    companyWebsite: 'https://nomad-insurance.kz',
    phone: '+77001234571',
  },
  {
    email: 'jobs@magnum.kz',
    firstName: 'Бауржан',
    lastName: 'Абдуллин',
    companyName: 'Magnum Cash & Carry',
    companyDescription: 'Крупнейшая розничная сеть супермаркетов Казахстана',
    companyWebsite: 'https://magnum.kz',
    phone: '+77001234572',
  },
  {
    email: 'hr@kolesa.kz',
    firstName: 'Жанара',
    lastName: 'Смагулова',
    companyName: 'Kolesa Group',
    companyDescription: 'Крупнейшая автомобильная платформа в Казахстане и Средней Азии',
    companyWebsite: 'https://kolesa.kz',
    phone: '+77001234573',
  },
  {
    email: 'career@epam.kz',
    firstName: 'Александр',
    lastName: 'Петров',
    companyName: 'EPAM Kazakhstan',
    companyDescription: 'Международная IT-компания, специализирующаяся на разработке ПО',
    companyWebsite: 'https://epam.com',
    phone: '+77001234574',
  },
];

// Данные для соискателей
const JOB_SEEKERS = [
  {
    email: 'aibek.suleimenov@gmail.com',
    firstName: 'Айбек',
    lastName: 'Сулейменов',
    phone: '+77051234567',
    position: 'Frontend Developer',
    city: 'Алматы',
    salary: 800000,
    skills: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS', 'Redux'],
    experience: '3 года опыта в разработке веб-приложений',
  },
  {
    email: 'dinara.karimova@mail.ru',
    firstName: 'Динара',
    lastName: 'Каримова',
    phone: '+77052234567',
    position: 'Backend Developer',
    city: 'Астана',
    salary: 900000,
    skills: ['Node.js', 'NestJS', 'PostgreSQL', 'MongoDB', 'Docker'],
    experience: '4 года разработки backend систем',
  },
  {
    email: 'timur.zhanabekov@gmail.com',
    firstName: 'Тимур',
    lastName: 'Жанабеков',
    phone: '+77053234567',
    position: 'Full-Stack Developer',
    city: 'Алматы',
    salary: 1200000,
    skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'AWS'],
    experience: '5 лет опыта в веб-разработке',
  },
  {
    email: 'aliya.nurbekova@inbox.kz',
    firstName: 'Алия',
    lastName: 'Нурбекова',
    phone: '+77054234567',
    position: 'UX/UI Designer',
    city: 'Алматы',
    salary: 600000,
    skills: ['Figma', 'Adobe XD', 'Sketch', 'Prototyping', 'User Research'],
    experience: '3 года в дизайне интерфейсов',
  },
  {
    email: 'arman.beketov@gmail.com',
    firstName: 'Арман',
    lastName: 'Бекетов',
    phone: '+77055234567',
    position: 'DevOps Engineer',
    city: 'Астана',
    salary: 1000000,
    skills: ['Kubernetes', 'Docker', 'CI/CD', 'AWS', 'Terraform'],
    experience: '4 года в DevOps',
  },
  {
    email: 'saule.mukanova@mail.kz',
    firstName: 'Сауле',
    lastName: 'Муканова',
    phone: '+77056234567',
    position: 'QA Engineer',
    city: 'Алматы',
    salary: 500000,
    skills: ['Manual Testing', 'Automation Testing', 'Selenium', 'Postman', 'Jira'],
    experience: '2 года в тестировании',
  },
  {
    email: 'nurlan.aitzhanov@gmail.com',
    firstName: 'Нурлан',
    lastName: 'Айтжанов',
    phone: '+77057234567',
    position: 'Product Manager',
    city: 'Алматы',
    salary: 1500000,
    skills: ['Product Strategy', 'Analytics', 'Agile', 'Roadmapping', 'Stakeholder Management'],
    experience: '6 лет в product management',
  },
  {
    email: 'aida.sagyndykova@inbox.ru',
    firstName: 'Айда',
    lastName: 'Сагындыкова',
    phone: '+77058234567',
    position: 'Data Analyst',
    city: 'Астана',
    salary: 700000,
    skills: ['SQL', 'Python', 'Power BI', 'Excel', 'Data Visualization'],
    experience: '3 года в аналитике данных',
  },
  {
    email: 'murat.ospanov@gmail.com',
    firstName: 'Мурат',
    lastName: 'Оспанов',
    phone: '+77059234567',
    position: 'Mobile Developer',
    city: 'Алматы',
    salary: 850000,
    skills: ['React Native', 'iOS', 'Android', 'Swift', 'Kotlin'],
    experience: '4 года мобильной разработки',
  },
  {
    email: 'gaukhar.serikova@mail.ru',
    firstName: 'Гаухар',
    lastName: 'Серикова',
    phone: '+77050234567',
    position: 'Marketing Manager',
    city: 'Алматы',
    salary: 650000,
    skills: ['Digital Marketing', 'SMM', 'SEO', 'Content Marketing', 'Google Analytics'],
    experience: '4 года в digital маркетинге',
  },
];

// Вакансии по категориям
const VACANCIES = [
  // IT вакансии
  {
    title: 'Senior Frontend Developer',
    description: 'Требуется опытный frontend разработчик для работы над крупными проектами финтех компании',
    requirements: 'Опыт работы с React/Next.js от 3 лет, знание TypeScript, опыт работы с Redux/MobX, понимание принципов UX/UI',
    responsibilities: 'Разработка новых функций, оптимизация производительности, code review, менторинг junior разработчиков',
    conditions: 'Гибридный формат работы, ДМС, корпоративное обучение, современный офис',
    salaryFrom: 800000,
    salaryTo: 1500000,
    employmentType: 'Полная занятость',
    experienceLevel: 'SENIOR',
    experienceYears: 3,
    skills: ['React', 'Next.js', 'TypeScript', 'Redux', 'REST API'],
  },
  {
    title: 'Backend Developer (Node.js)',
    description: 'Ищем backend разработчика для работы над микросервисной архитектурой',
    requirements: 'Опыт с Node.js от 2 лет, знание Express/NestJS, опыт работы с PostgreSQL/MongoDB, понимание REST API',
    responsibilities: 'Разработка и поддержка backend сервисов, интеграция с внешними API, оптимизация БД',
    conditions: 'Удаленная работа, гибкий график, ДМС, бонусы',
    salaryFrom: 700000,
    salaryTo: 1200000,
    employmentType: 'Полная занятость',
    experienceLevel: 'MIDDLE',
    experienceYears: 2,
    skills: ['Node.js', 'NestJS', 'PostgreSQL', 'Docker', 'Microservices'],
  },
  {
    title: 'Flutter Mobile Developer',
    description: 'Разработка мобильного приложения для e-commerce платформы',
    requirements: 'Опыт с Flutter от 1 года, знание Dart, опыт публикации в App Store/Google Play',
    responsibilities: 'Разработка кросс-платформенного приложения, интеграция API, тестирование',
    conditions: 'Офис в центре города, ДМС, free lunch',
    salaryFrom: 600000,
    salaryTo: 1000000,
    employmentType: 'Полная занятость',
    experienceLevel: 'MIDDLE',
    experienceYears: 1,
    skills: ['Flutter', 'Dart', 'Firebase', 'REST API', 'Git'],
  },
  {
    title: 'DevOps Engineer',
    description: 'Нужен DevOps для построения и поддержки CI/CD процессов',
    requirements: 'Опыт с Kubernetes/Docker от 2 лет, знание AWS/GCP, опыт с CI/CD инструментами',
    responsibilities: 'Настройка и поддержка инфраструктуры, автоматизация деплоя, мониторинг',
    conditions: 'Гибридный формат, ДМС, корпоративное обучение',
    salaryFrom: 900000,
    salaryTo: 1500000,
    employmentType: 'Полная занятость',
    experienceLevel: 'SENIOR',
    experienceYears: 3,
    skills: ['Kubernetes', 'Docker', 'AWS', 'CI/CD', 'Terraform'],
  },
  {
    title: 'Junior Frontend Developer',
    description: 'Ищем начинающего frontend разработчика в дружную команду',
    requirements: 'Базовые знания HTML/CSS/JavaScript, знакомство с React, желание учиться',
    responsibilities: 'Верстка страниц, разработка компонентов, исправление багов',
    conditions: 'Офис, менторство, обучение за счет компании, ДМС после испытательного срока',
    salaryFrom: 300000,
    salaryTo: 500000,
    employmentType: 'Полная занятость',
    experienceLevel: 'JUNIOR',
    experienceYears: 0,
    skills: ['HTML', 'CSS', 'JavaScript', 'React', 'Git'],
  },
  {
    title: 'QA Automation Engineer',
    description: 'Автоматизация тестирования веб и мобильных приложений',
    requirements: 'Опыт автоматизации от 2 лет, знание Selenium/Cypress, опыт с Postman/JMeter',
    responsibilities: 'Написание автотестов, поддержка тестовой инфраструктуры, регрессионное тестирование',
    conditions: 'Гибридный формат, ДМС, бонусы',
    salaryFrom: 500000,
    salaryTo: 900000,
    employmentType: 'Полная занятость',
    experienceLevel: 'MIDDLE',
    experienceYears: 2,
    skills: ['Selenium', 'Cypress', 'Postman', 'Python', 'CI/CD'],
  },
  {
    title: 'Data Scientist',
    description: 'Анализ данных и построение ML моделей для финтех проектов',
    requirements: 'Опыт с Python от 2 лет, знание ML библиотек, опыт с SQL, понимание статистики',
    responsibilities: 'Анализ больших данных, разработка ML моделей, A/B тестирование',
    conditions: 'Удаленная работа, ДМС, опционы',
    salaryFrom: 1000000,
    salaryTo: 2000000,
    employmentType: 'Полная занятость',
    experienceLevel: 'SENIOR',
    experienceYears: 3,
    skills: ['Python', 'Machine Learning', 'SQL', 'Pandas', 'TensorFlow'],
  },
  // Дизайн
  {
    title: 'UX/UI Designer',
    description: 'Дизайн интерфейсов для мобильных и веб приложений',
    requirements: 'Опыт от 2 лет, портфолио обязательно, знание Figma/Sketch, понимание UX принципов',
    responsibilities: 'Создание дизайн-макетов, прототипирование, user research, дизайн-система',
    conditions: 'Офис, ДМС, креативная атмосфера',
    salaryFrom: 500000,
    salaryTo: 900000,
    employmentType: 'Полная занятость',
    experienceLevel: 'MIDDLE',
    experienceYears: 2,
    skills: ['Figma', 'Sketch', 'Prototyping', 'User Research', 'Design Systems'],
  },
  {
    title: 'Graphic Designer',
    description: 'Создание визуального контента для маркетинговых кампаний',
    requirements: 'Опыт от 1 года, знание Adobe Creative Suite, портфолио',
    responsibilities: 'Дизайн баннеров, социальных сетей, презентаций, брендинг',
    conditions: 'Гибридный формат, ДМС',
    salaryFrom: 350000,
    salaryTo: 600000,
    employmentType: 'Полная занятость',
    experienceLevel: 'JUNIOR',
    experienceYears: 1,
    skills: ['Photoshop', 'Illustrator', 'InDesign', 'Branding', 'Typography'],
  },
  // Маркетинг
  {
    title: 'Digital Marketing Manager',
    description: 'Управление digital маркетингом компании',
    requirements: 'Опыт от 3 лет, знание SEO/SEM, опыт с контекстной рекламой, аналитика',
    responsibilities: 'Разработка маркетинговой стратегии, управление бюджетом, аналитика кампаний',
    conditions: 'Офис, ДМС, бонусы от результатов',
    salaryFrom: 600000,
    salaryTo: 1000000,
    employmentType: 'Полная занятость',
    experienceLevel: 'SENIOR',
    experienceYears: 3,
    skills: ['SEO', 'Google Ads', 'Facebook Ads', 'Analytics', 'Marketing Strategy'],
  },
  {
    title: 'SMM Manager',
    description: 'Ведение социальных сетей и создание контента',
    requirements: 'Опыт от 1 года, знание трендов, умение создавать вирусный контент',
    responsibilities: 'Контент-план, создание постов, работа с блогерами, аналитика',
    conditions: 'Удаленная работа, гибкий график',
    salaryFrom: 300000,
    salaryTo: 500000,
    employmentType: 'Полная занятость',
    experienceLevel: 'JUNIOR',
    experienceYears: 1,
    skills: ['Instagram', 'TikTok', 'Content Creation', 'Canva', 'Analytics'],
  },
  // Менеджмент
  {
    title: 'Product Manager',
    description: 'Управление продуктом от идеи до запуска',
    requirements: 'Опыт от 4 лет, понимание agile, опыт работы с командами разработки',
    responsibilities: 'Product roadmap, приоритизация задач, работа со stakeholders, аналитика',
    conditions: 'Гибридный формат, ДМС, опционы',
    salaryFrom: 1200000,
    salaryTo: 2000000,
    employmentType: 'Полная занятость',
    experienceLevel: 'SENIOR',
    experienceYears: 4,
    skills: ['Product Strategy', 'Agile', 'Analytics', 'Roadmapping', 'Leadership'],
  },
  {
    title: 'Project Manager',
    description: 'Управление IT проектами',
    requirements: 'Опыт от 3 лет, знание Scrum/Kanban, сертификация желательна',
    responsibilities: 'Планирование спринтов, контроль сроков, координация команды',
    conditions: 'Офис, ДМС, корпоративное обучение',
    salaryFrom: 800000,
    salaryTo: 1300000,
    employmentType: 'Полная занятость',
    experienceLevel: 'MIDDLE',
    experienceYears: 3,
    skills: ['Scrum', 'Kanban', 'Jira', 'Risk Management', 'Team Leadership'],
  },
  // HR
  {
    title: 'HR Manager',
    description: 'Управление процессами подбора персонала',
    requirements: 'Опыт от 3 лет, знание HR процессов, опыт в IT рекрутинге',
    responsibilities: 'Поиск кандидатов, проведение интервью, адаптация, HR аналитика',
    conditions: 'Офис, ДМС, бонусы',
    salaryFrom: 500000,
    salaryTo: 800000,
    employmentType: 'Полная занятость',
    experienceLevel: 'MIDDLE',
    experienceYears: 3,
    skills: ['Recruitment', 'Interviewing', 'HR Analytics', 'Talent Acquisition'],
  },
  // Продажи
  {
    title: 'Sales Manager',
    description: 'Продажи B2B решений',
    requirements: 'Опыт продаж от 2 лет, умение работать с крупными клиентами',
    responsibilities: 'Поиск клиентов, проведение презентаций, заключение сделок',
    conditions: 'Высокий % от продаж, ДМС, корпоративный автомобиль',
    salaryFrom: 400000,
    salaryTo: 1500000,
    employmentType: 'Полная занятость',
    experienceLevel: 'MIDDLE',
    experienceYears: 2,
    skills: ['B2B Sales', 'Negotiation', 'CRM', 'Cold Calling', 'Presentation'],
  },
];

async function main() {
  console.log('🌱 Начинаем заполнение базы данных...\n');

  // Очистка существующих данных
  console.log('🗑️  Очистка существующих данных...');
  await prisma.application.deleteMany();
  await prisma.resume.deleteMany();
  await prisma.vacancy.deleteMany();
  await prisma.user.deleteMany();
  console.log('✅ Данные очищены\n');

  // Хешируем пароль
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Создаем админа
  console.log('👤 Создание администратора...');
  const admin = await prisma.user.create({
    data: {
      email: 'admin@jobjam.kz',
      password: hashedPassword,
      role: Role.ADMIN,
      firstName: 'Админ',
      lastName: 'Джобжам',
      phone: '+77000000000',
    },
  });
  console.log(`✅ Создан админ: ${admin.email}\n`);

  // Создаем работодателей
  console.log('🏢 Создание работодателей...');
  const createdEmployers = [];
  for (const employer of EMPLOYERS) {
    const user = await prisma.user.create({
      data: {
        ...employer,
        password: hashedPassword,
        role: Role.EMPLOYER,
      },
    });
    createdEmployers.push(user);
    console.log(`   ✓ ${user.companyName} (${user.email})`);
  }
  console.log(`✅ Создано ${createdEmployers.length} работодателей\n`);

  // Создаем соискателей
  console.log('👥 Создание соискателей...');
  const createdJobSeekers = [];
  for (const seeker of JOB_SEEKERS) {
    const { position, city, salary, skills, experience, ...userData } = seeker;
    const user = await prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
        role: Role.USER,
      },
    });
    createdJobSeekers.push({ user, resumeData: { position, city, salary, skills, experience } });
    console.log(`   ✓ ${user.firstName} ${user.lastName} (${user.email})`);
  }
  console.log(`✅ Создано ${createdJobSeekers.length} соискателей\n`);

  // Создаем резюме для соискателей
  console.log('📄 Создание резюме...');
  const createdResumes = [];
  for (const { user, resumeData } of createdJobSeekers) {
    const resume = await prisma.resume.create({
      data: {
        userId: user.id,
        title: `Резюме ${resumeData.position}`,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone || '+77000000000',
        position: resumeData.position,
        city: resumeData.city,
        salary: resumeData.salary,
        skills: resumeData.skills,
        experience: resumeData.experience,
        education: 'Казахский Национальный Университет, Информатика',
        about: `Опытный ${resumeData.position} с отличными навыками коммуникации и стремлением к профессиональному росту.`,
        status: ResumeStatus.ACTIVE,
      },
    });
    createdResumes.push({ resume, userId: user.id });
    console.log(`   ✓ Резюме: ${resume.position} - ${user.firstName} ${user.lastName}`);
  }
  console.log(`✅ Создано ${createdResumes.length} резюме\n`);

  // Создаем вакансии
  console.log('💼 Создание вакансий...');
  const createdVacancies = [];
  for (let i = 0; i < VACANCIES.length; i++) {
    const vacancy = VACANCIES[i];
    const employer = createdEmployers[i % createdEmployers.length];
    const city = CITIES[Math.floor(Math.random() * CITIES.length)];

    const created = await prisma.vacancy.create({
      data: {
        ...vacancy,
        employerId: employer.id,
        company: employer.companyName || 'Компания',
        city,
        contactEmail: employer.email,
        contactPhone: employer.phone,
        status: VacancyStatus.ACTIVE,
        viewsCount: Math.floor(Math.random() * 500),
      },
    });
    createdVacancies.push(created);
    console.log(`   ✓ ${created.title} - ${employer.companyName} (${city})`);
  }
  console.log(`✅ Создано ${createdVacancies.length} вакансий\n`);

  // Создаем отклики
  console.log('📨 Создание откликов...');
  let applicationsCount = 0;
  
  // Каждый соискатель откликается на 2-4 случайные вакансии
  for (const { resume, userId } of createdResumes) {
    const numApplications = Math.floor(Math.random() * 3) + 2; // 2-4 отклика
    const shuffledVacancies = [...createdVacancies].sort(() => 0.5 - Math.random());
    
    for (let i = 0; i < Math.min(numApplications, shuffledVacancies.length); i++) {
      const vacancy = shuffledVacancies[i];
      const statuses = ['pending', 'viewed', 'accepted', 'rejected'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      try {
        await prisma.application.create({
          data: {
            vacancyId: vacancy.id,
            userId: userId,
            resumeId: resume.id,
            coverLetter: `Здравствуйте! Меня заинтересовала ваша вакансия "${vacancy.title}". Считаю, что мой опыт и навыки идеально подходят для этой позиции. Готов выйти на работу в ближайшее время.`,
            status,
          },
        });
        applicationsCount++;
      } catch (error) {
        // Пропускаем дубликаты
      }
    }
  }
  console.log(`✅ Создано ${applicationsCount} откликов\n`);

  // Итоговая статистика
  console.log('📊 Статистика:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Администраторов: 1`);
  console.log(`   Работодателей: ${createdEmployers.length}`);
  console.log(`   Соискателей: ${createdJobSeekers.length}`);
  console.log(`   Резюме: ${createdResumes.length}`);
  console.log(`   Вакансий: ${createdVacancies.length}`);
  console.log(`   Откликов: ${applicationsCount}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('🎉 База данных успешно заполнена!\n');
  console.log('📝 Тестовые учетные данные:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   Админ: admin@jobjam.kz / password123');
  console.log('   Работодатель: hr@kaspi.kz / password123');
  console.log('   Соискатель: aibek.suleimenov@gmail.com / password123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

