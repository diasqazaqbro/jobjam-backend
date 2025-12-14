 # OpenAI Setup Guide

## Настройка OpenAI API для AI-генерации резюме

### 1. Добавьте в `.env` файл:

```env
OPENAI_API_KEY="your-openai-api-key-here"
```

### 2. API Endpoint

**POST** `/applications/apply-with-ai`

**Описание**: Откликнуться на вакансию с автоматической генерацией резюме через AI

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Body**:
```json
{
  "vacancyId": "uuid-of-vacancy",
  "coverLetter": "Сопроводительное письмо (опционально)"
}
```

**Response**:
```json
{
  "application": {
    "id": "application-id",
    "userId": "user-id",
    "vacancyId": "vacancy-id",
    "resumeId": "resume-id",
    "status": "PENDING",
    "createdAt": "2025-11-30T...",
    "vacancy": {...},
    "resume": {...}
  },
  "generatedResume": {
    "title": "QA Engineer",
    "skills": ["JavaScript", "TypeScript", "Testing", ...],
    "experience": [...],
    "education": {...}
  },
  "hhResumeId": "hh-resume-hash-id",
  "message": "Successfully applied to vacancy with AI-generated resume"
}
```

### 3. Процесс работы

1. **Получение вакансии** - система находит вакансию в базе данных
2. **AI генерация** - OpenAI GPT-4o-mini анализирует вакансию и создает идеальное резюме
3. **Создание в HH** - резюме отправляется в HeadHunter через API `/resume_profile`
4. **Отклик на вакансию** - автоматический отклик через HH API `/negotiations`
5. **Сохранение** - все данные сохраняются в локальной базе данных

### 4. AI Промпт

AI получает следующую информацию о вакансии:
- Название вакансии
- Описание
- Требования
- Обязанности
- Требуемые навыки
- Название компании

И генерирует:
- Подходящее название резюме
- Список релевантных навыков (5-30 шт)
- Опыт работы (1-3 места)
- Образование

### 5. Fallback механизм

Если OpenAI API недоступен или вернул ошибку, система автоматически создаст базовое резюме на основе данных вакансии.

### 6. Особенности

- Резюме создается специально под каждую вакансию
- Используется модель GPT-4o-mini для оптимального соотношения цена/качество
- Генерация занимает 2-5 секунд
- Поддержка казахстанского рынка труда
- Автоматическая валидация по требованиям HH API

### 7. Безопасность

⚠️ **ВАЖНО**: Никогда не коммитьте `.env` файл с реальным API ключом!

Храните ключ только локально или используйте secrets manager в production.

