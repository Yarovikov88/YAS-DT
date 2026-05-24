"use client";
import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

export default function GraphPage() {
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const fgRef = useRef<any>();

  useEffect(() => {
    let mounted = true;
    fetch('/api/graph')
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        setGraph({ nodes: data.nodes || [], edges: data.edges || [] });
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const graphData = {
    nodes: graph.nodes.map((n: any) => ({ id: n.id, name: n.label, val: n.weight, category: n.category })),
    links: graph.edges.map((e: any) => ({ source: e.source, target: e.target, type: e.type, weight: e.weight }))
  };

  return (
    <div style={{ height: '100vh', background: '#0b0b0b', color: '#fff' }}>
      <h2 style={{ padding: '12px 20px', margin: 0 }}>YAS Graph — Interactive Topology</h2>
      <div style={{ height: 'calc(100vh - 56px)' }}>
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData as any}
          nodeLabel={(n: any) => `${n.name} (${n.category || 'n/a'})`}
          nodeAutoColorBy="category"
          nodeVal={(n: any) => n.val || 1}
          linkWidth={(l: any) => Math.max(0.5, (l.weight || 0) * 3)}
          linkDirectionalArrowLength={3}
          linkDirectionalParticles={0}
          backgroundColor="#000"
          onNodeClick={(node: any) => {
            // focus on node
            const distance = 120;
            const distRatio = 1 + distance / Math.hypot(node.x - (fgRef.current?.centerX || 0), node.y - (fgRef.current?.centerY || 0));
            fgRef.current.cameraPosition({ x: node.x * distRatio, y: node.y * distRatio, z: 200 }, node, 3000);
          }}
        />
      </div>
    </div>
  );
}
