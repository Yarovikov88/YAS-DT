import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkFacts() {
  const { data, error, count } = await supabase
    .from('facts')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log(`Total facts in DB: ${count}`);

  // Show first few and last few
  const { data: first } = await supabase.from('facts').select('id, title').order('id', { ascending: true }).limit(5);
  const { data: last } = await supabase.from('facts').select('id, title').order('id', { ascending: false }).limit(5);

  console.log('\nFirst 5 facts:');
  first?.forEach(f => console.log(`  ${f.id}: ${f.title}`));

  console.log('\nLast 5 facts:');
  last?.reverse().forEach(f => console.log(`  ${f.id}: ${f.title}`));

  // Check for duplicates by title
  const { data: duplicates } = await supabase
    .rpc('get_duplicate_titles');

  if (duplicates && duplicates.length > 0) {
    console.log(`\nFound ${duplicates.length} duplicate titles`);
  }
}

checkFacts();
