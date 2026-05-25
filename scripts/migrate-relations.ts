import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be defined');
  process.exit(1);
}

async function fetchSupabase(method: string, endpoint: string, body?: any) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);

  if (!res.ok) {
    const text = await res.text();
    console.error(`${method} ${endpoint} failed: ${res.status} ${text}`);
    throw new Error(`Supabase request failed: ${res.status}`);
  }

  return res.json();
}

async function main() {
  console.log('Loading relations from yas_core.json...');

  const filePath = path.join(process.cwd(), 'data', 'yas_core.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const facts = data.knowledge_base || [];

  // Create a map of original IDs to database IDs
  // Original IDs start from 1, but we might have different IDs in DB
  const idMap = new Map<number, number>();
  facts.forEach((fact: any) => {
    idMap.set(fact.id, fact.id);
  });

  const relations: any[] = [];
  let relationCount = 0;

  // Build relations array from source data
  for (const fact of facts) {
    if (fact.relations && Array.isArray(fact.relations)) {
      const sourceId = idMap.get(fact.id);
      
      for (const targetId of fact.relations) {
        const mappedTargetId = idMap.get(targetId);
        
        if (sourceId && mappedTargetId) {
          relations.push({
            source_id: sourceId,
            target_id: mappedTargetId,
            relation_type: 'related',
            relation_strength: 1.0
          });
          relationCount++;
        }
      }
    }
  }

  console.log(`Found ${relationCount} relations to insert...`);

  if (relationCount === 0) {
    console.log('No relations found to insert');
    return;
  }

  // Insert relations one by one to avoid duplicates
  let inserted = 0;
  let skipped = 0;
  
  for (const relation of relations) {
    try {
      await fetchSupabase('POST', 'fact_relations', relation);
      inserted++;
      if (inserted % 10 === 0) {
        process.stdout.write(`\r✓ Inserted: ${inserted}, Skipped: ${skipped}`);
      }
    } catch (e: any) {
      // Skip duplicate key errors
      if (e.message?.includes('409') || e.message?.includes('duplicate')) {
        skipped++;
        continue;
      }
      console.error(`\nFailed to insert relation:`, e);
      throw e;
    }
  }
  
  console.log(`\n✓ Total inserted: ${inserted}, Skipped (duplicates): ${skipped}`);
  console.log('✓ Migration complete!');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
