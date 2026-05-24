-- Create facts table
CREATE TABLE IF NOT EXISTS facts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  section VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  weight NUMERIC(3,2) DEFAULT 1.00,
  status VARCHAR(50) DEFAULT 'active',
  hpi_impact_sphere VARCHAR(100),
  energy_cost NUMERIC(3,2),
  voltage_generation NUMERIC(3,2)
);
CREATE INDEX IF NOT EXISTS idx_facts_category ON facts(category);

-- Create fact_relations table
CREATE TABLE IF NOT EXISTS fact_relations (
  id SERIAL PRIMARY KEY,
  source_id INT REFERENCES facts(id) ON DELETE CASCADE,
  target_id INT REFERENCES facts(id) ON DELETE CASCADE,
  relation_type VARCHAR(100) NOT NULL,
  relation_strength NUMERIC(3,2) DEFAULT 1.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_source_target_type UNIQUE (source_id, target_id, relation_type)
);
CREATE INDEX IF NOT EXISTS idx_relations_source ON fact_relations(source_id);
CREATE INDEX IF NOT EXISTS idx_relations_target ON fact_relations(target_id);
