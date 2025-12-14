# 🧪 Тестирование AI-отклика на вакансию

## Быстрый старт

### 1. Добавьте OpenAI ключ в `.env`:

```bash
echo 'OPENAI_API_KEY="your-openai-api-key-here"' >> .env
```

### 2. Перезапустите backend:

```bash
npm run dev
```

### 3. Авторизуйтесь через HH:

```bash
# Откройте в браузере:
http://localhost:3001/auth/hh

# Или через curl (получите redirect URL):
curl -v http://localhost:3001/auth/hh
```

После авторизации вы получите JWT token.

### 4. Получите список вакансий:

```bash
curl -X GET 'http://localhost:3001/vacancies?page=0&perPage=5' \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Скопируйте `id` любой вакансии.

### 5. Откликнитесь с AI-генерацией резюме:

```bash
curl -X POST http://localhost:3001/applications/apply-with-ai \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vacancyId": "VACANCY_ID_HERE",
    "coverLetter": "Здравствуйте! Очень заинтересован в данной позиции."
  }'
```

## 📝 Пример полного запроса

```bash
# 1. Авторизация (получение токена)
# Откройте в браузере и авторизуйтесь:
open http://localhost:3001/auth/hh

# После редиректа на frontend, скопируйте token из URL
# http://localhost:3000/auth/callback?token=eyJhbGciOiJ...

export JWT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 2. Получение вакансий
curl -X GET 'http://localhost:3001/vacancies?page=0&perPage=3' \
  -H "Authorization: Bearer $JWT_TOKEN" \
  | jq '.items[0]' # показываем первую вакансию

# 3. Применение AI-отклика
curl -X POST http://localhost:3001/applications/apply-with-ai \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vacancyId": "a1b2c3d4-e5f6-4789-a1b2-c3d4e5f67890",
    "coverLetter": "Добрый день! Хотел бы присоединиться к вашей команде."
  }' | jq '.'
```

## ✅ Ожидаемый результат

```json
{
  "application": {
    "id": "uuid-application",
    "userId": "uuid-user",
    "vacancyId": "uuid-vacancy",
    "resumeId": "uuid-resume",
    "status": "PENDING",
    "coverLetter": "Добрый день! Хотел бы присоединиться к вашей команде.",
    "createdAt": "2025-11-30T12:00:00.000Z",
    "updatedAt": "2025-11-30T12:00:00.000Z",
    "vacancy": {
      "id": "uuid-vacancy",
      "title": "Senior Full-Stack Developer",
      "company": "Tech Company Kazakhstan",
      "description": "Мы ищем опытного разработчика...",
      "skills": ["JavaScript", "React", "Node.js", "TypeScript"],
      ...
    },
    "resume": {
      "id": "uuid-resume",
      "title": "Senior Full-Stack Developer",
      "skills": [
        "JavaScript",
        "TypeScript", 
        "React",
        "Node.js",
        "Express.js",
        "PostgreSQL",
        "MongoDB",
        "Docker"
      ],
      ...
    }
  },
  "generatedResume": {
    "title": "Senior Full-Stack Developer",
    "skills": [
      "JavaScript",
      "TypeScript",
      "React",
      "Redux",
      "Node.js",
      "Express.js",
      "NestJS",
      "PostgreSQL",
      "MongoDB",
      "Docker",
      "Kubernetes",
      "CI/CD",
      "Git",
      "REST API",
      "GraphQL"
    ],
    "experience": [
      {
        "company": "IT Solutions Kazakhstan",
        "position": "Full-Stack Developer",
        "description": "Разработка и поддержка сложных веб-приложений с использованием современного стека технологий. Участие во всех этапах разработки от проектирования архитектуры до деплоя в production. Работа с микросервисной архитектурой, контейнеризация приложений, настройка CI/CD пайплайнов.",
        "start": "2021-03-01",
        "end": null
      },
      {
        "company": "Digital Agency Almaty",
        "position": "Frontend Developer",
        "description": "Разработка интерфейсов для корпоративных веб-приложений. Оптимизация производительности, адаптивная верстка, интеграция с backend API. Работа в команде по Agile/Scrum методологии.",
        "start": "2019-06-01",
        "end": "2021-02-28"
      }
    ],
    "education": {
      "level": "higher",
      "name": "Казахский Национальный Университет имени аль-Фараби",
      "organization": "Факультет информационных технологий",
      "year": 2019
    }
  },
  "hhResumeId": "1a2b3c4d5e6f7g8h",
  "message": "Successfully applied to vacancy with AI-generated resume"
}
```

## 🔍 Проверка в HeadHunter

После успешного отклика:

1. Зайдите на [hh.kz](https://hh.kz)
2. Откройте "Мои резюме"
3. Вы увидите новое резюме, созданное AI
4. Перейдите в "Отклики"
5. Найдите отклик на выбранную вакансию

## 🐛 Возможные ошибки

### "User not found or no HH token"
**Причина**: Пользователь не авторизован через HeadHunter  
**Решение**: Пройдите OAuth авторизацию через `/auth/hh`

### "Vacancy not found"
**Причина**: Неверный ID вакансии  
**Решение**: Получите актуальный список вакансий через `/vacancies`

### "You have already applied to this vacancy"
**Причина**: Вы уже откликались на эту вакансию  
**Решение**: Выберите другую вакансию

### "Failed to generate resume with AI"
**Причина**: Проблемы с OpenAI API или неверный ключ  
**Решение**: 
- Проверьте `OPENAI_API_KEY` в `.env`
- Проверьте баланс на аккаунте OpenAI
- Система автоматически создаст базовое резюме (fallback)

### "Failed to create resume profile on HeadHunter"
**Причина**: Неверный формат данных или проблемы с HH API  
**Решение**: Проверьте логи сервера, убедитесь что:
- Имя и фамилия начинаются с заглавной буквы
- Email валидный
- HH токен не истек

## 📊 Мониторинг процесса

Смотрите логи backend в реальном времени:

```bash
# В терминале где запущен backend увидите:
[ApplicationService] Starting AI-powered application for user abc123 to vacancy xyz789
[OpenAIService] Generating resume with AI for vacancy: Senior Full-Stack Developer
[OpenAIService] Successfully generated resume with AI
[ApplicationService] Creating resume in HeadHunter...
[ApplicationService] Resume created in HH with ID: 1a2b3c4d5e6f7g8h
[ApplicationService] Applying to vacancy in HeadHunter...
[ApplicationService] Successfully applied to vacancy in HH
[ApplicationService] Application created successfully: application-uuid
```

## 💰 Стоимость

При использовании GPT-4o-mini:
- Стоимость: ~$0.0001-0.0003 за одну генерацию
- Скорость: 2-5 секунд
- Качество: Высокое

## 🎉 Готово!

Теперь вы можете:
- ✅ Откликаться на вакансии с AI-генерированным резюме
- ✅ Экономить время на создании резюме
- ✅ Получать релевантные резюме под каждую вакансию
- ✅ Автоматически откликаться в HeadHunter

**Следующие шаги:**
1. Интеграция с фронтендом
2. Добавление UI для AI-отклика
3. Возможность редактирования сгенерированного резюме перед отправкой

