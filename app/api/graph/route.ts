import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be defined');
}

async function fetchSupabase<T>(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
      Accept: 'application/json',
      Prefer: 'count=exact'
    }
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase REST ${path} failed: ${res.status} ${body}`);
  }

  return (await res.json()) as T;
}

export async function GET() {
  try {
    const [facts, categories, sections, relations] = await Promise.all([
      fetchSupabase<any[]>('facts?select=id,title,weight,category_id,section_id'),
      fetchSupabase<any[]>('categories?select=id,name'),
      fetchSupabase<any[]>('sections?select=id,name'),
      fetchSupabase<any[]>('fact_relations?select=id,source_id,target_id,relation_type,relation_strength')
    ]);

    const categoryMap = new Map((categories || []).map((c) => [c.id, c.name]));
    const sectionMap = new Map((sections || []).map((s) => [s.id, s.name]));

    const nodes = (facts || []).map((f) => ({
      id: f.id,
      label: f.title,
      category: categoryMap.get(f.category_id) || null,
      section: sectionMap.get(f.section_id) || null,
      weight: Number(f.weight) || 1.0
    }));

    const edges = (relations || []).map((r) => ({
      id: r.id,
      source: r.source_id,
      target: r.target_id,
      type: r.relation_type,
      weight: Number(r.relation_strength) || 1.0
    }));

    return NextResponse.json({ nodes, edges });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
