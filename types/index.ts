export interface SystemInfo {
  name: string;
  version: string;
  architect: string;
  total_facts: number;
  sections: string[];
}

export interface YasFact {
  id: number;
  title: string;
  content: string;
  category: string;
  section: string;
  created_at: string;
  weight: number;
  relations: number[];
  status?: 'active' | 'archived';
  age?: number;
}

export interface YasCoreStructure {
  system_info: SystemInfo;
  knowledge_base: YasFact[];
}
