"use client";
import { useEffect, useRef, useState } from 'react';

type GraphNode = {
  id: number;
  label: string;
  weight: number;
  category: string | null;
  section: string | null;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const selectedNodeRef = useRef<GraphNode | null>(null);
  const animationIdRef = useRef<number>();

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

  useEffect(() => {
    if (!canvasRef.current || !canvasContainerRef.current || graph.nodes.length === 0) return;

    const canvas = canvasRef.current;
    const container = canvasContainerRef.current;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const width = rect.width;
    const height = rect.height;
    const nodes = graph.nodes;
    const links = graph.links;

    // Инициализация позиций и скоростей узлов
    nodes.forEach((node, index) => {
      if (!node.x) {
        const angle = (index / nodes.length) * Math.PI * 2;
        const radius = Math.min(width, height) * 0.3;
        node.x = width / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 20;
        node.y = height / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 20;
      }
      node.vx = node.vx || 0;
      node.vy = node.vy || 0;
    });

    // Параметры симуляции
    let alpha = 1;
    const simulation = {
      alphaDecay: 0.993,
      alphaMin: 0.001,
      chargeStrength: -150,
      linkDistance: 100,
      linkStrength: 0.05,
      friction: 0.85,
      maxVelocity: 4
    };

    const handleClick = (event: MouseEvent) => {
      const clickRect = canvas.getBoundingClientRect();
      const x = event.clientX - clickRect.left;
      const y = event.clientY - clickRect.top;

      for (const node of nodes) {
        const dx = node.x! - x;
        const dy = node.y! - y;
        const radius = Math.max(4, Math.sqrt(node.weight) * 4);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < Math.max(radius + 12, 16)) {
          selectedNodeRef.current = node;
          setSelectedNode(node);
          break;
        }
      }
    };

    canvas.addEventListener('click', handleClick);

    const drawFrame = () => {
      // Симуляция сил
      if (alpha > simulation.alphaMin) {
        // Кулоновские силы отталкивания
        for (let i = 0; i < nodes.length; i++) {
          const a = nodes[i];
          for (let j = i + 1; j < nodes.length; j++) {
            const b = nodes[j];
            const dx = b.x! - a.x!;
            const dy = b.y! - a.y!;
            const distSq = dx * dx + dy * dy;
            const dist = Math.sqrt(distSq);
            const minDist = 30;

            if (dist < minDist && dist > 1) {
              const force = (simulation.chargeStrength * alpha) / dist;
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;
              a.vx! += fx;
              a.vy! += fy;
              b.vx! -= fx;
              b.vy! -= fy;
            }
          }
        }

        // Силы притяжения по связям
        for (const link of links) {
          const source = nodes.find((n) => n.id === link.source);
          const target = nodes.find((n) => n.id === link.target);
          if (!source || !target) continue;

          const dx = target.x! - source.x!;
          const dy = target.y! - source.y!;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const error = dist - simulation.linkDistance;
          const force = error * simulation.linkStrength * alpha;

          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          source.vx! += fx;
          source.vy! += fy;
          target.vx! -= fx;
          target.vy! -= fy;
        }

        // Применение скоростей и трения
        for (const node of nodes) {
          node.vx! *= simulation.friction;
          node.vy! *= simulation.friction;

          const speed = Math.sqrt(node.vx! * node.vx! + node.vy! * node.vy!);
          if (speed > simulation.maxVelocity) {
            node.vx! = (node.vx! / speed) * simulation.maxVelocity;
            node.vy! = (node.vy! / speed) * simulation.maxVelocity;
          }

          node.x! += node.vx!;
          node.y! += node.vy!;

          // Границы канваса
          if (node.x! < 10) node.x = 10;
          if (node.x! > width - 10) node.x = width - 10;
          if (node.y! < 10) node.y = 10;
          if (node.y! > height - 10) node.y = height - 10;
        }

        alpha *= simulation.alphaDecay;
      }

      // Отрисовка
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#070709';
      ctx.fillRect(0, 0, width, height);

      if (links.length > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        for (const link of links) {
          const source = nodes.find((node) => node.id === link.source);
          const target = nodes.find((node) => node.id === link.target);
          if (!source || !target) continue;
          ctx.beginPath();
          ctx.moveTo(source.x!, source.y!);
          ctx.lineTo(target.x!, target.y!);
          ctx.stroke();
        }
      }

      const colorMap = new Map<string | null, string>();
      let colorIndex = 0;
      const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#a29bfe'];

      for (const node of nodes) {
        if (!colorMap.has(node.category)) {
          colorMap.set(node.category, colors[colorIndex % colors.length]);
          colorIndex += 1;
        }

        const color = colorMap.get(node.category)!;
        const radius = Math.max(4, Math.sqrt(node.weight) * 4);

        ctx.fillStyle = selectedNodeRef.current?.id === node.id ? '#ffffff' : color;
        ctx.beginPath();
        ctx.arc(node.x!, node.y!, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = selectedNodeRef.current?.id === node.id ? '#ffd700' : 'rgba(255,255,255,0.2)';
        ctx.lineWidth = selectedNodeRef.current?.id === node.id ? 2 : 1;
        ctx.stroke();
      }

      animationIdRef.current = requestAnimationFrame(drawFrame);
    };

    animationIdRef.current = requestAnimationFrame(drawFrame);

    return () => {
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
      canvas.removeEventListener('click', handleClick);
    };
  }, [graph.nodes, graph.links]);

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
        ) : graph.nodes.length === 0 ? (
          <div style={{ padding: '24px', color: '#ddd' }}>Граф пуст. Нет данных для отображения.</div>
        ) : (
          <div ref={canvasContainerRef} style={{ width: '100%', height: 'calc(100vh - 88px)' }}>
            <canvas ref={canvasRef} style={{ display: 'block', cursor: 'pointer', width: '100%', height: '100%' }} />
          </div>
        )}
      </section>

      <aside style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', padding: '20px', background: '#08090f', overflowY: 'auto' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Детали узла</h2>
        {selectedNode ? (
          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <strong>Заголовок</strong>
              <div style={{ marginTop: '6px', color: '#ddd', fontSize: '0.9rem', wordBreak: 'break-word' }}>{selectedNode.label}</div>
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
              <div style={{ marginTop: '6px', color: '#ccc' }}>{selectedNode.weight.toFixed(2)}</div>
            </div>
            <button
              style={{
                marginTop: '10px',
                padding: '10px 14px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'transparent',
                color: '#fff',
                cursor: 'pointer',
                borderRadius: '4px'
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
