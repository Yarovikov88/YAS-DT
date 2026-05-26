export interface SystemInfo {
  name: string;
  version: string;
  architect: string;
  total_facts: number;
  sections: string[];
}

// Типы связей в графе знаний
export type RelationType = 
  | 'causes'           // причинно-следственная связь
  | 'influences'       // влияние
  | 'contradicts'      // противоречие
  | 'supports'         // поддержка
  | 'derives_from'     // происходит из
  | 'applies_to'       // применяется к
  | 'similar_to'       // похоже на
  | 'part_of'          // часть чего-то
  | 'prerequisite_for' // предусловие для
  | 'related_to';      // общая связь

export interface YasFact {
  id: number;
  title: string;
  content: string;
  category: string;
  section: string;
  created_at: string;
  weight: number;
  relations?: number[]; // legacy: плоский массив для обратной совместимости
  status?: 'active' | 'archived';
  age?: number;
}

// Новая структура для семантических связей
export interface FactRelation {
  id?: number;
  source_fact_id: number;
  target_fact_id: number;
  relation_type: RelationType;
  weight?: number;        // вес связи (0-1)
  description?: string;   // описание связи
  created_at?: string;
}

// Факт с типизированными связями
export interface YasFactWithRelations extends YasFact {
  typed_relations?: FactRelation[];
}

// Категория для группировки фактов
export interface Category {
  id?: number;
  name: string;
  description?: string;
  color?: string;
}

// Секция для структурирования знаний
export interface Section {
  id?: number;
  name: string;
  description?: string;
  order?: number;
}

export interface YasCoreStructure {
  system_info: SystemInfo;
  knowledge_base: YasFact[];
}

// Новая структура для v2.0
export interface YasCoreV2Structure {
  system_info: SystemInfo;
  facts: YasFactWithRelations[];
  relations: FactRelation[];
  categories: Category[];
  sections: Section[];
}
