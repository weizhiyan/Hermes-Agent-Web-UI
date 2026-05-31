import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY } from 'd3-force';

const QUALITY_LABELS = { green: '优秀', yellow: '可用', orange: '待优化', red: '需重写', gray: '未分析' };
function qualityLabel(value) { return QUALITY_LABELS[value] || value || '未分析'; }
function nodePreview(node) { return node.prompt_text || node.summary || '暂无原对话内容'; }

export default function KnowledgeGraph({ nodes, edges, categoryColors, highlightCategory, onNodeClick, onBgClick, loading, isDark }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const simRef = useRef(null);
  const edgesRef = useRef([]);
  const [positions, setPositions] = useState(new Map());
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 800, h: 600 });
  const [tooltip, setTooltip] = useState(null);
  const [dragInfo, setDragInfo] = useState(null);
  const [panInfo, setPanInfo] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  // Initialize viewBox from container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const w = Math.max(400, rect.width);
    const h = Math.max(300, rect.height);
    setViewBox({ x: -w / 2, y: -h / 2, w, h });
  }, []);

  // Run force simulation with category clustering
  useEffect(() => {
    if (!nodes.length) {
      setPositions(new Map());
      setSelectedNodeId(null);
      return;
    }

    // Build category cluster centers
    const cats = [...new Set(nodes.map(n => n.category))];
    const angleStep = (2 * Math.PI) / Math.max(cats.length, 1);
    const clusterR = Math.min(viewBox.w, viewBox.h) * 0.22;
    const centers = {};
    cats.forEach((cat, i) => {
      const angle = angleStep * i - Math.PI / 2;
      centers[cat] = { x: Math.cos(angle) * clusterR, y: Math.sin(angle) * clusterR };
    });

    const simNodes = nodes.map(n => ({
      id: n.id,
      category: n.category,
      radius: 5 + Math.min(10, (n.frequency || 1) * 2),
      x: positions.get(n.id)?.x ?? (centers[n.category]?.x ?? 0) + (Math.random() - 0.5) * 60,
      y: positions.get(n.id)?.y ?? (centers[n.category]?.y ?? 0) + (Math.random() - 0.5) * 60,
    }));

    const simEdges = edges
      .map(e => ({ source: e.source, target: e.target }))
      .filter(e => simNodes.some(n => n.id === e.source) && simNodes.some(n => n.id === e.target));
    edgesRef.current = simEdges;

    const sim = forceSimulation(simNodes)
      .force('link', forceLink(simEdges).id(d => d.id).distance(50).strength(0.2))
      .force('charge', forceManyBody().strength(-60))
      .force('center', forceCenter(0, 0))
      .force('collision', forceCollide().radius(d => d.radius + 4))
      .force('x', forceX(d => centers[d.category]?.x ?? 0).strength(0.15))
      .force('y', forceY(d => centers[d.category]?.y ?? 0).strength(0.15))
      .alphaDecay(0.02)
      .velocityDecay(0.4);

    sim.on('tick', () => {
      const pos = new Map();
      simNodes.forEach(n => pos.set(n.id, { x: n.x, y: n.y }));
      setPositions(pos);
    });

    simRef.current = sim;
    return () => sim.stop();
  }, [nodes.length, edges.length]);

  // Handle zoom (wheel)
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * viewBox.w + viewBox.x;
    const mouseY = ((e.clientY - rect.top) / rect.height) * viewBox.h + viewBox.y;
    const factor = e.deltaY > 0 ? 1.08 : 0.93;
    const newW = Math.max(100, Math.min(5000, viewBox.w * factor));
    const newH = Math.max(75, Math.min(3750, viewBox.h * factor));
    const ratio = newW / viewBox.w;
    setViewBox({
      x: mouseX - (mouseX - viewBox.x) * ratio,
      y: mouseY - (mouseY - viewBox.y) * ratio,
      w: newW,
      h: newH,
    });
  }, [viewBox]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Pan (drag on background)
  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('.kg-node-group')) return;
    e.preventDefault();
    setPanInfo({ startX: e.clientX, startY: e.clientY, startVb: { ...viewBox } });
  }, [viewBox]);

  useEffect(() => {
    if (!panInfo) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = viewBox.w / rect.width;
    const scaleY = viewBox.h / rect.height;

    function onMove(e) {
      const dx = (e.clientX - panInfo.startX) * scaleX;
      const dy = (e.clientY - panInfo.startY) * scaleY;
      setViewBox(vb => ({ ...vb, x: panInfo.startVb.x - dx, y: panInfo.startVb.y - dy }));
    }
    function onUp() {
      setPanInfo(null);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [panInfo]);

  // Node drag
  const handleNodeMouseDown = useCallback((e, nodeId) => {
    e.stopPropagation();
    const sim = simRef.current;
    if (!sim) return;
    const node = sim.nodes().find(n => n.id === nodeId);
    if (!node) return;
    node.fx = node.x;
    node.fy = node.y;
    setDragInfo({ nodeId });
    sim.alphaTarget(0.3).restart();
  }, []);

  useEffect(() => {
    if (!dragInfo) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();

    function onMove(e) {
      const sim = simRef.current;
      if (!sim) return;
      const node = sim.nodes().find(n => n.id === dragInfo.nodeId);
      if (!node) return;
      const x = ((e.clientX - rect.left) / rect.width) * viewBox.w + viewBox.x;
      const y = ((e.clientY - rect.top) / rect.height) * viewBox.h + viewBox.y;
      const dx = x - (node.fx ?? node.x);
      const dy = y - (node.fy ?? node.y);
      node.fx = x;
      node.fy = y;
      // Push connected nodes
      const adj = edgesRef.current;
      const nodeMap = new Map(sim.nodes().map(n => [n.id, n]));
      for (const edge of adj) {
        const srcId = typeof edge.source === 'object' ? edge.source.id : edge.source;
        const tgtId = typeof edge.target === 'object' ? edge.target.id : edge.target;
        let neighborId = null;
        if (srcId === dragInfo.nodeId) neighborId = tgtId;
        else if (tgtId === dragInfo.nodeId) neighborId = srcId;
        if (!neighborId) continue;
        const neighbor = nodeMap.get(neighborId);
        if (!neighbor || neighbor.fx != null) continue; // skip already-fixed nodes
        neighbor.x += dx * 0.4;
        neighbor.y += dy * 0.4;
      }
    }
    function onUp() {
      const sim = simRef.current;
      if (sim) {
        // Keep node fixed at drop position
        sim.alphaTarget(0);
      }
      setDragInfo(null);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragInfo, viewBox]);

  // Tooltip
  const handleNodeHover = useCallback((e, node) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    setTooltip({
      node,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  const handleNodeLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  // Edge positions 鈥?only same-category connections
  const edgeLines = useMemo(() => {
    return edges.map(e => {
      const s = positions.get(e.source);
      const t = positions.get(e.target);
      if (!s || !t) return null;
      const srcNode = nodes.find(n => n.id === e.source);
      const tgtNode = nodes.find(n => n.id === e.target);
      if (!srcNode || !tgtNode || srcNode.category !== tgtNode.category) return null;
      return { id: e.id, x1: s.x, y1: s.y, x2: t.x, y2: t.y, sourceCategory: srcNode.category };
    }).filter(Boolean);
  }, [edges, positions, nodes]);

  // Background click handler
  const handleBgClick = useCallback((e) => {
    if (e.target === svgRef.current || e.target.tagName === 'rect') {
      setSelectedNodeId(null);
      onBgClick && onBgClick();
    }
  }, [onBgClick]);

  if (loading) {
    return (
      <div className="kg-graph-container" ref={containerRef}>
        <div className="kg-loading">
          <div className="kg-loading-dots"><span></span><span></span><span></span></div>
        </div>
      </div>
    );
  }

  if (!nodes.length) {
    return (
      <div className="kg-graph-container" ref={containerRef}>
        <div className="kg-empty-state">
          <div className="kg-empty-icon">&#x1F4A1;</div>
          <div className="kg-empty-title">暂无提问数据</div>
          <div className="kg-empty-desc">点击右上角“同步问题”，从对话记录中提取你发给 AI 的问题。</div>
        </div>
      </div>
    );
  }

  const vbStr = `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`;

  return (
    <div className="kg-graph-container" ref={containerRef}>
      <svg
        ref={svgRef}
        className="kg-graph-svg"
        viewBox={vbStr}
        onMouseDown={handleMouseDown}
        onClick={handleBgClick}
        style={{ cursor: panInfo ? 'grabbing' : 'grab' }}
      >
        <rect width="10000" height="10000" x="-5000" y="-5000" fill="transparent" />
        {/* Edges */}
        <g className="kg-edges">
          {edgeLines.map(e => {
            const edgeColor = e.sourceCategory ? (categoryColors[e.sourceCategory] || '#9aa3af') : '#9aa3af';
            const dimmed = highlightCategory && e.sourceCategory !== highlightCategory;
            return (
              <line
                key={e.id}
                className="kg-edge-line"
                x1={e.x1} y1={e.y1}
                x2={e.x2} y2={e.y2}
                stroke={edgeColor}
                opacity={dimmed ? 0.04 : 0.25}
              />
            );
          })}
        </g>
        {/* Nodes */}
        <g className="kg-nodes">
          {nodes.map(node => {
            const pos = positions.get(node.id);
            if (!pos) return null;
            const color = categoryColors[node.category] || categoryColors['未分类'];
            const r = 5 + Math.min(10, (node.frequency || 1) * 2);
            const selected = selectedNodeId === node.id;
            const dimmed = highlightCategory && node.category !== highlightCategory;
            return (
              <g
                key={node.id}
                className={`kg-node-group ${dimmed ? 'dimmed' : ''} ${selected ? 'selected' : ''}`}
                style={{ '--node-color': color }}
                transform={`translate(${pos.x},${pos.y})`}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                onMouseEnter={(e) => handleNodeHover(e, node)}
                onMouseMove={(e) => handleNodeHover(e, node)}
                onMouseLeave={handleNodeLeave}
                onClick={(e) => { e.stopPropagation(); setSelectedNodeId(prev => prev === node.id ? null : node.id); onNodeClick(node); }}
              >
                <circle
                  className="kg-node-circle"
                  r={r}
                  fill={color}
                  stroke="var(--kg-surface)"
                  strokeWidth={highlightCategory && node.category === highlightCategory ? 2.5 : 1.2}
                  style={{ color }}
                />
              </g>
            );
          })}
        </g>
      </svg>
      {tooltip && (
        <div
          className="kg-tooltip visible"
          style={{
            left: Math.max(12, Math.min(tooltip.x + 16, (containerRef.current?.clientWidth || 500) - 280)),
            top: Math.max(12, Math.min(tooltip.y - 10, (containerRef.current?.clientHeight || 400) - 160)),
          }}
        >
          <div className="kg-tooltip-meta">
            <span className="kg-tooltip-quality" style={{ background: categoryColors[tooltip.node.category] || '#9aa3af' }} />
            <span className="kg-tooltip-tag">{tooltip.node.category}</span>
            <span className="kg-tooltip-tag">质量：{qualityLabel(tooltip.node.quality)}</span>
            {tooltip.node.frequency > 1 && (
              <span className="kg-tooltip-tag" style={{ background: 'var(--kg-accent-soft)', color: 'var(--kg-accent)' }}>×{tooltip.node.frequency}</span>
            )}
          </div>
          <div className="kg-tooltip-title">{tooltip.node.title}</div>
          <div className="kg-tooltip-summary">{nodePreview(tooltip.node)}</div>
        </div>
      )}
    </div>
  );
}

