import { memo, useState, useCallback } from 'react';
import { getBezierPath, EdgeLabelRenderer, BaseEdge } from 'reactflow';
import { LABEL_CHIPS } from './SynthesisNodes';

export const SynthesisEdge = memo(({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data = {},
  selected,
}) => {
  const { label, hasArrow, onLabelSave, onDelete } = data;
  const [showMenu, setShowMenu] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelText, setLabelText] = useState(label || '');

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const markerEnd = hasArrow
    ? 'url(#synthesis-arrow)'
    : undefined;

  function handleEdgeClick(e) {
    e.stopPropagation();
    setShowMenu(v => !v);
    setEditingLabel(false);
  }

  function handleLabelSave() {
    onLabelSave?.(labelText || null);
    setEditingLabel(false);
    setShowMenu(false);
  }

  return (
    <>
      {/* Invisible wide hit zone */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="cursor-pointer"
        onClick={handleEdgeClick}
      />

      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: selected ? 'var(--edge-selected)' : 'var(--edge-default)',
          strokeWidth: selected ? 2.5 : 1.5,
          transition: 'stroke 0.15s, stroke-width 0.15s',
        }}
      />

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          {/* Label pill */}
          {label && !editingLabel && (
            <button
              onClick={handleEdgeClick}
              className="synthesis-edge-label"
            >
              {label}
            </button>
          )}

          {/* Label input */}
          {editingLabel && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg p-3 w-56 animate-fade-in">
              <input
                className="input text-xs w-full mb-2"
                value={labelText}
                onChange={e => setLabelText(e.target.value)}
                placeholder="Relationship..."
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleLabelSave(); if (e.key === 'Escape') { setEditingLabel(false); setShowMenu(false); } }}
              />
              <div className="flex flex-wrap gap-1 mb-2">
                {LABEL_CHIPS.map(chip => (
                  <button
                    key={chip}
                    onClick={() => setLabelText(chip)}
                    className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${labelText === chip ? 'border-zinc-700 bg-zinc-100 dark:bg-zinc-800 dark:border-zinc-300' : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'}`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setLabelText(''); handleLabelSave(); }} className="flex-1 btn-ghost btn-sm text-xs">Skip</button>
                <button onClick={handleLabelSave} className="flex-1 btn-primary btn-sm text-xs">Save</button>
              </div>
            </div>
          )}

          {/* Context menu */}
          {showMenu && !editingLabel && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg py-1 w-40 animate-fade-in">
              <button onClick={() => { setEditingLabel(true); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                {label ? 'Edit label' : 'Add label'}
              </button>
              <button onClick={() => { onDelete?.(); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20">Delete connection</button>
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

SynthesisEdge.displayName = 'SynthesisEdge';

// Arrow marker definition — rendered once inside the ReactFlow SVG defs
export function SynthesisEdgeMarkers() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }}>
      <defs>
        <marker id="synthesis-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L0,8 L8,4 z" style={{ fill: 'var(--edge-default)' }} />
        </marker>
      </defs>
    </svg>
  );
}
