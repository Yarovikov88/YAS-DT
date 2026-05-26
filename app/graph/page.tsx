'use client';

import { useEffect, useState } from 'react';

interface Node {
  id: number;
  label: string;
  category: string;
  section: string;
  weight: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface Edge {
  source: number;
  target: number;
  type: string;
  weight: number;
}

interface GraphData {
  nodes: Node[];
  edges: Edge[];
  stats: {
    nodes_count: number;
    edges_count: number;
    avg_degree: number;
  };
}

export default function GraphPage() {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  useEffect(() => {
    fetch('/api/graph')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setGraphData(data.graph);
        } else {
          setError(data.error || 'Failed to load graph');
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <div>Загрузка графа...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{ color: '#ff4444' }}>Ошибка: {error}</div>
        <div style={{ fontSize: '0.9rem', color: '#888' }}>
          Убедитесь, что:
          <ul style={{ marginTop: '0.5rem', listStyle: 'none' }}>
            <li>• .env.local настроен</li>
            <li>• SQL-схема применена</li>
            <li>• Миграция выполнена (npm run db:migrate:v2)</li>
          </ul>
        </div>
      </div>
    );
  }

  if (!graphData) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <div>Нет данных</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
          📊 Граф знаний YAS
        </h1>
        <div style={{ color: '#888', fontSize: '0.9rem' }}>
          Узлов: {graphData.stats.nodes_count} | 
          Связей: {graphData.stats.edges_count} | 
          Средняя связность: {graphData.stats.avg_degree.toFixed(2)}
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: selectedNode ? '1fr 400px' : '1fr',
        gap: '2rem',
        height: 'calc(100vh - 150px)'
      }}>
        {/* Область визуализации */}
        <div style={{ 
          background: '#1a1a1a', 
          borderRadius: '8px',
          padding: '2rem',
          overflow: 'auto'
        }}>
          <div style={{ color: '#888', textAlign: 'center', padding: '4rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚧</div>
            <div style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>
              Canvas-визуализация в разработке
            </div>
            <div style={{ fontSize: '0.9rem' }}>
              Здесь будет force-directed граф с интерактивными узлами
            </div>
          </div>

          {/* Временный список узлов */}
          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Узлы графа:</h3>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: '1rem'
            }}>
              {graphData.nodes.slice(0, 20).map(node => (
                <div
                  key={node.id}
                  onClick={() => setSelectedNode(node)}
                  style={{
                    padding: '1rem',
                    background: selectedNode?.id === node.id ? '#2a2a2a' : '#0a0a0a',
                    border: '1px solid #333',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    {node.label}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#888' }}>
                    {node.category} • {node.section}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Панель деталей */}
        {selectedNode && (
          <div style={{ 
            background: '#1a1a1a', 
            borderRadius: '8px',
            padding: '2rem',
            overflow: 'auto'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <h3>Детали узла</h3>
              <button
                onClick={() => setSelectedNode(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#888',
                  cursor: 'pointer',
                  fontSize: '1.5rem'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ lineHeight: '2' }}>
              <div><strong>ID:</strong> {selectedNode.id}</div>
              <div><strong>Название:</strong> {selectedNode.label}</div>
              <div><strong>Категория:</strong> {selectedNode.category}</div>
              <div><strong>Секция:</strong> {selectedNode.section}</div>
              <div><strong>Вес:</strong> {selectedNode.weight}</div>
              {selectedNode.age && (
                <div><strong>Возраст:</strong> {selectedNode.age}</div>
              )}
            </div>

            <div style={{ marginTop: '2rem' }}>
              <h4 style={{ marginBottom: '1rem' }}>Связи:</h4>
              <div style={{ fontSize: '0.9rem', color: '#888' }}>
                {graphData.edges.filter(
                  e => e.source === selectedNode.id || e.target === selectedNode.id
                ).length} связей
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
