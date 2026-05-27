'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

// ── Типы ───────────────────────────────────────────────────────────────────
interface Node {
  id: number;
  label: string;
  category: string;
  section: string;
  weight: number;
  age?: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Edge {
  source: number;
  target: number;
  type: string;
  weight: number;
}

// ── Константы ─────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  'Военный':      '#4a9eff',
  'Технология':   '#00d4aa',
  'Психофизика':  '#ff6b6b',
  'Юридический':  '#ffd93d',
  'Личное':       '#c77dff',
  'Кейс':         '#ff9f43',
  'Принцип':      '#48dbfb',
  'Философия':    '#ff6b9d',
};
const DEFAULT_COLOR = '#888888';
const getColor = (cat: string) => CATEGORY_COLORS[cat] ?? DEFAULT_COLOR;
const nodeRadius = (w: number) => 4 + (w || 0.5) * 5;

// ── Web Worker для физики ─────────────────────────────────────────────────
// Inline через Blob — без bundling-настроек.
// Алгоритм O(N²) с одной оптимизацией: пропуск дальних пар.
const WORKER_CODE = `
self.onmessage = function(e) {
  const { nodes, edges, iterations, cx, cy } = e.data;
  const N = nodes.length;
  // Маппинг id→index для быстрого доступа
  const idx = {};
  for (let i = 0; i < N; i++) idx[nodes[i].id] = i;

  const PROGRESS_EVERY = Math.max(20, Math.floor(iterations / 15));

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion (квадратичная, но с ранним break при огромных дистанциях)
    for (let i = 0; i < N; i++) {
      const ni = nodes[i];
      for (let j = i + 1; j < N; j++) {
        const nj = nodes[j];
        const dx = nj.x - ni.x;
        const dy = nj.y - ni.y;
        const d2 = dx * dx + dy * dy;
        // Узлы дальше 600px практически не влияют
        if (d2 > 360000) continue;
        const safe = Math.max(d2, 1);
        const f = 6000 / safe;
        const d = Math.sqrt(safe);
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        ni.vx -= fx; ni.vy -= fy;
        nj.vx += fx; nj.vy += fy;
      }
    }

    // Attraction (по рёбрам)
    for (const e of edges) {
      const a = nodes[idx[e.source]];
      const b = nodes[idx[e.target]];
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - 80) * 0.04;
      const fx = (dx / d) * f, fy = (dy / d) * f;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    }

    // Centering + damping
    for (let i = 0; i < N; i++) {
      const n = nodes[i];
      n.vx += (cx - n.x) * 0.002;
      n.vy += (cy - n.y) * 0.002;
      n.vx *= 0.85; n.vy *= 0.85;
      n.x += n.vx; n.y += n.vy;
    }

    if (iter % PROGRESS_EVERY === 0 || iter === iterations - 1) {
      self.postMessage({ type: 'progress', nodes: nodes, iter: iter, total: iterations });
    }
  }
  self.postMessage({ type: 'done', nodes: nodes });
};
`;

// ── Throttle helper для UI обновлений во время pan ─────────────────────────
const useThrottledRaf = () => {
  const pending = useRef(false);
  return useCallback((fn: () => void) => {
    if (pending.current) return;
    pending.current = true;
    requestAnimationFrame(() => {
      pending.current = false;
      fn();
    });
  }, []);
};

