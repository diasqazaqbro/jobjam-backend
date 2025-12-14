# 🚀 Queue System для AI-откликов

## Обзор

Реализована система очередей на базе **BullMQ + Redis** для асинхронной обработки AI-откликов на вакансии.

### Зачем это нужно?

**Проблема:** AI-генерация резюме занимает 2-5 секунд, блокирует UI
**Решение:** Быстро добавляем в очередь, обрабатываем в фоне

### Преимущества:

✅ **Быстрый swipe** - отклик добавляется мгновенно (~50ms)  
✅ **Фоновая обработка** - AI работает в background  
✅ **Статусы** - видно progress (queued → processing → completed)  
✅ **Retry** - автоматические повторы при ошибках  
✅ **Масштабируемость** - можно обрабатывать множество откликов параллельно

## 🏗️ Архитектура

```
Swipe Action → Fast Queue Add (50ms) → Background AI Processing (2-5s) → Complete
                        ↓
                   Status: QUEUED
                        ↓
                   Status: PROCESSING
                        ↓
                   Status: COMPLETED
```

### Компоненты:

1. **Redis** - хранилище очередей
2. **BullMQ** - библиотека для работы с очередями
3. **AIApplicationQueue** - сервис управления очередью
4. **AIApplicationProcessor** - обработчик job'ов
5. **AIApplicationQueueController** - API endpoints

## 📦 Установка

### 1. Зависимости (уже установлены):
```bash
npm install @nestjs/bull bullmq ioredis
```

### 2. Redis в Docker Compose (уже настроен):
```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
```

### 3. Переменные окружения:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 4. Prisma миграция:
```bash
cd backend
npx prisma migrate dev --name add-queue-statuses
```

## 🎯 API Endpoints

### 1. Добавить в очередь (быстрый swipe)

**POST** `/ai-applications/queue`

```bash
curl -X POST http://localhost:3001/ai-applications/queue \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vacancyId": "vacancy-uuid",
    "coverLetter": "Опционально"
  }'
```

**Response:**
```json
{
  "jobId": "123",
  "queuePosition": 3,
  "status": "QUEUED"
}
```

### 2. Получить свои отклики со статусами

**GET** `/ai-applications`

```bash
curl -X GET http://localhost:3001/ai-applications \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
[
  {
    "id": "app-uuid",
    "vacancyId": "vacancy-uuid",
    "status": "PROCESSING",
    "vacancy": {
      "title": "Senior Developer",
      "company": "Tech Co"
    },
    "queueInfo": {
      "jobId": "123",
      "position": 2,
      "state": "active",
      "progress": 45
    },
    "createdAt": "2025-11-30T12:00:00Z"
  },
  {
    "id": "app-uuid-2",
    "vacancyId": "vacancy-uuid-2",
    "status": "COMPLETED",
    "resume": {
      "id": "resume-uuid",
      "title": "Full-Stack Developer"
    },
    "queueInfo": null,
    "createdAt": "2025-11-30T11:50:00Z"
  }
]
```

### 3. Получить статус конкретного отклика

**GET** `/ai-applications/:id`

```bash
curl -X GET http://localhost:3001/ai-applications/app-uuid \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. Статистика очереди

**GET** `/ai-applications/queue/stats`

```bash
curl -X GET http://localhost:3001/ai-applications/queue/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "waiting": 5,
  "active": 2,
  "completed": 123,
  "failed": 3,
  "delayed": 0,
  "total": 133
}
```

### 5. Отменить отклик

**DELETE** `/ai-applications/:id`

```bash
curl -X DELETE http://localhost:3001/ai-applications/app-uuid \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 📊 Статусы откликов

| Статус | Описание | Следующий статус |
|--------|----------|------------------|
| `QUEUED` | В очереди, ожидает обработки | `PROCESSING` |
| `PROCESSING` | AI генерирует резюме | `COMPLETED` или `FAILED` |
| `COMPLETED` | Успешно обработан | - |
| `FAILED` | Ошибка при обработке | `QUEUED` (retry) |

## 🔄 Retry механизм

