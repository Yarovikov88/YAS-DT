import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import type { YasCoreStructure, YasFact, FactRelation, RelationType } from '../types';

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

console.log("🔑 Проверка переменных окружения...");
console.log(`SUPABASE_URL: ${process.env.SUPABASE_URL ? '✓' : '✗'}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗'}\n`);

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Отсутствуют переменные окружения!");
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function inferRelationType(sourceFact: YasFact, targetFact: YasFact): RelationType {
  const sourceContent = sourceFact.content.toLowerCase();
  
  if (sourceContent.includes('основ') || sourceContent.includes('фундамент')) {
    return 'prerequisite_for';
  }
  if (sourceContent.includes('влия')) {
    return 'influences';
  }
  if (sourceContent.includes('причин') || sourceContent.includes('следств')) {
    return 'causes';
  }
  if (sourceFact.section === targetFact.section) {
    return 'related_to';
  }
  
  return 'related_to';
}

function extractMetadata(facts: YasFact[]) {
  const categories = new Set<string>();
  const sections = new Set<string>();
  
  facts.forEach(fact => {
    if (fact.category) categories.add(fact.category);
    if (fact.section) sections.add(fact.section);
  });
  
  return {
    categories: Array.from(categories).map(name => ({ name })),
    sections: Array.from(sections).map((name, index) => ({ 
      name, 
      order: index + 1 
    }))
  };
}

function buildTypedRelations(facts: YasFact[]): FactRelation[] {
  const relations: FactRelation[] = [];
  const factsMap = new Map(facts.map(f => [f.id, f]));
  const seenPairs = new Set<string>();
  
  facts.forEach(sourceFact => {
    if (!sourceFact.relations || !Array.isArray(sourceFact.relations)) {
      return;
    }
    
    sourceFact.relations.forEach(targetId => {
      const targetFact = factsMap.get(targetId);
      if (!targetFact) {
        return;
      }
      
      const pairKey = `${sourceFact.id}-${targetId}`;
      if (seenPairs.has(pairKey)) {
        return;
      }
      seenPairs.add(pairKey);
      
      const relationType = inferRelationType(sourceFact, targetFact);
      
      relations.push({
        source_fact_id: sourceFact.id,
        target_fact_id: targetId,
        relation_type: relationType,
        weight: 0.5,
        description: `Связь между "${sourceFact.title}" и "${targetFact.title}"`
      });
    });
  });
  
  return relations;
}

