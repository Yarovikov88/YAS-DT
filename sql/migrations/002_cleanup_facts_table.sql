-- Cleanup redundant columns in facts after introducing normalized graph schema
ALTER TABLE IF EXISTS facts
  DROP COLUMN IF EXISTS relations,
  DROP COLUMN IF EXISTS category;

-- Keep category_id and section_id as the canonical references
-- If needed, convert any existing string values to normalized lookup tables first.
