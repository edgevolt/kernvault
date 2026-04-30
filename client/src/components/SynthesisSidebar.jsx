import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';

const STAGE_BADGE_COLORS = [
  'text-violet-500', 'text-sky-500', 'text-emerald-500',
  'text-amber-500',  'text-rose-500', 'text-indigo-500',
];

function SidebarSection({ title, count, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;
  return (
    <div className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
      >
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-500">{title}</span>
        <span className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-400">{count}</span>
          <span className={`text-zinc-400 text-xs transition-transform duration-200 ${open ? '' : '-rotate-90'}`}>▾</span>
        </span>
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
}

function SidebarItem({ label, sublabel, badge, badgeColor, onCanvasAlready, onClick, onDragStart }) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="group mx-2 px-3 py-2.5 rounded-lg cursor-grab active:cursor-grabbing hover:bg-zinc-100 dark:hover:bg-zinc-800/70 transition-colors"
      onClick={onClick}
    >
      {badge && (
        <span className={`text-[9px] font-bold uppercase tracking-widest ${badgeColor || 'text-zinc-400'} block mb-1`}>
          {badge}
        </span>
      )}
      <p className="text-[12px] text-zinc-800 dark:text-zinc-200 leading-snug line-clamp-2">{label}</p>
      {sublabel && (
        <p className="text-[11px] text-zinc-400 dark:text-zinc-600 leading-snug mt-0.5 line-clamp-2">{sublabel}</p>
      )}
      {onCanvasAlready && (
        <p className="text-[9px] uppercase tracking-widest text-zinc-400 dark:text-zinc-600 mt-1">On canvas</p>
      )}
    </div>
  );
}

export default function SynthesisSidebar({
  space,
  synthesisNodes,
  onAddNode,
  isMobile = false,
  mobileOpen = false,
  onMobileClose,
}) {
  const [highlights, setHighlights] = useState([]);
  const [pausePoints, setPausePoints] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Fetch highlights + pause points once per sidebar open
  useEffect(() => {
    if (dataLoaded) return;
    if (!space?.stages?.length) return;

    const allItemIds = space.stages.flatMap(s => (s.items || []).map(i => i.id));
    if (!allItemIds.length) return;

    Promise.all([
      ...allItemIds.map(id => api.getItemHighlights(id).catch(() => [])),
      ...allItemIds.map(id => api.getPausePoints(id).catch(() => [])),
    ]).then(results => {
      const mid = allItemIds.length;
      const hlArrays = results.slice(0, mid);
      const ppArrays = results.slice(mid);
      setHighlights(hlArrays.flat().filter(h => h.annotation_state === 'annotated'));
      setPausePoints(ppArrays.flat().filter(p => !p.skipped && p.response));
      setDataLoaded(true);
    });
  }, [space, dataLoaded]);

  const placedSourceIds = new Set(synthesisNodes.map(n => n.source_id).filter(Boolean));

  // Item lookup for annotations/pause points
  const itemById = {};
  (space?.stages || []).forEach(s => (s.items || []).forEach(i => { itemById[i.id] = i; }));

  function handleDragStart(e, type, sourceData) {
    e.dataTransfer.setData('application/synthesis-node', JSON.stringify({ type, sourceData }));
    e.dataTransfer.effectAllowed = 'copy';
  }

  function handleItemTap(type, sourceData) {
    onAddNode?.({ type, sourceData, atCenter: true });
    onMobileClose?.();
  }

  // Done items grouped by stage
  const doneStages = (space?.stages || []).map((stage, stageIndex) => ({
    stage,
    stageIndex,
    doneItems: (stage.items || []).filter(i => i.status === 'done'),
  })).filter(({ doneItems }) => doneItems.length > 0);

  const totalDone = doneStages.reduce((acc, { doneItems }) => acc + doneItems.length, 0);

  const content = (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between shrink-0">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Add to Canvas</h3>
        {isMobile && (
          <button onClick={onMobileClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 w-8 h-8 flex items-center justify-center rounded-lg">×</button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Items */}
        <SidebarSection title="Items" count={totalDone}>
          {doneStages.map(({ stage, stageIndex, doneItems }) => (
            <div key={stage.id}>
              <p className={`px-4 pt-2 pb-1 text-[9px] font-bold uppercase tracking-widest ${STAGE_BADGE_COLORS[stageIndex % STAGE_BADGE_COLORS.length]}`}>
                {stage.name}
              </p>
              {doneItems.map(item => (
                <SidebarItem
                  key={item.id}
                  label={item.title}
                  sublabel={item.reflection}
                  onCanvasAlready={placedSourceIds.has(item.id)}
                  onClick={() => handleItemTap('item', { item, stage, stageIndex })}
                  onDragStart={e => handleDragStart(e, 'item', { item, stage, stageIndex })}
                />
              ))}
            </div>
          ))}
        </SidebarSection>

        {/* Highlights */}
        <SidebarSection title="Highlights" count={highlights.length}>
          {highlights.map(h => (
            <SidebarItem
              key={h.id}
              label={`"${h.selected_text}"`}
              sublabel={h.annotation}
              badge={itemById[h.item_id]?.title}
              onCanvasAlready={placedSourceIds.has(h.id)}
              onClick={() => handleItemTap('highlight', { highlight: h, item: itemById[h.item_id] })}
              onDragStart={e => handleDragStart(e, 'highlight', { highlight: h, item: itemById[h.item_id] })}
            />
          ))}
        </SidebarSection>

        {/* Pause Point Responses */}
        <SidebarSection title="Pause Points" count={pausePoints.length}>
          {pausePoints.map(pp => (
            <SidebarItem
              key={pp.id}
              label={pp.response}
              sublabel={pp.prompt}
              badge={itemById[pp.item_id]?.title}
              onCanvasAlready={placedSourceIds.has(pp.id)}
              onClick={() => handleItemTap('pause_point', { pausePoint: pp, item: itemById[pp.item_id] })}
              onDragStart={e => handleDragStart(e, 'pause_point', { pausePoint: pp, item: itemById[pp.item_id] })}
            />
          ))}
        </SidebarSection>
      </div>

      {/* New Thought button */}
      <div className="shrink-0 p-3 border-t border-zinc-100 dark:border-zinc-800">
        <button
          onClick={() => { onAddNode?.({ type: 'freetext', atCenter: true }); onMobileClose?.(); }}
          className="w-full py-2 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 text-xs text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
        >
          + New thought
        </button>
      </div>
    </div>
  );

  // Desktop layout
  if (!isMobile) {
    return (
      <div className="synthesis-sidebar">
        {content}
      </div>
    );
  }

  // Mobile bottom drawer
  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-zinc-900/40 backdrop-blur-sm" onClick={onMobileClose} />
      )}
      <div className={`fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-950 rounded-t-2xl border-t border-zinc-200 dark:border-zinc-800 shadow-2xl transition-transform duration-300 ${mobileOpen ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ maxHeight: '55vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="w-12 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full mx-auto mt-3 mb-1 shrink-0" />
        {content}
      </div>
    </>
  );
}
