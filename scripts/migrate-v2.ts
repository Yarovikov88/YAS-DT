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

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Анализирует связи и пытается определить их тип на основе контекста
 */
function inferRelationType(
  sourceFact: YasFact,
  targetFact: YasFact
): RelationType {
  const sourceContent = sourceFact.content.toLowerCase();
  const targetContent = targetFact.content.toLowerCase();
  
  // Простая эвристика для определения типа связи
  if (sourceContent.includes('основ') || sourceContent.includes('фундамент')) {
    return 'prerequisite_for';
  }
  if (sourceContent.includes('влия') || sourceContent.includes('impact')) {
    return 'influences';
  }
  if (sourceContent.includes('причин') || sourceContent.includes('следств')) {
    return 'causes';
  }
  if (sourceContent.includes('похож') || sourceContent.includes('аналог')) {
    return 'similar_to';
  }
  if (sourceFact.section === targetFact.section) {
    return 'related_to';
  }
  
  return 'related_to'; // по умолчанию
}

/**
 * Извлекает уникальные категории и секции из фактов
 */
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

/**
 * Преобразует плоские массивы relations в типизированные связи
 */
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
        console.warn(`⚠️  Связь ${sourceFact.id} -> ${targetId}: целевой факт не найден`);
        return;
      }
      
      // Избегаем дублирования связей
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

async function runMigrationV2() {
  console.log("🚀 Запуск миграции YAS v2.0 (Семантический граф знаний)...\n");
  
  // 1. Читаем данные
  const jsonPath = path.join(ROOT_DIR, 'data/yas_core_v2.6.json');
  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const coreData: YasCoreStructure = JSON.parse(rawData);
  const facts = coreData.knowledge_base;
  
  console.log(`📦 Загружено фактов: ${facts.length}`);
  
  // 2. Дедупликация и очистка
  const seenTitles = new Set<string>();
  const seenIds = new Set<number>();
  let currentMaxId = Math.max(...facts.map(f => Number(f.id) || 0));
  
  const cleanFacts: YasFact[] = [];
  
  facts.forEach(fact => {
    const titleKey = fact.title.trim().toLowerCase();
    
    // Пропускаем дубликаты по названию
    if (seenTitles.has(titleKey)) {
      console.log(`🗑️  Пропущен дубликат: "${fact.title}"`);
      return;
    }
    seenTitles.add(titleKey);
    
    // Если ID занят, назначаем новый
    let factId = Number(fact.id);
    if (seenIds.has(factId)) {
      currentMaxId++;
      console.log(`⚡️ Переназначен ID ${factId} -> ${currentMaxId} для "${fact.title}"`);
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
  
  console.log(`✅ Очищено фактов: ${cleanFacts.length}\n`);
  
  // 3. Извлекаем метаданные
  const { categories, sections } = extractMetadata(cleanFacts);
  console.log(`📊 Категорий: ${categories.length}`);
  console.log(`📂 Секций: ${sections.length}\n`);
  
  // 4. Строим типизированные связи
  const typedRelations = buildTypedRelations(cleanFacts);
  console.log(`🔗 Построено связей: ${typedRelations.length}\n`);
  
  // 5. Применяем SQL-схему
  console.log("📝 Применение SQL-схемы...");
  const schemaPath = path.join(ROOT_DIR, 'scripts/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  
  // Supabase не поддерживает прямое выполнение SQL через JS SDK
  // Нужно выполнить через Dashboard или CLI
  console.log("⚠️  SQL-схему нужно применить вручную через Supabase Dashboard");
  console.log("   Файл: scripts/schema.sql\n");
  
  // 6. Очищаем старые данные
  console.log("🧹 Очистка старых данных...");
  await supabase.from('fact_relations').delete().neq('id', 0);
  await supabase.from('facts').delete().neq('id', 0);
  await supabase.from('categories').delete().neq('id', 0);
  await supabase.from('sections').delete().neq('id', 0);
  
  // 7. Загружаем категории и секции
  console.log("📥 Загрузка категорий...");
  const { error: catError } = await supabase
    .from('categories')
    .insert(categories);
  
  if (catError) {
    console.error("❌ Ошибка загрузки категорий:", catError.message);
  } else {
    console.log(`✅ Загружено категорий: ${categories.length}`);
  }
  
  console.log("📥 Загрузка секций...");
  const { error: secError } = await supabase
    .from('sections')
    .insert(sections);
  
  if (secError) {
    console.error("❌ Ошибка загрузки секций:", secError.message);
  } else {
    console.log(`✅ Загружено секций: ${sections.length}`);
  }
  
  // 8. Загружаем факты (без поля relations для новой схемы)
  console.log("\n📥 Загрузка фактов...");
  const factsToInsert = cleanFacts.map(({ relations, ...fact }) => fact);
  
  const { data: factsData, error: factsError } = await supabase
    .from('facts')
    .insert(factsToInsert)
    .select();
  
  if (factsError) {
    console.error("❌ Ошибка загрузки фактов:", factsError.message);
    return;
  }
  
  console.log(`✅ Загружено фактов: ${factsData.length}`);
  
  // 9. Загружаем типизированные связи
  console.log("\n📥 Загрузка связей...");
  
  if (typedRelations.length > 0) {
    const { data: relData, error: relError } = await supabase
      .from('fact_relations')
      .insert(typedRelations)
      .select();
    
    if (relError) {
      console.error("❌ Ошибка загрузки связей:", relError.message);
    } else {
      console.log(`✅ Загружено связей: ${relData.length}`);
    }
  } else {
    console.log("⚠️  Связей не найдено в исходных данных");
  }
  
  // 10. Статистика
  console.log("\n" + "=".repeat(60));
  console.log("🎉 МИГРАЦИЯ ЗАВЕРШЕНА УСПЕШНО!");
  console.log("=".repeat(60));
  console.log(`📊 Статистика:`);
  console.log(`   • Фактов (узлов графа): ${factsData.length}`);
  console.log(`   • Связей (рёбер графа): ${typedRelations.length}`);
  console.log(`   • Категорий: ${categories.length}`);
  console.log(`   • Секций: ${sections.length}`);
  console.log(`   • Средняя связность: ${(typedRelations.length / factsData.length).toFixed(2)} связей/факт`);
  console.log("\n🧠 Семантический граф знаний YAS готов к работе!");
}

runMigrationV2().catch(console.error);
