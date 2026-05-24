"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

const ForceGraph2D = dynamic(
  () => import('react-force-graph').then((mod) => mod.ForceGraph2D),
  { ssr: false }
);

type GraphNode = {
  id: number;
  name: string;
  val: number;
  category: string | null;
  section: string | null;
};

type GraphLink = {
  source: number;
  target: number;
  type: string;
  weight: number;
};

export default function GraphPage() {
  const [graph, setGraph] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const fgRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;

    fetch('/api/graph')
      .then((response) => {
        if (!response.ok) throw new Error(`Server error ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (!mounted) return;
        setGraph({ nodes: data.nodes || [], links: data.edges || [] });
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || 'Не удалось загрузить граф');
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const graphData = useMemo(
    () => ({
      nodes: graph.nodes.map((n) => ({ id: n.id, name: n.name, val: n.val, category: n.category, section: n.section })),
      links: graph.links.map((e) => ({ source: e.source, target: e.target, type: e.type, weight: e.weight }))
    }),
    [graph]
  );

  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node);
    if (!fgRef.current || !node) return;
    const nodeAny = node as any;
    const distance = 120;
    const distRatio = 1 + distance / Math.hypot(nodeAny.x - (fgRef.current?.centerX || 0), nodeAny.y - (fgRef.current?.centerY || 0));
    fgRef.current.cameraPosition({ x: nodeAny.x * distRatio, y: nodeAny.y * distRatio, z: 200 }, nodeAny, 3000);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', height: '100vh', background: '#060608', color: '#f5f5f5' }}>
      <section style={{ position: 'relative', minHeight: '100%' }}>
        <header style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.35rem' }}>YAS Graph</h1>
            <p style={{ margin: '6px 0 0', color: '#aaa', fontSize: '0.95rem' }}>Интерактивная визуализация фактов и связей.</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', color: '#ccc' }}>Узлов: {graph.nodes.length}</div>
            <div style={{ fontSize: '0.85rem', color: '#ccc' }}>Связей: {graph.links.length}</div>
          </div>
        </header>

        {loading ? (
          <div style={{ padding: '24px', color: '#ddd' }}>Загрузка графа...</div>
        ) : error ? (
          <div style={{ padding: '24px', color: '#ff7676' }}>Ошибка: {error}</div>
        ) : graphData.nodes.length === 0 ? (
          <div style={{ padding: '24px', color: '#ddd' }}>Граф пуст. Нет данных для отображения.</div>
        ) : (
          <div style={{ height: 'calc(100vh - 88px)' }}>
            <ForceGraph2D
              ref={fgRef}
              graphData={graphData as any}
              nodeLabel={(n: any) => `${n.name}${n.category ? ` — ${n.category}` : ''}${n.section ? ` / ${n.section}` : ''}`}
              nodeAutoColorBy="category"
              nodeVal={(n: any) => Math.max(1, n.val || 1)}
              linkWidth={(l: any) => Math.max(0.5, (l.weight || 0) * 3)}
              linkDirectionalArrowLength={4}
              linkDirectionalParticles={1}
              linkDirectionalParticleWidth={1}
              linkDirectionalParticleSpeed={0.005}
              backgroundColor="#070709"
              onNodeClick={handleNodeClick}
              onNodeDragEnd={(node: any) => setSelectedNode(node)}
              dagMode="radialin"
            />
          </div>
        )}
      </section>

      <aside style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', padding: '20px', background: '#08090f' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Детали узла</h2>
        {selectedNode ? (
          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <strong>Заголовок</strong>
              <div style={{ marginTop: '6px', color: '#ddd' }}>{selectedNode.name}</div>
            </div>
            <div>
              <strong>Категория</strong>
              <div style={{ marginTop: '6px', color: '#ccc' }}>{selectedNode.category || 'не задана'}</div>
            </div>
            <div>
              <strong>Секция</strong>
              <div style={{ marginTop: '6px', color: '#ccc' }}>{selectedNode.section || 'не задана'}</div>
            </div>
            <div>
              <strong>Вес</strong>
              <div style={{ marginTop: '6px', color: '#ccc' }}>{selectedNode.val.toFixed(2)}</div>
            </div>
            <button
              style={{
                marginTop: '10px',
                padding: '10px 14px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'transparent',
                color: '#fff',
                cursor: 'pointer'
              }}
              onClick={() => setSelectedNode(null)}
            >
              Сбросить выбор
            </button>
          </div>
        ) : (
          <div style={{ color: '#aaa' }}>Кликните на узел графа, чтобы увидеть детали.</div>
        )}
      </aside>
    </div>
  );
}
