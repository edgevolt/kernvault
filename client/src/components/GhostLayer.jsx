import { useEffect, useState } from 'react';
import { useViewport } from 'reactflow';
import { api } from '../api/client';

// Mirror Overview map constants so ghost positions match
const COL_W = 280;
const ITEM_H = 64;
const GAP_Y = 16;
const HEADER_H = 48;
const PADDING = 24;

/**
 * GhostLayer renders Overview mode's ItemConnections as faint dashed curves
 * behind the Synthesis canvas, using the React Flow viewport transform so
 * they stay aligned as the user pans and zooms.
 */
export default function GhostLayer({ spaceId, visible }) {
  const [mapData, setMapData] = useState(null);
  const { x: vpX, y: vpY, zoom } = useViewport();

  useEffect(() => {
    if (!spaceId) return;
    api.getLearningMap(spaceId).then(setMapData).catch(console.error);
  }, [spaceId]);

  if (!visible || !mapData) return null;

  // Build position map — same math as LearningMap.jsx
  const itemPositions = {};
  mapData.stages.forEach((stage, colIdx) => {
    (stage.items || []).forEach((item, rowIdx) => {
      itemPositions[item.id] = {
        x: PADDING + colIdx * COL_W + (COL_W - 40) / 2,
        y: PADDING + HEADER_H + rowIdx * (ITEM_H + GAP_Y) + ITEM_H / 2,
      };
    });
  });

  const totalCols = mapData.stages.length;
  const maxRows = Math.max(0, ...mapData.stages.map(s => (s.items || []).length));
  const canvasW = Math.max(800, PADDING * 2 + totalCols * COL_W);
  const canvasH = Math.max(600, PADDING * 2 + HEADER_H + maxRows * (ITEM_H + GAP_Y));

  const paths = mapData.item_connections.map(conn => {
    const src = itemPositions[conn.source_item_id];
    const tgt = itemPositions[conn.target_item_id];
    if (!src || !tgt) return null;

    const isSameCol = src.x === tgt.x;
    let startX, startY, endX, endY, cp1x, cp1y, cp2x, cp2y;

    if (isSameCol) {
      startX = src.x; startY = src.y + (tgt.y > src.y ? 36 : -36);
      endX = tgt.x;   endY = tgt.y + (tgt.y > src.y ? -44 : 44);
      cp1x = startX; cp2x = startX; cp1y = startY; cp2y = endY;
    } else {
      const isForward = tgt.x > src.x;
      startX = src.x + (isForward ? 124 : -124); startY = src.y;
      endX = tgt.x + (isForward ? -132 : 132);   endY = tgt.y;

      const dx = Math.abs(tgt.x - src.x);
      const isSkip = dx > COL_W + 50;

      cp1y = startY; cp2y = endY;
      if (isSkip) {
        cp1y += 110; cp2y += 110;
        cp1x = startX + (startX < endX ? 60 : -60);
        cp2x = endX + (startX < endX ? -60 : 60);
      } else {
        cp1x = startX + (endX - startX) * 0.5;
        cp2x = startX + (endX - startX) * 0.5;
      }
    }

    return `M ${startX},${startY} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${endX},${endY}`;
  }).filter(Boolean);

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: canvasW,
        height: canvasH,
        // Apply same transform as React Flow viewport so ghost aligns
        transform: `translate(${vpX}px, ${vpY}px) scale(${zoom})`,
        transformOrigin: '0 0',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      {/* Ghost Connections */}
      {paths.map((d, i) => (
        <path
          key={`path-${i}`}
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          strokeOpacity={0.15}
          className="text-zinc-500 dark:text-zinc-400"
        />
      ))}

      {/* Ghost Stages and Items */}
      {mapData.stages.map((stage, colIdx) => {
        const colX = PADDING + colIdx * COL_W;
        return (
          <g key={stage.id}>
            {/* Stage Header */}
            <text
              x={colX}
              y={PADDING + 24}
              className="fill-zinc-500 dark:fill-zinc-400 font-bold text-[13px] uppercase tracking-[0.15em]"
              opacity={0.25}
            >
              {stage.name}
            </text>
            <line
              x1={colX}
              y1={PADDING + HEADER_H - 16}
              x2={colX + 240}
              y2={PADDING + HEADER_H - 16}
              stroke="currentColor"
              className="text-zinc-500 dark:text-zinc-400"
              strokeWidth={1}
              opacity={0.15}
            />

            {/* Items */}
            {(stage.items || []).map((item, rowIdx) => {
              const x = colX;
              const y = PADDING + HEADER_H + rowIdx * (ITEM_H + GAP_Y);
              return (
                <g key={item.id}>
                  <rect
                    x={x}
                    y={y}
                    width={240}
                    height={ITEM_H}
                    rx={8}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    className="text-zinc-500 dark:text-zinc-400"
                    opacity={0.15}
                  />
                  <text
                    x={x + 16}
                    y={y + 36}
                    className="fill-zinc-500 dark:fill-zinc-400 text-[14px]"
                    opacity={0.25}
                  >
                    {item.type === 'video' || item.type === 'youtube' ? '▶' : '📄'}
                  </text>
                  <text
                    x={x + 40}
                    y={y + 37}
                    className="fill-zinc-500 dark:fill-zinc-400 font-medium text-[13px]"
                    opacity={0.35}
                  >
                    {item.title.length > 28 ? item.title.substring(0, 28) + '...' : item.title}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