При ошибке job автоматически повторяется:
- **Attempts:** 3 попытки
- **Backoff:** Exponential (2s, 4s, 8s)
- **Remove on fail:** false (сохраняем для debugging)

## 🚀 Запуск

### Development:

```bash
# 1. Запустить Redis
docker-compose up redis -d

# 2. Запустить backend
cd backend
npm run dev
```

### Production:

```bash
docker-compose up -d
```

## 🧪 Тестирование

### Сценарий 1: Быстрый swipe

```bash
# 1. Авторизация
TOKEN="your-jwt-token"

# 2. Получить вакансии
curl -X GET 'http://localhost:3001/vacancies?page=0&perPage=5' \
  -H "Authorization: Bearer $TOKEN" | jq '.items[0].id'

# 3. Swipe (добавить в очередь)
VACANCY_ID="vacancy-uuid"
curl -X POST http://localhost:3001/ai-applications/queue \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"vacancyId\": \"$VACANCY_ID\"}"

# Response: {"jobId":"123","queuePosition":1,"status":"QUEUED"}
# Ответ моментальный! (~50ms)
```

### Сценарий 2: Мониторинг прогресса

```bash
# Получить все отклики со статусами
curl -X GET http://localhost:3001/ai-applications \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Проверить статистику очереди
curl -X GET http://localhost:3001/ai-applications/queue/stats \
  -H "Authorization: Bearer $TOKEN"
```

### Сценарий 3: Массовый swipe

```bash
# Быстро свайпнуть 10 вакансий подряд
for i in {1..10}; do
  curl -X POST http://localhost:3001/ai-applications/queue \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"vacancyId\": \"vacancy-$i\"}"
  echo "Swiped $i"
done

# Все 10 откликов добавятся моментально!
# AI обработает их в фоне по очереди
```

## 📈 Performance

| Метрика | Значение |
|---------|----------|
| Время добавления в очередь | ~50ms |
| Время обработки одного job | 2-5s |
| Пропускная способность | ~12-30 откликов/минуту |
| Параллельная обработка | До 5 job'ов одновременно |

## 🐛 Troubleshooting

### Redis не запускается
```bash
# Проверить логи
docker logs jobjam-redis

# Перезапустить
docker-compose restart redis
```

### Job застрял в PROCESSING
```bash
# Проверить логи backend
docker logs jobjam-backend

# Job автоматически провалится через timeout
# И retry через exponential backoff
```

### Очередь переполнена
```bash
# Проверить статистику
curl http://localhost:3001/ai-applications/queue/stats

# Очистить failed job'ы через Bull Dashboard (опционально)
```

## 🔍 Мониторинг

### Bull Board (опционально)

Можно добавить веб-интерфейс для мониторинга очередей:

```bash
npm install @bull-board/express
```

Доступ к дашборду: `http://localhost:3001/admin/queues`

## 🎯 Use Cases

### 1. Swipe интерфейс
Пользователь свайпает вакансии вправо → моментально добавляется в очередь → продолжает свайпать

### 2. Массовые отклики
Пользователь выбирает 20 вакансий → все добавляются в очередь за секунду → обрабатываются в фоне

### 3. Ночная обработка
Днем пользователи свайпают → ночью система обрабатывает все отклики когда нагрузка низкая

## 📋 Checklist

- [x] BullMQ установлен
- [x] Redis в Docker Compose
- [x] Queue модуль создан
- [x] AIApplicationQueue сервис
- [x] AIApplicationProcessor
- [x] API endpoints
- [x] Статусы в БД
- [x] Retry механизм
- [x] Документация

## 🚀 Next Steps

1. **Frontend интеграция:**
   - Swipe компонент с queue status
   - Progress bar для откликов
   - Real-time updates (WebSockets)

2. **Оптимизация:**
   - Приоритеты в очереди
   - Rate limiting
   - Кэширование результатов

3. **Аналитика:**
   - Метрики производительности
   - Success rate
   - Average processing time

---

**Статус:** ✅ Fully Functional  
**Дата:** 30 ноября 2025

