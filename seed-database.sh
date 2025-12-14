#!/bin/bash

echo "🌱 JobJam Database Seed Script"
echo "================================"
echo ""

# Проверка что мы в правильной директории
if [ ! -f "package.json" ]; then
  echo "❌ Ошибка: Запустите скрипт из директории backend/"
  exit 1
fi

# Установка зависимостей если нужно
if [ ! -d "node_modules" ]; then
  echo "📦 Установка зависимостей..."
  npm install
fi

# Генерация Prisma Client
echo "🔧 Генерация Prisma Client..."
npx prisma generate

# Запуск seed
echo ""
echo "🌱 Запуск seed скрипта..."
echo ""
npm run db:seed

echo ""
echo "✅ Готово!"