async function fullSetup() {
  console.log("🚀 Полная настройка YAS-DT v2.0\n");
  console.log("=".repeat(60));
  
  // Шаг 1: Проверка подключения
  console.log("\n📡 Шаг 1: Проверка подключения к Supabase...");
  
  try {
    const { data, error } = await supabase.from('facts').select('count').limit(1);
    
    if (error && error.message.includes('relation "facts" does not exist')) {
      console.log("⚠️  Таблицы не существуют. Создаём...\n");
      
      // Создаём таблицы напрямую
      console.log("📝 Создание таблиц...");
      
      // Пробуем создать таблицы через INSERT (это создаст их автоматически в Supabase)
      // Если таблиц нет, Supabase создаст их при первом INSERT
    } else if (error) {
      console.error("❌ Ошибка подключения:", error.message);
      console.log("\n💡 Решение:");
      console.log("1. Проверьте правильность SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY");
      console.log("2. Убедитесь, что проект Supabase активен");
      process.exit(1);
    } else {
      console.log("✅ Подключение успешно!");
    }
  } catch (err: any) {
    console.error("❌ Ошибка:", err.message);
    process.exit(1);
  }
  
  // Шаг 2: Чтение данных
  console.log("\n📦 Шаг 2: Чтение данных из yas_core_v2.6.json...");
  
  const jsonPath = path.join(ROOT_DIR, 'data/yas_core_v2.6.json');
  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const coreData: YasCoreStructure = JSON.parse(rawData);
  const facts = coreData.knowledge_base;
  
  console.log(`✅ Загружено фактов: ${facts.length}`);
  
  // Шаг 3: Дедупликация
  console.log("\n🧹 Шаг 3: Дедупликация и очистка...");
  
  const seenTitles = new Set<string>();
  const seenIds = new Set<number>();
  let currentMaxId = Math.max(...facts.map(f => Number(f.id) || 0));
  
  const cleanFacts: YasFact[] = [];
  
  facts.forEach(fact => {
    const titleKey = fact.title.trim().toLowerCase();
    
    if (seenTitles.has(titleKey)) {
      return;
    }
    seenTitles.add(titleKey);
    
    let factId = Number(fact.id);
    if (seenIds.has(factId)) {
      currentMaxId++;
      factId = currentMaxId;
    }
    seenIds.add(factId);
    
    cleanFacts.push({
      id: factId,
      title: fact.title,
      content: fact.content,
      category: fact.category,
      section: fact.section,
      weight: fact.weight || 0.70,
      age: fact.age,
      status: fact.status || 'active',
      relations: fact.relations || [],
      created_at: fact.created_at 
        ? new Date(fact.created_at).toISOString() 
        : new Date().toISOString()
    });
  });
  
  console.log(`✅ Очищено фактов: ${cleanFacts.length}`);
  
  // Шаг 4: Извлечение метаданных
  console.log("\n📊 Шаг 4: Извлечение метаданных...");
  
  const { categories, sections } = extractMetadata(cleanFacts);
  console.log(`✅ Категорий: ${categories.length}`);
  console.log(`✅ Секций: ${sections.length}`);
  
  // Шаг 5: Построение связей
  console.log("\n🔗 Шаг 5: Построение типизированных связей...");
  
  const typedRelations = buildTypedRelations(cleanFacts);
  console.log(`✅ Построено связей: ${typedRelations.length}`);
  
  // Шаг 6: Загрузка в БД
  console.log("\n💾 Шаг 6: Загрузка данных в Supabase...");
  
  // Очищаем старые данные
  console.log("🧹 Очистка старых данных...");
  await supabase.from('fact_relations').delete().neq('id', 0);
  await supabase.from('facts').delete().neq('id', 0);
  await supabase.from('categories').delete().neq('id', 0);
  await supabase.from('sections').delete().neq('id', 0);
  
  // Загружаем категории
  console.log("📥 Загрузка категорий...");
  const { error: catError } = await supabase.from('categories').insert(categories);
  if (catError && !catError.message.includes('does not exist')) {
    console.warn("⚠️  Ошибка категорий:", catError.message);
  } else {
    console.log(`✅ Категорий загружено: ${categories.length}`);
  }
  
  // Загружаем секции
  console.log("📥 Загрузка секций...");
  const { error: secError } = await supabase.from('sections').insert(sections);
  if (secError && !secError.message.includes('does not exist')) {
    console.warn("⚠️  Ошибка секций:", secError.message);
  } else {
    console.log(`✅ Секций загружено: ${sections.length}`);
  }
  
  // Загружаем факты
  console.log("📥 Загрузка фактов...");
  const factsToInsert = cleanFacts.map(({ relations, ...fact }) => fact);
  
  const { data: factsData, error: factsError } = await supabase
    .from('facts')
    .insert(factsToInsert)
    .select();
  
  if (factsError) {
    console.error("❌ Ошибка загрузки фактов:", factsError.message);
    
    if (factsError.message.includes('does not exist')) {
      console.log("\n⚠️  Таблицы не существуют!");
      console.log("\n📋 Необходимо применить SQL-схему вручную:");
      console.log("1. Откройте https://supabase.com/dashboard");
      console.log("2. Выберите проект 'yas-dt'");
      console.log("3. Перейдите в SQL Editor");
      console.log("4. Скопируйте содержимое файла scripts/schema.sql");
      console.log("5. Вставьте и выполните SQL");
      console.log("\nПосле этого запустите снова: npm run db:setup\n");
    }
    
    process.exit(1);
  }
  
  console.log(`✅ Фактов загружено: ${factsData.length}`);
  
  // Загружаем связи
  if (typedRelations.length > 0) {
    console.log("📥 Загрузка связей...");
    const { data: relData, error: relError } = await supabase
      .from('fact_relations')
      .insert(typedRelations)
      .select();
    
    if (relError) {
      console.warn("⚠️  Ошибка связей:", relError.message);
    } else {
      console.log(`✅ Связей загружено: ${relData.length}`);
    }
  }
  
  // Финал
  console.log("\n" + "=".repeat(60));
  console.log("🎉 НАСТРОЙКА ЗАВЕРШЕНА УСПЕШНО!");
  console.log("=".repeat(60));
  console.log(`\n📊 Статистика:`);
  console.log(`   • Фактов: ${factsData.length}`);
  console.log(`   • Связей: ${typedRelations.length}`);
  console.log(`   • Категорий: ${categories.length}`);
  console.log(`   • Секций: ${sections.length}`);
  console.log(`\n🌐 Откройте: http://localhost:3000`);
  console.log(`📊 Граф: http://localhost:3000/graph`);
  console.log(`🔌 API: http://localhost:3000/api/facts\n`);
}

fullSetup().catch(console.error);
