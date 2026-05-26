import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const ROOT_DIR = process.cwd();

// Чтение .env.local
const envPath = path.join(ROOT_DIR, '.env.local');
if (fs.existsSync(envPath)) {
  const envLines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of envLines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...valueParts] = trimmed.split('=');
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function setupDatabase() {
  console.log("🚀 Настройка базы данных...\n");

  // Проверяем подключение
  console.log("🔌 Проверка подключения к Supabase...");
  const { data: testData, error: testError } = await supabase
    .from('facts')
    .select('count')
    .limit(1);

  if (testError) {
    if (testError.message.includes('relation "facts" does not exist')) {
      console.log("⚠️  Таблица 'facts' не существует.");
      console.log("\n📋 Необходимо применить SQL-схему вручную:");
      console.log("1. Откройте Supabase Dashboard");
      console.log("2. Перейдите в SQL Editor");
      console.log("3. Скопируйте содержимое файла scripts/schema.sql");
      console.log("4. Вставьте и выполните SQL");
      console.log("\nПосле этого запустите: npm run db:migrate:v2\n");
      process.exit(1);
    } else {
      console.error("❌ Ошибка подключения:", testError.message);
      process.exit(1);
    }
  }

  console.log("✅ Подключение успешно!\n");

  // Проверяем наличие данных
  const { count } = await supabase
    .from('facts')
    .select('*', { count: 'exact', head: true });

  console.log(`📊 Фактов в базе: ${count || 0}`);

  if (count === 0) {
    console.log("\n⚠️  База данных пуста. Запустите миграцию:");
    console.log("npm run db:migrate:v2\n");
  } else {
    console.log("\n✅ База данных настроена и содержит данные!");
  }
}

setupDatabase().catch(console.error);
