import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function cleanupDuplicates() {
  // Get all facts grouped by title
  const { data: facts, error } = await supabase
    .from('facts')
    .select('id, title')
    .order('id', { ascending: true });

  if (error) {
    console.error('Error fetching facts:', error);
    process.exit(1);
  }

  const seen = new Map<string, number>();
  const toDelete: number[] = [];

  for (const fact of facts || []) {
    if (seen.has(fact.title)) {
      toDelete.push(fact.id);
    } else {
      seen.set(fact.title, fact.id);
    }
  }

  console.log(`Found ${toDelete.length} duplicate facts to delete`);

  if (toDelete.length === 0) {
    console.log('No duplicates found');
    process.exit(0);
  }

  // Delete duplicates in batches
  for (let i = 0; i < toDelete.length; i += 100) {
    const batch = toDelete.slice(i, i + 100);
    const { error: deleteError } = await supabase
      .from('facts')
      .delete()
      .in('id', batch);

    if (deleteError) {
      console.error('Error deleting batch:', deleteError);
      process.exit(1);
    }
    console.log(`Deleted ${batch.length} facts`);
  }

  console.log(`✅ Cleanup complete. Deleted ${toDelete.length} duplicates`);

  // Show final count
  const { count, error: countError } = await supabase
    .from('facts')
    .select('*', { count: 'exact', head: true });

  console.log(`Total facts remaining: ${count}`);
}

cleanupDuplicates();