// ── Главный компонент ─────────────────────────────────────────────────────
export default function GraphPage() {
  const svgRef     = useRef<SVGSVGElement>(null);
  const gRef       = useRef<SVGGElement>(null);   // group для pan/zoom
  const labelClsRef = useRef<SVGGElement>(null);  // group лейблов для CSS-классов

  const [nodes, setNodes]         = useState<Node[]>([]);
  const [edges, setEdges]         = useState<Edge[]>([]);
  const [stats, setStats]         = useState({ nodes_count: 0, edges_count: 0, avg_degree: 0 });
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [progress, setProgress]   = useState(0); // 0-1, прогресс физики

  const [selected, setSelected]   = useState<Node | null>(null);
  const [search, setSearch]       = useState('');
  const [filterCat, setFilterCat] = useState('');

  // Viewport: tx/ty/scale в ref — pan/zoom не вызывают ре-рендер всего графа
  const viewRef = useRef({ tx: 0, ty: 0, scale: 1 });
  const [zoomPct, setZoomPct]     = useState(100); // только UI индикатор

  const panRef = useRef<{ startX: number; startY: number; tx: number; ty: number } | null>(null);
  const movedRef = useRef(false);

  const throttle = useThrottledRaf();

  // ── Применить transform к SVG-группе напрямую (без React) ────────────────
  const applyTransform = useCallback(() => {
    const g = gRef.current;
    if (!g) return;
    const v = viewRef.current;
    g.setAttribute('transform', `translate(${v.tx} ${v.ty}) scale(${v.scale})`);

    // Класс на лейбл-группе для управления видимостью через CSS
    const lblG = labelClsRef.current;
    if (lblG) {
      lblG.classList.toggle('zoom-low',  v.scale < 0.5);
      lblG.classList.toggle('zoom-mid',  v.scale >= 0.5 && v.scale < 0.9);
    }
  }, []);

  // ── Загрузка + физика в Web Worker ───────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let worker: Worker | null = null;

    fetch('/api/graph')
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        if (d.error) { setError(d.error); return; }

        const W = window.innerWidth, H = window.innerHeight;
        const cx = W / 2, cy = H / 2;
        const total = d.graph.nodes.length;

        // Начальная раскладка по кругу
        const initial: Node[] = d.graph.nodes.map((n: any, i: number) => {
          const angle  = (i / total) * Math.PI * 2;
          const radius = 250 + Math.random() * 200;
          return { ...n, x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, vx: 0, vy: 0 };
        });

        setNodes(initial);
        setEdges(d.graph.edges);
        setStats(d.graph.stats);
        setLoading(false);

        // Запускаем физику в воркере
        const blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
        worker = new Worker(URL.createObjectURL(blob));
        worker.onmessage = (ev) => {
          if (cancelled) return;
          if (ev.data.type === 'progress') {
            setNodes(ev.data.nodes);
            setProgress((ev.data.iter + 1) / ev.data.total);
          } else if (ev.data.type === 'done') {
            setNodes(ev.data.nodes);
            setProgress(1);
            worker?.terminate();
            worker = null;
          }
        };
        worker.postMessage({
          nodes: initial.map(n => ({ ...n })),
          edges: d.graph.edges,
          iterations: 300,
          cx, cy,
        });
      })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => {
      cancelled = true;
      if (worker) worker.terminate();
    };
  }, []);

  // ── Утилиты zoom ─────────────────────────────────────────────────────────
  const updateZoomUI = useCallback(() => {
    setZoomPct(Math.round(viewRef.current.scale * 100));
  }, []);

  const zoomBy = useCallback((factor: number, pivotX?: number, pivotY?: number) => {
    const v = viewRef.current;
    const ns = Math.min(4, Math.max(0.05, v.scale * factor));
    const px = pivotX ?? window.innerWidth  / 2;
    const py = pivotY ?? window.innerHeight / 2;
    viewRef.current = {
      scale: ns,
      tx: px - (px - v.tx) * (ns / v.scale),
      ty: py - (py - v.ty) * (ns / v.scale),
    };
    applyTransform();
    updateZoomUI();
  }, [applyTransform, updateZoomUI]);

  const setZoom = useCallback((target: number) => {
    const v = viewRef.current;
    const px = window.innerWidth  / 2;
    const py = window.innerHeight / 2;
    viewRef.current = {
      scale: target,
      tx: px - (px - v.tx) * (target / v.scale),
      ty: py - (py - v.ty) * (target / v.scale),
    };
    applyTransform();
    updateZoomUI();
  }, [applyTransform, updateZoomUI]);

  const zoomFit = useCallback(() => {
    if (!nodes.length) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of nodes) {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }
    const W = window.innerWidth, H = window.innerHeight;
    const pad = 100;
    const ns = Math.min((W - pad * 2) / Math.max(maxX - minX, 1), (H - pad * 2) / Math.max(maxY - minY, 1), 2);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    viewRef.current = { scale: ns, tx: W / 2 - cx * ns, ty: H / 2 - cy * ns };
    applyTransform();
    updateZoomUI();
  }, [nodes, applyTransform, updateZoomUI]);

  // Авто-fit когда физика закончила и узлы расположены
  useEffect(() => {
    if (progress === 1 && nodes.length) zoomFit();
  }, [progress, nodes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Применяем transform после каждого ре-рендера (на случай первой отрисовки)
  useEffect(() => { applyTransform(); }, [applyTransform]);

  // ── Pan через ref ────────────────────────────────────────────────────────
  const onSvgMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const v = viewRef.current;
    panRef.current = { startX: e.clientX, startY: e.clientY, tx: v.tx, ty: v.ty };
    movedRef.current = false;
  };

  const onSvgMouseMove = (e: React.MouseEvent) => {
    if (!panRef.current) return;
    const dx = e.clientX - panRef.current.startX;
    const dy = e.clientY - panRef.current.startY;
    if (!movedRef.current && (dx * dx + dy * dy) < 25) return;
    movedRef.current = true;
    viewRef.current.tx = panRef.current.tx + dx;
    viewRef.current.ty = panRef.current.ty + dy;
    // Применяем напрямую к DOM, без ре-рендера React
    throttle(applyTransform);
  };

  const onSvgMouseUp = () => { panRef.current = null; };

  const onWheel: React.WheelEventHandler = (e) => {
    const factor = e.deltaY < 0 ? 1.12 : 0.9;
    zoomBy(factor, e.clientX, e.clientY);
  };

  // Клик по фону — снимает выделение
  const onBackgroundClick = () => {
    if (movedRef.current) return;
    setSelected(null);
  };

  // ── Фильтрация ───────────────────────────────────────────────────────────
  const sq = search.toLowerCase();
  const filteredIds = useMemo(() => {
    if (!sq && !filterCat) return null;
    return new Set(nodes.filter(n =>
      (!sq || n.label.toLowerCase().includes(sq)) &&
      (!filterCat || n.category === filterCat)
    ).map(n => n.id));
  }, [nodes, sq, filterCat]);

  const isDim = (id: number) => filteredIds !== null && !filteredIds.has(id);

  // ── Производные данные ───────────────────────────────────────────────────
  const categories = useMemo(() => [...new Set(nodes.map(n => n.category))].sort(), [nodes]);
  const nodeMap    = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
  const selectedEdges = selected ? edges.filter(e => e.source === selected.id || e.target === selected.id) : [];

  // Топ-N узлов по weight для всегдашнего показа лейбла
  const topLabelIds = useMemo(() => {
    const top = [...nodes].sort((a, b) => (b.weight || 0) - (a.weight || 0)).slice(0, 30);
    return new Set(top.map(n => n.id));
  }, [nodes]);

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0a', color: '#555' }}>
      Загрузка графа…
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0a', color: '#ff4444' }}>
      Ошибка: {error}
    </div>
  );

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#0a0a0a' }}>

      {/* Глобальные стили для CSS hover (избегаем React-state на наведение) */}
      <style jsx global>{`
        .gnode { cursor: pointer; }
        .gnode .ring,
        .gnode .label-hi { display: none; }
        .gnode:hover .ring,
        .gnode.selected .ring { display: block; }
        .gnode:hover .label-hi,
        .gnode.selected .label-hi { display: block; }
        .gnode:hover .label-base,
        .gnode.selected .label-base { display: none; }
        .gnode:hover .dot { filter: brightness(1.2); }

        /* Текст с обводкой — читается на любом фоне без rect */
        .label-base {
          paint-order: stroke fill;
          stroke: rgba(10, 10, 10, 0.85);
          stroke-width: 3px;
          stroke-linejoin: round;
        }
        .label-hi {
          paint-order: stroke fill;
          stroke: rgba(10, 10, 10, 0.95);
          stroke-width: 4px;
          stroke-linejoin: round;
        }

        /* Скрываем лейблы на низких зумах через класс на родителе */
        .labels.zoom-low .label-base { display: none; }
        .labels.zoom-mid .label-base[data-top="0"] { display: none; }

        /* Прогресс-бар сверху */
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.5 } }
      `}</style>

      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ position: 'absolute', inset: 0, cursor: panRef.current ? 'grabbing' : 'grab' }}
        onMouseDown={onSvgMouseDown}
        onMouseMove={onSvgMouseMove}
        onMouseUp={onSvgMouseUp}
        onMouseLeave={onSvgMouseUp}
        onWheel={onWheel}
        onClick={onBackgroundClick}
      >
        <g ref={gRef}>

          {/* Edges */}
          <g>
            {edges.map((e, i) => {
              const a = nodeMap.get(e.source);
              const b = nodeMap.get(e.target);
              if (!a || !b) return null;
              const dim = filteredIds && (!filteredIds.has(a.id) || !filteredIds.has(b.id));
              return (
                <line
                  key={i}
                  x1={a.x} y1={a.y}
                  x2={b.x} y2={b.y}
                  stroke={dim ? '#111' : 'rgba(255,255,255,0.12)'}
                  strokeWidth={1}
                />
              );
            })}
          </g>

          {/* Nodes — каждый узел изолирован, hover/selected через CSS */}
          <g>
            {nodes.map(n => {
              const isSel = selected?.id === n.id;
              const dim   = isDim(n.id);
              const r     = nodeRadius(n.weight);
              const color = getColor(n.category);

              return (
                <g
                  key={n.id}
                  className={`gnode${isSel ? ' selected' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (movedRef.current) return;
                    setSelected(prev => prev?.id === n.id ? null : n);
                  }}
                >
                  {/* Большая невидимая зона клика */}
                  <circle cx={n.x} cy={n.y} r={r + 6} fill="transparent" />

                  {/* Кольцо (показывается через CSS на :hover/.selected) */}
                  <circle
                    className="ring"
                    cx={n.x} cy={n.y}
                    r={r + (isSel ? 5 : 4)}
                    fill="none"
                    stroke={color}
                    strokeWidth={isSel ? 2 : 1.5}
                    pointerEvents="none"
                  />

                  {/* Сам узел */}
                  <circle
                    className="dot"
                    cx={n.x} cy={n.y}
                    r={r}
                    fill={dim ? '#222' : isSel ? '#fff' : color}
                    pointerEvents="none"
                  />
                </g>
              );
            })}
          </g>

          {/* Лейблы — отдельной группой для CSS-управления видимостью по zoom */}
          <g ref={labelClsRef} className="labels" pointerEvents="none">
            {nodes.map(n => {
              if (isDim(n.id)) return null;
              const r = nodeRadius(n.weight);
              const lbl = n.label.length > 28 ? n.label.slice(0, 26) + '…' : n.label;
              const isTop = topLabelIds.has(n.id);
              return (
                <g key={n.id}>
                  {/* Базовый лейбл (скрывается через CSS при hover/selected) */}
                  <text
                    className="label-base"
                    data-top={isTop ? '1' : '0'}
                    x={n.x}
                    y={n.y + r + 13}
                    textAnchor="middle"
                    fontFamily="sans-serif"
                    fontSize={11}
                    fill="rgba(255,255,255,0.75)"
                  >
                    {lbl}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Hover/Selected лейблы — отдельной группой поверх всего, видны через CSS */}
          <g pointerEvents="none">
            {nodes.map(n => {
              const r = nodeRadius(n.weight);
              const lbl = n.label.length > 36 ? n.label.slice(0, 34) + '…' : n.label;
              return (
                <g key={`hi-${n.id}`} className={`gnode${selected?.id === n.id ? ' selected' : ''}`} style={{ display: 'contents' }}>
                  <text
                    className="label-hi"
                    x={n.x}
                    y={n.y + r + 14}
                    textAnchor="middle"
                    fontFamily="sans-serif"
                    fontSize={13}
                    fontWeight="bold"
                    fill="#fff"
                  >
                    {lbl}
                  </text>
                </g>
              );
            })}
          </g>

        </g>
      </svg>

      {/* Прогресс-бар физики */}
      {progress < 1 && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: '#1a1a1a', zIndex: 30,
        }}>
          <div style={{
            width: `${progress * 100}%`,
            height: '100%',
            background: '#4a9eff',
            transition: 'width 0.2s',
          }} />
        </div>
      )}

      {/* Топ-бар */}
      <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', zIndex: 10 }}>
        <div style={{ background: 'rgba(0,0,0,0.85)', borderRadius: 8, padding: '7px 14px', color: '#fff', fontWeight: 'bold', fontSize: '0.9rem' }}>
          🧠 YAS Knowledge Graph
        </div>
        <div style={{ background: 'rgba(0,0,0,0.85)', borderRadius: 8, padding: '6px 12px' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск…"
            style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', width: 130, fontSize: '0.85rem' }} />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          style={{ background: 'rgba(0,0,0,0.85)', border: 'none', borderRadius: 8, padding: '7px 12px', color: '#fff', fontSize: '0.82rem', cursor: 'pointer' }}>
          <option value="">Все категории</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{ background: 'rgba(0,0,0,0.85)', borderRadius: 8, padding: '7px 12px', color: '#555', fontSize: '0.78rem' }}>
          {stats.nodes_count} узлов · {stats.edges_count} связей
        </div>
      </div>

      {/* Легенда */}
      <div style={{ position: 'absolute', bottom: 16, left: 12, background: 'rgba(0,0,0,0.85)', borderRadius: 8, padding: '10px 14px', zIndex: 10 }}>
        {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
          <div key={cat} onClick={() => setFilterCat(p => p === cat ? '' : cat)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 4 }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0,
              boxShadow: filterCat === cat ? `0 0 6px ${color}` : 'none' }} />
            <span style={{ color: filterCat === cat ? '#fff' : '#777', fontSize: '0.76rem' }}>{cat}</span>
          </div>
        ))}
      </div>

      {/* Контролы масштаба */}
      <div style={{
        position: 'absolute', right: selected ? 356 : 16, bottom: 16,
        display: 'flex', flexDirection: 'column', zIndex: 10,
        background: 'rgba(0,0,0,0.85)', borderRadius: 8, overflow: 'hidden',
        border: '1px solid #1a1a1a', userSelect: 'none',
      }}>
        <button onClick={() => zoomBy(1.3)} title="Приблизить"
          style={{ width: 36, height: 36, background: 'transparent', border: 'none', color: '#bbb', fontSize: '1.3rem', cursor: 'pointer', lineHeight: 1, borderBottom: '1px solid #1a1a1a' }}>+</button>

        <div style={{ width: 36, padding: '10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: '#0a0a0a' }}>
          <input
            type="range"
            min={5}
            max={400}
            value={zoomPct}
            onChange={e => setZoom(Number(e.target.value) / 100)}
            style={{
              writingMode: 'vertical-lr' as any,
              WebkitAppearance: 'slider-vertical' as any,
              width: 4, height: 90, padding: 0,
              accentColor: '#4a9eff',
            }}
          />
          <div style={{ fontSize: '0.62rem', color: '#666', fontFamily: 'monospace' }}>
            {zoomPct}%
          </div>
        </div>

        <button onClick={() => zoomBy(1 / 1.3)} title="Отдалить"
          style={{ width: 36, height: 36, background: 'transparent', border: 'none', color: '#bbb', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1, borderTop: '1px solid #1a1a1a' }}>−</button>
        <button onClick={zoomFit} title="Показать весь граф"
          style={{ width: 36, height: 36, background: '#0a0a0a', border: 'none', color: '#888', fontSize: '0.8rem', cursor: 'pointer', borderTop: '1px solid #1a1a1a' }}>⛶</button>
      </div>

      {/* Подсказка */}
      <div style={{ position: 'absolute', bottom: 16, right: selected ? 414 : 70, color: '#2a2a2a', fontSize: '0.7rem', zIndex: 10 }}>
        Скролл — зум · Тащи — пан · Клик — детали
      </div>

      {/* Панель деталей */}
      {selected && (
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 340, background: 'rgba(8,8,8,0.97)', borderLeft: '1px solid #1a1a1a', padding: '20px 18px', overflowY: 'auto', zIndex: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, background: getColor(selected.category) + '22', color: getColor(selected.category), fontSize: '0.7rem', marginBottom: 8 }}>
                {selected.category}
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 'bold', lineHeight: 1.4 }}>{selected.label}</div>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#444', fontSize: '1.3rem', cursor: 'pointer', marginLeft: 8 }}>×</button>
          </div>

          <div style={{ display: 'flex', gap: 16, fontSize: '0.76rem', color: '#555', marginBottom: 8 }}>
            <span>Вес: <span style={{ color: '#888' }}>{selected.weight}</span></span>
            {selected.age && <span>Возраст: <span style={{ color: '#888' }}>{selected.age}</span></span>}
          </div>
          <div style={{ fontSize: '0.73rem', color: '#3a3a3a', marginBottom: 16 }}>{selected.section}</div>

          {selectedEdges.length > 0 && (
            <>
              <div style={{ fontSize: '0.73rem', color: '#444', marginBottom: 8 }}>Связи ({selectedEdges.length})</div>
              {selectedEdges.map((e, i) => {
                const otherId = e.source === selected.id ? e.target : e.source;
                const other   = nodeMap.get(otherId);
                return (
                  <div key={i} onClick={() => { const n = nodeMap.get(otherId); if (n) setSelected(n); }}
                    style={{ padding: '8px 10px', background: '#0f0f0f', borderRadius: 6, cursor: 'pointer', marginBottom: 5, border: '1px solid #181818', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: '#333', fontSize: '0.85rem' }}>{e.source === selected.id ? '→' : '←'}</span>
                    <div>
                      <div style={{ fontSize: '0.76rem', color: '#bbb' }}>{other?.label ?? `#${otherId}`}</div>
                      <div style={{ fontSize: '0.66rem', color: '#3a3a3a' }}>{e.type}</div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
