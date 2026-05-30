'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

// ── Типы ───────────────────────────────────────────────────────────────────
interface Node {
  id: number;
  label: string;
  content?: string;
  category: string;
  section: string;
  sphere?: string;
  tags?: string[];
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
// Цвета по 8 сферам HPI
const SPHERE_COLORS: Record<string, string> = {
  loved:    '#ff6b9d',  // 💖 Любимые
  family:   '#c77dff',  // 🏡 Родные
  friends:  '#48dbfb',  // 🤝 Друзья
  career:   '#4a9eff',  // 💼 Карьера
  physical: '#00d4aa',  // ♂️ Физическое
  mental:   '#ff6b6b',  // 🧠 Ментальное
  hobby:    '#ff9f43',  // 🎨 Хобби
  wealth:   '#ffd93d',  // 💰 Благосостояние
};
const SPHERE_LABELS: Record<string, string> = {
  loved:    '💖 Любимые',
  family:   '🏡 Родные',
  friends:  '🤝 Друзья',
  career:   '💼 Карьера',
  physical: '♂️ Физическое',
  mental:   '🧠 Ментальное',
  hobby:    '🎨 Хобби',
  wealth:   '💰 Благосостояние',
};
const DEFAULT_COLOR = '#888888';
const getColor = (sphere?: string) => (sphere && SPHERE_COLORS[sphere]) ?? DEFAULT_COLOR;
const getSphereLabel = (sphere?: string) => (sphere && SPHERE_LABELS[sphere]) ?? '— без сферы';
const nodeRadius = (w: number) => 4 + (w || 0.5) * 5;

// ── Лёгкий markdown-рендерер для content ──────────────────────────────────
// Поддерживает: ### заголовки, **жирный**, *курсив*, - списки, переносы строк
function renderMarkdown(text: string): React.ReactNode {
  const blocks = text.split(/\n\n+/);
  return blocks.map((block, bi) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    // Заголовки H3 / H2 / H1
    if (trimmed.startsWith('### ')) {
      return <h4 key={bi} style={{ fontSize: '0.82rem', color: '#fff', margin: '14px 0 6px', fontWeight: 600 }}>{inline(trimmed.slice(4))}</h4>;
    }
    if (trimmed.startsWith('## ')) {
      return <h3 key={bi} style={{ fontSize: '0.88rem', color: '#fff', margin: '16px 0 6px', fontWeight: 600 }}>{inline(trimmed.slice(3))}</h3>;
    }
    if (trimmed.startsWith('# ')) {
      return <h2 key={bi} style={{ fontSize: '0.95rem', color: '#fff', margin: '18px 0 8px', fontWeight: 700 }}>{inline(trimmed.slice(2))}</h2>;
    }

    // Горизонтальная линия
    if (/^---+$/.test(trimmed)) {
      return <hr key={bi} style={{ border: 'none', borderTop: '1px solid #1a1a1a', margin: '14px 0' }} />;
    }

    // Список (несколько строк, начинаются с - или *)
    const lines = trimmed.split('\n');
    if (lines.every(l => /^\s*[-*]\s/.test(l))) {
      return (
        <ul key={bi} style={{ margin: '6px 0', paddingLeft: 18, color: '#bbb', fontSize: '0.78rem', lineHeight: 1.55 }}>
          {lines.map((l, li) => (
            <li key={li} style={{ marginBottom: 3 }}>{inline(l.replace(/^\s*[-*]\s/, ''))}</li>
          ))}
        </ul>
      );
    }

    // Обычный параграф (с переводами строк → <br/>)
    return (
      <p key={bi} style={{ margin: '6px 0', color: '#bbb', fontSize: '0.78rem', lineHeight: 1.6 }}>
        {lines.map((line, li) => (
          <span key={li}>
            {inline(line)}
            {li < lines.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
  });
}

// Inline: **жирный**, *курсив*
function inline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0, m: RegExpExecArray | null, idx = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) {
      parts.push(<strong key={`b${idx++}`} style={{ color: '#fff' }}>{tok.slice(2, -2)}</strong>);
    } else {
      parts.push(<em key={`i${idx++}`} style={{ color: '#ddd' }}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// ── Двухползунковый фильтр диапазона (возраст / вес) ───────────────────────
function RangeFilter({ label, bounds, value, step, fmt, onChange, onReset }: {
  label: string;
  bounds: [number, number];
  value: [number, number];
  step: number;
  fmt: (n: number) => string;
  onChange: (v: [number, number]) => void;
  onReset?: () => void;
}) {
  const [min, max] = bounds;
  const [lo, hi] = value;
  const span = Math.max(max - min, 1e-9);
  const loPct = ((lo - min) / span) * 100;
  const hiPct = ((hi - min) / span) * 100;
  const active = lo > min || hi < max;
  // Когда нижний ползунок в верхней половине — поднимаем его над верхним,
  // чтобы оставался захватываемым при сближении бегунков.
  const loOnTop = lo > min + span * 0.5;

  return (
    <div style={{ background: 'rgba(0,0,0,0.85)', borderRadius: 8, padding: '5px 12px 7px', width: 160 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: '0.74rem', color: active ? '#fff' : '#888' }}>{label}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: '0.68rem', color: active ? '#4a9eff' : '#555', fontFamily: 'monospace' }}>
            {fmt(lo)}–{fmt(hi)}
          </span>
          {active && onReset && (
            <span onClick={onReset} title="Сбросить" style={{ color: '#555', cursor: 'pointer', fontSize: '0.8rem', lineHeight: 1 }}>×</span>
          )}
        </span>
      </div>
      <div className="range-dual">
        <div className="range-track" />
        <div className="range-fill" style={{ left: `${loPct}%`, right: `${100 - hiPct}%` }} />
        <input
          type="range" min={min} max={max} step={step} value={lo}
          style={{ zIndex: loOnTop ? 5 : 3 }}
          onChange={e => onChange([Math.min(Number(e.target.value), hi), hi])}
        />
        <input
          type="range" min={min} max={max} step={step} value={hi}
          style={{ zIndex: 4 }}
          onChange={e => onChange([lo, Math.max(Number(e.target.value), lo)])}
        />
      </div>
    </div>
  );
}

// ── Excel-подобный мультиселект с чекбоксами ───────────────────────────────
interface MultiOption {
  value: string;
  label: React.ReactNode;     // как показать в списке
  color?: string;             // точка-индикатор слева (для сфер)
  count?: number;             // сколько узлов подходит
}

function MultiSelect({ title, options, selected, onChange, searchable }: {
  title: string;
  options: MultiOption[];
  selected: Set<string>;      // выбранные value; считаем «всё выбрано», если selected пуст? — нет, явный набор
  onChange: (next: Set<string>) => void;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  // Закрытие по клику вне
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const allValues = options.map(o => o.value);
  const allSelected = selected.size === allValues.length;
  const noneSelected = selected.size === 0;

  const filtered = q
    ? options.filter(o => o.value.toLowerCase().includes(q.toLowerCase()))
    : options;

  const toggle = (val: string) => {
    const next = new Set(selected);
    next.has(val) ? next.delete(val) : next.add(val);
    onChange(next);
  };
  const selectAll = () => onChange(new Set(allValues));
  const clearAll  = () => onChange(new Set());

  // Текст на кнопке
  const summary = allSelected ? 'все'
    : noneSelected ? 'ничего'
    : `${selected.size} из ${allValues.length}`;

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(0,0,0,0.85)', border: '1px solid',
          borderColor: open ? '#4a9eff' : 'transparent',
          borderRadius: 8, padding: '7px 12px', color: '#fff',
          fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap',
        }}>
        <span>{title}</span>
        <span style={{ color: allSelected ? '#555' : '#4a9eff', fontSize: '0.72rem' }}>({summary})</span>
        <span style={{ color: '#555', fontSize: '0.6rem', transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 40,
          background: '#0d0d0d', border: '1px solid #222', borderRadius: 8,
          minWidth: 200, maxWidth: 280, boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}>
          {/* Действия */}
          <div style={{ display: 'flex', borderBottom: '1px solid #1a1a1a' }}>
            <button onClick={selectAll} disabled={allSelected}
              style={{ flex: 1, background: 'none', border: 'none', padding: '8px', color: allSelected ? '#444' : '#4a9eff', fontSize: '0.74rem', cursor: allSelected ? 'default' : 'pointer' }}>
              ✓ Выбрать все
            </button>
            <div style={{ width: 1, background: '#1a1a1a' }} />
            <button onClick={clearAll} disabled={noneSelected}
              style={{ flex: 1, background: 'none', border: 'none', padding: '8px', color: noneSelected ? '#444' : '#ff6b6b', fontSize: '0.74rem', cursor: noneSelected ? 'default' : 'pointer' }}>
              ✕ Снять все
            </button>
          </div>

          {/* Поиск */}
          {searchable && (
            <div style={{ padding: '6px 8px', borderBottom: '1px solid #1a1a1a' }}>
              <input
                value={q} onChange={e => setQ(e.target.value)} placeholder="Фильтр…" autoFocus
                style={{ width: '100%', background: '#0a0a0a', border: '1px solid #1f1f1f', borderRadius: 5, padding: '5px 8px', color: '#fff', fontSize: '0.76rem', outline: 'none' }} />
            </div>
          )}

          {/* Список */}
          <div style={{ maxHeight: 260, overflowY: 'auto', padding: '4px 0' }}>
            {filtered.length === 0 && (
              <div style={{ padding: '10px 12px', color: '#444', fontSize: '0.74rem' }}>Ничего не найдено</div>
            )}
            {filtered.map(o => {
              const checked = selected.has(o.value);
              return (
                <label key={o.value}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', cursor: 'pointer', fontSize: '0.78rem' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#161616')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <span style={{
                    width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                    border: '1px solid', borderColor: checked ? '#4a9eff' : '#333',
                    background: checked ? '#4a9eff' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: '0.7rem', lineHeight: 1,
                  }}>{checked ? '✓' : ''}</span>
                  <input type="checkbox" checked={checked} onChange={() => toggle(o.value)} style={{ display: 'none' }} />
                  {o.color && <span style={{ width: 9, height: 9, borderRadius: '50%', background: o.color, flexShrink: 0 }} />}
                  <span style={{ color: checked ? '#fff' : '#999', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                  {o.count != null && <span style={{ color: '#555', fontSize: '0.68rem', fontFamily: 'monospace' }}>{o.count}</span>}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

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
  const [search, setSearch]         = useState('');
  // Excel-подобные мультифильтры. null = ещё не инициализированы (= выбрано всё).
  const [selSpheres, setSelSpheres] = useState<Set<string> | null>(null);
  const [selTags, setSelTags]       = useState<Set<string> | null>(null);
  // Диапазонные фильтры. null = ещё не инициализированы (ждём данные).
  const [ageRange, setAgeRange]       = useState<[number, number] | null>(null);
  const [weightRange, setWeightRange] = useState<[number, number] | null>(null);

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

  // Все доступные сферы (в порядке HPI) и теги из данных
  const allSpheres = useMemo(() => {
    const present = new Set<string>();
    for (const n of nodes) if (n.sphere) present.add(n.sphere);
    const ordered = Object.keys(SPHERE_LABELS).filter(s => present.has(s));
    // сферы, которых нет в словаре, но есть в данных
    for (const s of present) if (!SPHERE_LABELS[s]) ordered.push(s);
    return ordered;
  }, [nodes]);
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const n of nodes) (n.tags || []).forEach(t => set.add(t));
    return [...set].sort();
  }, [nodes]);

  // Инициализируем выбор «всё включено», когда пришли узлы
  useEffect(() => {
    if (!nodes.length) return;
    setSelSpheres(prev => prev ?? new Set(allSpheres));
    setSelTags(prev => prev ?? new Set(allTags));
  }, [nodes.length, allSpheres, allTags]);

  // Границы диапазонов из данных
  const ageBounds = useMemo<[number, number]>(() => {
    const vals = nodes.map(n => n.age).filter((v): v is number => v != null);
    return vals.length ? [Math.min(...vals), Math.max(...vals)] : [0, 100];
  }, [nodes]);
  const weightBounds = useMemo<[number, number]>(() => {
    const vals = nodes.map(n => n.weight).filter((v): v is number => v != null);
    return vals.length ? [Math.min(...vals), Math.max(...vals)] : [0, 1];
  }, [nodes]);

  // Инициализируем диапазоны под фактические границы, когда пришли узлы
  useEffect(() => {
    if (!nodes.length) return;
    setAgeRange(prev => prev ?? ageBounds);
    setWeightRange(prev => prev ?? weightBounds);
  }, [nodes.length, ageBounds, weightBounds]);

  const ageActive    = ageRange    && (ageRange[0]    > ageBounds[0]    || ageRange[1]    < ageBounds[1]);
  const weightActive = weightRange && (weightRange[0] > weightBounds[0] || weightRange[1] < weightBounds[1]);

  // Сфера активна как фильтр, если выбраны не все сферы
  const sphereActive = selSpheres != null && selSpheres.size < allSpheres.length;
  // Тег активен, если выбраны не все теги
  const tagActive    = selTags != null && selTags.size < allTags.length;

  const matchSphere = (n: Node) => {
    if (!sphereActive) return true;
    return n.sphere ? selSpheres!.has(n.sphere) : false;
  };
  const matchTags = (n: Node) => {
    if (!tagActive) return true;
    const tags = n.tags || [];
    // узел проходит, если хотя бы один его тег выбран (логика ИЛИ, как в Excel)
    return tags.some(t => selTags!.has(t));
  };

  const filteredIds = useMemo(() => {
    if (!sq && !sphereActive && !tagActive && !ageActive && !weightActive) return null;
    return new Set(nodes.filter(n =>
      (!sq || n.label.toLowerCase().includes(sq)) &&
      matchSphere(n) &&
      matchTags(n) &&
      (!ageActive    || (n.age != null && n.age >= ageRange![0] && n.age <= ageRange![1])) &&
      (!weightActive || (n.weight != null && n.weight >= weightRange![0] && n.weight <= weightRange![1]))
    ).map(n => n.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, sq, selSpheres, selTags, sphereActive, tagActive, ageActive, weightActive, ageRange, weightRange]);

  const isDim = (id: number) => filteredIds !== null && !filteredIds.has(id);

  // ── Производные данные ───────────────────────────────────────────────────
  // Счётчики узлов по сфере / тегу (для отображения в мультиселекте)
  const sphereCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const n of nodes) if (n.sphere) m[n.sphere] = (m[n.sphere] || 0) + 1;
    return m;
  }, [nodes]);
  const tagCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const n of nodes) (n.tags || []).forEach(t => { m[t] = (m[t] || 0) + 1; });
    return m;
  }, [nodes]);

  const sphereOptions: MultiOption[] = allSpheres.map(s => ({
    value: s,
    label: SPHERE_LABELS[s] ?? s,
    color: getColor(s),
    count: sphereCounts[s] ?? 0,
  }));
  const tagOptions: MultiOption[] = allTags.map(t => ({
    value: t,
    label: `#${t}`,
    count: tagCounts[t] ?? 0,
  }));

  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
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

        /* Двухползунковый range-фильтр */
        .range-dual { position: relative; height: 18px; }
        .range-track {
          position: absolute; top: 50%; left: 0; right: 0; height: 3px;
          transform: translateY(-50%); background: #2a2a2a; border-radius: 2px;
        }
        .range-fill {
          position: absolute; top: 50%; height: 3px;
          transform: translateY(-50%); background: #4a9eff; border-radius: 2px;
        }
        .range-dual input[type="range"] {
          position: absolute; top: 0; left: 0; width: 100%; height: 18px;
          margin: 0; background: none; pointer-events: none; -webkit-appearance: none; appearance: none;
        }
        .range-dual input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 13px; height: 13px; border-radius: 50%;
          background: #fff; border: 2px solid #4a9eff; cursor: pointer;
          pointer-events: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.6);
        }
        .range-dual input[type="range"]::-moz-range-thumb {
          width: 13px; height: 13px; border-radius: 50%;
          background: #fff; border: 2px solid #4a9eff; cursor: pointer;
          pointer-events: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.6);
        }
        .range-dual input[type="range"]::-moz-range-track { background: none; }
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
              const color = getColor(n.sphere);

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
        <MultiSelect
          title="Сферы"
          options={sphereOptions}
          selected={selSpheres ?? new Set(allSpheres)}
          onChange={setSelSpheres}
        />
        <MultiSelect
          title="Теги"
          options={tagOptions}
          selected={selTags ?? new Set(allTags)}
          onChange={setSelTags}
          searchable
        />
        {ageRange && ageBounds[0] !== ageBounds[1] && (
          <RangeFilter
            label="Возраст"
            bounds={ageBounds}
            value={ageRange}
            step={1}
            fmt={n => String(Math.round(n))}
            onChange={setAgeRange}
            onReset={() => setAgeRange([...ageBounds])}
          />
        )}
        {weightRange && weightBounds[0] !== weightBounds[1] && (
          <RangeFilter
            label="Вес"
            bounds={weightBounds}
            value={weightRange}
            step={0.1}
            fmt={n => n.toFixed(1)}
            onChange={setWeightRange}
            onReset={() => setWeightRange([...weightBounds])}
          />
        )}
        <div style={{ background: 'rgba(0,0,0,0.85)', borderRadius: 8, padding: '7px 12px', color: '#555', fontSize: '0.78rem' }}>
          {stats.nodes_count} узлов · {stats.edges_count} связей
        </div>
      </div>

      {/* Легенда — сферы HPI (клик = вкл/выкл сферу в фильтре) */}
      <div style={{ position: 'absolute', bottom: 16, left: 12, background: 'rgba(0,0,0,0.85)', borderRadius: 8, padding: '10px 14px', zIndex: 10 }}>
        {allSpheres.map(sphere => {
          const label = SPHERE_LABELS[sphere] ?? sphere;
          const on = selSpheres ? selSpheres.has(sphere) : true;
          // подсвечиваем состояние только когда фильтр по сферам активен
          const highlight = sphereActive ? on : false;
          const dimmed    = sphereActive && !on;
          return (
            <div key={sphere}
              onClick={() => {
                const base = new Set(selSpheres ?? new Set(allSpheres));
                base.has(sphere) ? base.delete(sphere) : base.add(sphere);
                setSelSpheres(base);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 4, opacity: dimmed ? 0.4 : 1 }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: SPHERE_COLORS[sphere], flexShrink: 0,
                boxShadow: highlight ? `0 0 6px ${SPHERE_COLORS[sphere]}` : 'none' }} />
              <span style={{ color: highlight ? '#fff' : dimmed ? '#555' : '#999', fontSize: '0.76rem', textDecoration: dimmed ? 'line-through' : 'none' }}>{label}</span>
            </div>
          );
        })}
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
              <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, background: getColor(selected.sphere) + '22', color: getColor(selected.sphere), fontSize: '0.7rem', marginBottom: 8 }}>
                {getSphereLabel(selected.sphere)}
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 'bold', lineHeight: 1.4 }}>{selected.label}</div>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#444', fontSize: '1.3rem', cursor: 'pointer', marginLeft: 8 }}>×</button>
          </div>

          {/* Теги (клик = изолировать тег; повторный клик = сбросить) */}
          {selected.tags && selected.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
              {selected.tags.map(t => {
                const isolated = tagActive && selTags!.size === 1 && selTags!.has(t);
                return (
                <span key={t}
                  onClick={() => setSelTags(isolated ? new Set(allTags) : new Set([t]))}
                  style={{
                    fontSize: '0.68rem',
                    padding: '2px 7px',
                    borderRadius: 3,
                    background: isolated ? '#fff' : '#1a1a1a',
                    color: isolated ? '#000' : '#888',
                    cursor: 'pointer',
                  }}>#{t}</span>
                );
              })}
            </div>
          )}

          <div style={{ display: 'flex', gap: 16, fontSize: '0.76rem', color: '#555', marginBottom: 8 }}>
            <span>Вес: <span style={{ color: '#888' }}>{selected.weight}</span></span>
            {selected.age && <span>Возраст: <span style={{ color: '#888' }}>{selected.age}</span></span>}
          </div>
          <div style={{ fontSize: '0.73rem', color: '#3a3a3a', marginBottom: 16 }}>{selected.section}</div>

          {selected.content && (
            <div style={{
              borderTop: '1px solid #1a1a1a',
              paddingTop: 12,
              marginBottom: 16,
            }}>
              {renderMarkdown(selected.content)}
            </div>
          )}

          {selectedEdges.length > 0 && (
            <>
              <div style={{
                borderTop: '1px solid #1a1a1a',
                paddingTop: 12,
                fontSize: '0.73rem',
                color: '#444',
                marginBottom: 8,
              }}>Связи ({selectedEdges.length})</div>
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
