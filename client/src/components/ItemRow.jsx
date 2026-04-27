import { useState } from 'react';
import { api } from '../api/client';
import { useNavigate } from 'react-router-dom';

// Status display config
const STATUS = {
  unread:  { label: 'Unread',   dot: 'border-zinc-300 dark:border-zinc-700 bg-transparent', check: null },
  reading: { label: 'Reading',  dot: 'border-zinc-500 dark:border-zinc-400 bg-zinc-200 dark:bg-zinc-700', check: null },
  done:    { label: 'Done',     dot: 'border-zinc-700 dark:border-zinc-300 bg-zinc-700 dark:bg-zinc-300', check: '✓' },
  done_quick: { label: 'Done (no reflection)', dot: 'border-zinc-400 dark:border-zinc-500 bg-transparent', check: '✓' },
};

const CYCLE = { unread: 'reading', reading: 'done_quick', done_quick: 'unread', done: 'unread' };

const TYPE_LABELS = {
  article: 'Article', video: 'Video', book: 'Book',
  paper: 'Paper', tutorial: 'Tutorial', project: 'Project', other: 'Other',
};

export default function ItemRow({ item, stages = [], onStatusChange, onClick, onMove, onDelete, selectable, selected, onSelect, dragProvided }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState(item.status === 'done' && !item.reflection ? 'done_quick' : item.status);
  const [updating, setUpdating] = useState(false);

  async function cycleStatus(e) {
    e.preventDefault();
    e.stopPropagation();
    const next = CYCLE[status] || 'unread';
    const apiStatus = next === 'done_quick' ? 'done' : next;

    setUpdating(true);
    try {
      await api.updateItem(item.id, { status: apiStatus });
      setStatus(next);
      onStatusChange?.(item.id, apiStatus);
    } catch (err) {
      console.error('Failed to update status', err);
    } finally {
      setUpdating(false);
    }
  }

  const cfg = STATUS[status] || STATUS.unread;
  
  let domain = '';
  try {
    if (item.source_url) {
      domain = new URL(item.source_url).hostname.replace(/^www\./, '');
    }
  } catch(e) {}

  let depthScore = 0;
  if (item.recall_level >= 4) depthScore = 5;
  else if (item.recall_level >= 1) depthScore = 4;
  else if (item.reflection) depthScore = 3;
  else if (item.note_count > 0 || item.pause_point_count > 0) depthScore = 2;
  else if (status === 'done' || status === 'done_quick') depthScore = 1;

  // Readability badge (Flesch-Kincaid: higher = easier)
  let readabilityLabel = null;
  if (item.readability_score != null && item.content_type !== 'youtube') {
    if (item.readability_score >= 70) readabilityLabel = 'Accessible';
    else if (item.readability_score >= 40) readabilityLabel = 'Moderate';
    else readabilityLabel = 'Dense';
  }

  return (
    <div
      ref={dragProvided?.innerRef}
      {...dragProvided?.draggableProps}
      className={`flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors cursor-pointer group ${dragProvided ? 'bg-white dark:bg-zinc-950 shadow-sm border border-zinc-200/50 dark:border-zinc-800/50' : ''}`}
      onClick={() => onClick?.(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.(item)}
      aria-label={`Open item: ${item.title}`}
    >
      {/* Drag Grip (visible when not selecting) */}
      {dragProvided && !selectable && (
        <div 
          {...dragProvided.dragHandleProps}
          className="shrink-0 text-zinc-300 dark:text-zinc-700 hover:text-zinc-500 transition-colors cursor-grab active:cursor-grabbing mr-1"
          onClick={e => e.stopPropagation()}
          title="Drag to reorder"
          aria-label="Drag handle"
        >
          <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
            <circle cx="3" cy="4" r="1.5" />
            <circle cx="8" cy="4" r="1.5" />
            <circle cx="3" cy="8" r="1.5" />
            <circle cx="8" cy="8" r="1.5" />
            <circle cx="3" cy="12" r="1.5" />
            <circle cx="8" cy="12" r="1.5" />
          </svg>
        </div>
      )}
      {/* Checkbox (Bulk Select Mode) */}
      {selectable && (
        <div className="shrink-0 mr-1" onClick={e => { e.stopPropagation(); onSelect?.(); }}>
          <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors
            ${selected 
              ? 'bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-100 text-zinc-50 dark:text-zinc-900' 
              : 'border-zinc-300 dark:border-zinc-700 bg-transparent'}`}>
            {selected && <span className="text-[10px] leading-none">✓</span>}
          </div>
        </div>
      )}

      {/* Status dot */}
      <button
        onClick={cycleStatus}
        disabled={updating || selectable}
        aria-label={`Cycle status (currently ${cfg.label})`}
        className="status-dot shrink-0"
        title={cfg.label}
      >
        <div className={`status-dot-inner ${cfg.dot} ${updating ? 'opacity-50' : ''}`}>
          {cfg.check && (
            <span className={`text-[9px] leading-none font-medium
              ${status === 'done' ? 'text-zinc-50 dark:text-zinc-900' : 'text-zinc-400 dark:text-zinc-500'}`}>
              {cfg.check}
            </span>
          )}
        </div>
      </button>

      {/* Title + domain sub-text */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <span className={`text-sm leading-snug line-clamp-1
          ${status === 'done' || status === 'done_quick'
            ? 'text-zinc-400 dark:text-zinc-600 line-through decoration-zinc-300 dark:decoration-zinc-700'
            : 'text-zinc-800 dark:text-zinc-200'}`}>
          {item.title}
        </span>
        <div className="flex items-center gap-3 mt-0.5">
          {domain && (
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 line-clamp-1">
              {domain}
            </span>
          )}
          {depthScore > 0 && (
             <div className="flex gap-0.5 opacity-60" title={`Processing Depth: ${depthScore}/5`}>
               <div className={`w-1 h-1.5 rounded-sm ${depthScore >= 1 ? 'bg-zinc-500 dark:bg-zinc-400' : 'bg-zinc-200 dark:bg-zinc-800'}`} />
               <div className={`w-1 h-1.5 rounded-sm ${depthScore >= 2 ? 'bg-zinc-500 dark:bg-zinc-400' : 'bg-zinc-200 dark:bg-zinc-800'}`} />
               <div className={`w-1 h-1.5 rounded-sm ${depthScore >= 3 ? 'bg-zinc-500 dark:bg-zinc-400' : 'bg-zinc-200 dark:bg-zinc-800'}`} />
               {depthScore >= 4 && <div className={`w-1 h-1.5 rounded-sm bg-zinc-500 dark:bg-zinc-400`} />}
               {depthScore >= 5 && <div className={`w-1 h-1.5 rounded-sm bg-zinc-800 dark:bg-zinc-200`} />}
             </div>
          )}
        </div>
      </div>

      {/* Type badge + readability */}
      <div className="flex items-center gap-1.5 shrink-0 hidden sm:flex">
        {readabilityLabel && (
          <span className="type-badge opacity-60" title={`Readability: ${item.readability_score?.toFixed(0)}`}>
            {readabilityLabel}
          </span>
        )}
        <span className="type-badge">
          {TYPE_LABELS[item.type] || item.type}
        </span>
      </div>

      {/* Right side wrapper: holds predictable layout space for the chevron */}
      <div className="flex items-center justify-end shrink-0 relative min-h-[24px] w-6">
        {/* Hover actions: absolutely positioned to avoid shifting layout, solid bg to cover underlying elements cleanly */}
        <div className="absolute right-0 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity duration-200 pl-3 pr-1 py-1 pointer-events-none group-hover:pointer-events-auto bg-zinc-50 dark:bg-zinc-900 rounded-l-md z-10">
          {(status === 'done' || status === 'done_quick') && (
            <button
              onClick={e => {
                e.stopPropagation();
                navigate(`/recall?item_id=${item.id}`);
              }}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors px-2 text-[10px] uppercase tracking-widest font-medium"
              title="Start manual recall session"
              tabIndex={-1}
            >
              Recall
            </button>
          )}
          <button
            onClick={e => {
              e.stopPropagation();
              if (window.confirm(`Delete "${item.title}"?`)) onDelete?.(item);
            }}
            className="text-zinc-300 hover:text-red-500 transition-colors px-1 text-lg leading-none"
            title="Delete item"
            tabIndex={-1}
          >
            ×
          </button>
        </div>

        {/* Chevron cleanly fades out on hover */}
        <span className="absolute right-2 text-zinc-300 dark:text-zinc-700 transition-opacity duration-200 group-hover:opacity-0 flex items-center justify-center pointer-events-none">
          ›
        </span>
      </div>
    </div>
  );
}
