/**
 * Классификация всех фактов по сферам HPI и тегам через Gemini API.
 *
 * Сферы (1 на факт):
 *   loved    — Отношения с любимыми
 *   family   — Отношения с родными
 *   friends  — Друзья
 *   career   — Карьера
 *   physical — Физическое здоровье
 *   mental   — Ментальное здоровье
 *   hobby    — Хобби и увлечения
 *   wealth   — Благосостояние
 *
 * Теги (много на факт): свободные, но из контролируемых словарей:
 *   тип:     case, principle, philosophy, protocol, algorithm, lesson, mentor
 *   контекст:military, intelligence, it, legal, family, business, sport
 *   этап:    genesis, academy, growth, spb-msk, flynav, robius, expansion
 */
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

const SUPABASE_URL  = process.env.SUPABASE_URL!;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Нет SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!GEMINI_API_KEY) {
  console.error('❌ Нет GEMINI_API_KEY в .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const SPHERES = ['loved', 'family', 'friends', 'career', 'physical', 'mental', 'hobby', 'wealth'] as const;
const TAG_VOCABULARY = {
  type:    ['case', 'principle', 'philosophy', 'protocol', 'algorithm', 'lesson', 'mentor', 'method'],
  context: ['military', 'intelligence', 'it', 'legal', 'family', 'business', 'sport', 'leadership'],
  stage:   ['genesis', 'academy', 'growth', 'spb-msk', 'flynav', 'robius', 'expansion'],
};

const SYSTEM_PROMPT = `Ты классификатор фактов из digital twin Андрея Яровикова (YAS).
Каждый факт — событие из его жизни, осмысленное через метафору ИТ-архитектуры.
Тебе нужно определить ОДНУ сферу жизни и список тегов.

СФЕРЫ (выбери ровно одну):
- loved    — отношения с супругой/партнёром (личная, романтическая близость)
- family   — родители, дети (Степан), дом, родственники, генеалогия, семейные ритуалы
- friends  — дружба, друзья, наставники-ровесники, социальное окружение, networking
- career   — работа, должности, проекты ИТ/армии/юрпрактики (FlyNav, АФЛТ, начштаба, разведка)
- physical — физическое здоровье, спорт, тренировки, тело, питание, сон
- mental   — психология, сознание, фокус, медитация, трезвость, рефакторинг ума, ассертивность
- hobby    — творчество, ROBIUS как хобби-проект, обучение, интересы вне работы
- wealth   — деньги, инвестиции, недвижимость, стройка дома, финансовая стабильность

Если факт затрагивает несколько сфер — выбери ОСНОВНУЮ (та, без которой смысл факта теряется).

ТЕГИ (выбери 2-5 из словарей):
type:    case | principle | philosophy | protocol | algorithm | lesson | mentor | method
context: military | intelligence | it | legal | family | business | sport | leadership
stage:   genesis | academy | growth | spb-msk | flynav | robius | expansion

Правила:
- Хотя бы один tag из type
- Хотя бы один tag из context
- Если есть привязка к жизненному этапу — добавь stage
- Никаких других тегов вне словарей

ОТВЕТ строго в JSON формате массива:
[{"id": 1, "sphere": "...", "tags": ["...","..."]}, ...]
Без пояснений, без markdown, без backticks.`;

interface Fact {
  id: number;
  title: string;
  content: string;
  category: string;
  section: string;
}

interface Classification {
  id: number;
  sphere: string;
  tags: string[];
}

async function classifyBatch(facts: Fact[]): Promise<Classification[]> {
  const userMessage = facts.map(f =>
    `id=${f.id}\nназвание: ${f.title}\nстарая категория: ${f.category}\nстарая секция: ${f.section}\nконтент: ${f.content.slice(0, 600)}`
  ).join('\n\n---\n\n');

  const body = {
    contents: [{
      role: 'user',
      parts: [{ text: SYSTEM_PROMPT + '\n\n=== ФАКТЫ ===\n' + userMessage }],
    }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  // Parse JSON (с защитой от случайного markdown)
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```json?\s*/i, '').replace(/\s*```$/, '');
  }

  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error('Gemini вернул не массив');
  return parsed;
}

function validateClassification(c: Classification): string[] {
  const errors: string[] = [];
  if (!SPHERES.includes(c.sphere as any)) {
    errors.push(`bad sphere: ${c.sphere}`);
  }
  if (!Array.isArray(c.tags) || c.tags.length === 0) {
    errors.push('no tags');
  }
  const allowed = new Set([
    ...TAG_VOCABULARY.type,
    ...TAG_VOCABULARY.context,
    ...TAG_VOCABULARY.stage,
  ]);
  for (const t of c.tags || []) {
    if (!allowed.has(t)) errors.push(`bad tag: ${t}`);
  }
  return errors;
}

async function main() {
  console.log('🧠 Классификация фактов по сферам HPI и тегам через Gemini\n');

  // Загружаем все факты
  const { data: facts, error } = await supabase
    .from('facts')
    .select('id, title, content, category, section')
    .eq('status', 'active')
    .order('id');

  if (error || !facts) {
    console.error('❌ Не удалось загрузить факты:', error?.message);
    process.exit(1);
  }

  console.log(`📦 Получено фактов: ${facts.length}`);

  // Делим на батчи по 15 — экономим квоту Gemini Free Tier
  const BATCH_SIZE = 15;
  const all: Classification[] = [];

  for (let i = 0; i < facts.length; i += BATCH_SIZE) {
    const batch = facts.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(facts.length / BATCH_SIZE);

    console.log(`\n🔄 Батч ${batchNum}/${totalBatches} (факты ${batch[0].id}…${batch[batch.length - 1].id})`);

    let attempt = 0;
    while (attempt < 4) {
      try {
        const result = await classifyBatch(batch);
        // Валидация
        const issues: string[] = [];
        for (const c of result) {
          const errs = validateClassification(c);
          if (errs.length) issues.push(`#${c.id}: ${errs.join(', ')}`);
        }
        if (issues.length) {
          console.warn(`  ⚠️  ${issues.length} некорректных классификаций:`);
          issues.slice(0, 5).forEach(s => console.warn(`     ${s}`));
        }
        all.push(...result);
        console.log(`  ✅ Получено классификаций: ${result.length}`);
        break;
      } catch (err: any) {
        attempt++;
        const isRateLimit = err.message.includes('429');
        const wait = isRateLimit ? Math.min(60000, 5000 * Math.pow(2, attempt)) : 2000;
        console.warn(`  ⚠️  Попытка ${attempt}/4 не удалась: ${err.message.slice(0, 100)} → жду ${wait / 1000}с`);
        if (attempt >= 4) {
          console.error('  ❌ Батч пропущен');
        } else {
          await new Promise(r => setTimeout(r, wait));
        }
      }
    }

    // Троттлинг между батчами (Gemini 1.5 Flash Free = 15 RPM)
    await new Promise(r => setTimeout(r, 4500));
  }

  console.log(`\n📊 Итого классификаций: ${all.length} / ${facts.length}`);

  // Сохраняем в файл (бекап перед записью в БД)
  const outPath = path.join(ROOT_DIR, 'data/classifications.json');
  fs.writeFileSync(outPath, JSON.stringify(all, null, 2), 'utf-8');
  console.log(`💾 Бэкап классификаций: ${outPath}`);

  // Записываем в БД батчами
  console.log('\n📥 Запись в Supabase...');
  let updated = 0;
  for (const c of all) {
    const sphere = SPHERES.includes(c.sphere as any) ? c.sphere : null;
    const tags = (c.tags || []).filter(t => {
      const allowed = new Set([...TAG_VOCABULARY.type, ...TAG_VOCABULARY.context, ...TAG_VOCABULARY.stage]);
      return allowed.has(t);
    });

    const { error: upErr } = await supabase
      .from('facts')
      .update({ sphere, tags })
      .eq('id', c.id);

    if (upErr) {
      console.warn(`  ⚠️  id=${c.id}: ${upErr.message}`);
    } else {
      updated++;
    }
  }

  console.log(`\n✅ Обновлено фактов: ${updated} / ${all.length}`);

  // Сводка по сферам
  const counts: Record<string, number> = {};
  for (const c of all) counts[c.sphere] = (counts[c.sphere] || 0) + 1;
  console.log('\n📊 Распределение по сферам:');
  for (const s of SPHERES) {
    console.log(`   ${s.padEnd(10)} : ${counts[s] || 0}`);
  }
}

main().catch(err => {
  console.error('💥', err);
  process.exit(1);
});
