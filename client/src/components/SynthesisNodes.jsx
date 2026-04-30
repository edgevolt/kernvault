import { memo, useRef, useState } from 'react';
import { Handle, Position } from 'reactflow';

// Shared color tint map for optional node colors
export const TINT_MAP = {
  null: null,
  rose:     'bg-rose-50    dark:bg-rose-950/30  border-rose-200    dark:border-rose-900',
  amber:    'bg-amber-50   dark:bg-amber-950/30 border-amber-200   dark:border-amber-900',
  emerald:  'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900',
  sky:      'bg-sky-50     dark:bg-sky-950/30   border-sky-200     dark:border-sky-900',
  violet:   'bg-violet-50  dark:bg-violet-950/30 border-violet-200  dark:border-violet-900',
  slate:    'bg-slate-100  dark:bg-slate-900/50  border-slate-300   dark:border-slate-700',
};

const STAGE_ACCENTS = [
  'bg-violet-400', 'bg-sky-400', 'bg-emerald-400',
  'bg-amber-400',  'bg-rose-400','bg-indigo-400',
  'bg-teal-400',   'bg-pink-400',
];

export const LABEL_CHIPS = ['builds on', 'contradicts', 'explains', 'leads to', 'supports', 'questions'];

// ─── Shared Handle dots (visible on hover via CSS) ────────────────────────────
function Handles() {
  return (
    <>
      <Handle type="source" position={Position.Top}    className="synthesis-handle" id="s-top"    />
      <Handle type="source" position={Position.Bottom} className="synthesis-handle" id="s-bottom" />
      <Handle type="source" position={Position.Left}   className="synthesis-handle" id="s-left"   />
      <Handle type="source" position={Position.Right}  className="synthesis-handle" id="s-right"  />
      <Handle type="target" position={Position.Top}    className="synthesis-handle" id="t-top"    style={{ pointerEvents: 'none' }} />
      <Handle type="target" position={Position.Bottom} className="synthesis-handle" id="t-bottom" style={{ pointerEvents: 'none' }} />
      <Handle type="target" position={Position.Left}   className="synthesis-handle" id="t-left"   style={{ pointerEvents: 'none' }} />
      <Handle type="target" position={Position.Right}  className="synthesis-handle" id="t-right"  style={{ pointerEvents: 'none' }} />
    </>
  );
}

// ─── Color picker popover ─────────────────────────────────────────────────────
export function ColorPicker({ currentColor, onSelect }) {
  const colors = [null, 'rose', 'amber', 'emerald', 'sky', 'violet', 'slate'];
  const swatches = { null: 'bg-zinc-200 dark:bg-zinc-700', rose: 'bg-rose-300', amber: 'bg-amber-300', emerald: 'bg-emerald-300', sky: 'bg-sky-300', violet: 'bg-violet-300', slate: 'bg-slate-400' };
  return (
    <div className="flex gap-1.5 p-1">
      {colors.map(c => (
        <button
          key={c ?? 'null'}
          onClick={() => onSelect(c)}
          title={c ?? 'Default'}
          className={`w-5 h-5 rounded-full ${swatches[c]} transition-transform ${currentColor === c ? 'ring-2 ring-offset-1 ring-zinc-700 dark:ring-zinc-200 scale-110' : 'hover:scale-110'}`}
        />
      ))}
    </div>
  );
}

// ─── SynthesisItemNode ────────────────────────────────────────────────────────
export const SynthesisItemNode = memo(({ data }) => {
  const { title, reflection, stageName, stageIndex = 0, type: itemType, color, onColorChange, onOpenSource, onDelete } = data;
  const [showMenu, setShowMenu] = useState(false);

  const accentClass = STAGE_ACCENTS[stageIndex % STAGE_ACCENTS.length];
  const tintClass = color ? TINT_MAP[color] : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800';

  return (
    <div
      className={`synthesis-node ${tintClass} min-w-[180px] max-w-[360px] relative`}
      onDoubleClick={() => setShowMenu(v => !v)}
    >
      <Handles />
      {/* Left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${accentClass} opacity-60`} />

      <div className="pl-3 pr-2 pt-2.5 pb-2 flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100 leading-snug line-clamp-3 flex-1">{title}</p>
          <button onClick={() => setShowMenu(v => !v)} className="shrink-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-[11px]">⋯</button>
        </div>
        {reflection && (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug line-clamp-3">{reflection}</p>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[9px] uppercase tracking-widest text-zinc-400 dark:text-zinc-600">{stageName}</span>
          {itemType && <span className="text-[9px] uppercase tracking-widest text-zinc-400 dark:text-zinc-600">· {itemType}</span>}
        </div>
      </div>

      {/* Action menu */}
      {showMenu && (
        <div className="absolute top-full right-0 mt-1 z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg py-1 w-40 text-left animate-fade-in">
          <ColorPicker currentColor={color} onSelect={c => { onColorChange?.(c); setShowMenu(false); }} />
          <div className="border-t border-zinc-100 dark:border-zinc-800 my-1" />
          {onOpenSource && (
            <button onClick={() => { onOpenSource(); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">Open source</button>
          )}
          <button onClick={() => { onDelete?.(); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20">Delete node</button>
        </div>
      )}
    </div>
  );
});

// ─── SynthesisHighlightNode ───────────────────────────────────────────────────
export const SynthesisHighlightNode = memo(({ data }) => {
  const { selectedText, annotation, itemTitle, color, onColorChange, onOpenSource, onDelete } = data;
  const [showMenu, setShowMenu] = useState(false);
  const tintClass = color ? TINT_MAP[color] : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900';

  return (
    <div className={`synthesis-node ${tintClass} min-w-[180px] max-w-[360px] relative`} onDoubleClick={() => setShowMenu(v => !v)}>
      <Handles />
      <div className="px-3 pt-2.5 pb-2 flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <blockquote className="text-[12px] text-zinc-700 dark:text-zinc-300 leading-snug italic border-l-2 border-amber-400 pl-2 line-clamp-4 flex-1">
            {selectedText}
          </blockquote>
          <button onClick={() => setShowMenu(v => !v)} className="shrink-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-[11px]">⋯</button>
        </div>
        {annotation && (
          <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug">{annotation}</p>
        )}
        {itemTitle && (
          <p className="text-[9px] uppercase tracking-widest text-zinc-400 dark:text-zinc-600 mt-0.5">{itemTitle}</p>
        )}
      </div>
      {showMenu && (
        <div className="absolute top-full right-0 mt-1 z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg py-1 w-40 animate-fade-in">
          <ColorPicker currentColor={color} onSelect={c => { onColorChange?.(c); setShowMenu(false); }} />
          <div className="border-t border-zinc-100 dark:border-zinc-800 my-1" />
          {onOpenSource && <button onClick={() => { onOpenSource(); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">Open source</button>}
          <button onClick={() => { onDelete?.(); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20">Delete node</button>
        </div>
      )}
    </div>
  );
});

// ─── SynthesisPauseNode ───────────────────────────────────────────────────────
export const SynthesisPauseNode = memo(({ data }) => {
  const { prompt, response, itemTitle, color, onColorChange, onOpenSource, onDelete } = data;
  const [showMenu, setShowMenu] = useState(false);
  const tintClass = color ? TINT_MAP[color] : 'bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-900';

  return (
    <div className={`synthesis-node ${tintClass} min-w-[180px] max-w-[360px] relative`} onDoubleClick={() => setShowMenu(v => !v)}>
      <Handles />
      <div className="px-3 pt-2.5 pb-2 flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          {prompt && <p className="text-[10px] italic text-zinc-500 dark:text-zinc-500 leading-snug flex-1 line-clamp-2">{prompt}</p>}
          <button onClick={() => setShowMenu(v => !v)} className="shrink-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-[11px]">⋯</button>
        </div>
        <p className="text-[12px] text-zinc-800 dark:text-zinc-200 leading-snug line-clamp-4">{response}</p>
        {itemTitle && (
          <p className="text-[9px] uppercase tracking-widest text-zinc-400 dark:text-zinc-600 mt-0.5">{itemTitle}</p>
        )}
      </div>
      {showMenu && (
        <div className="absolute top-full right-0 mt-1 z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg py-1 w-40 animate-fade-in">
          <ColorPicker currentColor={color} onSelect={c => { onColorChange?.(c); setShowMenu(false); }} />
          <div className="border-t border-zinc-100 dark:border-zinc-800 my-1" />
          {onOpenSource && <button onClick={() => { onOpenSource(); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">Open source</button>}
          <button onClick={() => { onDelete?.(); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20">Delete node</button>
        </div>
      )}
    </div>
  );
});

// ─── SynthesisFreetextNode ────────────────────────────────────────────────────
export const SynthesisFreetextNode = memo(({ data }) => {
  const { content, onContentSave, onDelete, color, onColorChange } = data;
  const [text, setText] = useState(content || '');
  const [showMenu, setShowMenu] = useState(false);
  const textareaRef = useRef(null);
  const tintClass = color ? TINT_MAP[color] : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800';

  function handleBlur() {
    if (text !== content) onContentSave?.(text);
  }

  return (
    <div className={`synthesis-node ${tintClass} min-w-[180px] max-w-[360px] relative`}>
      <Handles />
      <div className="px-2 pt-2 pb-1.5 flex flex-col gap-1">
        <div className="flex justify-end">
          <button onClick={() => setShowMenu(v => !v)} className="text-zinc-300 hover:text-zinc-500 dark:hover:text-zinc-400 w-5 h-5 flex items-center justify-center rounded text-[11px]">⋯</button>
        </div>
        <textarea
          ref={textareaRef}
          className="nodrag w-full bg-transparent text-[13px] text-zinc-800 dark:text-zinc-200 placeholder-zinc-300 dark:placeholder-zinc-700 resize-none focus:outline-none leading-relaxed min-h-[60px]"
          placeholder="What are you thinking?"
          value={text}
          onChange={e => setText(e.target.value)}
          onBlur={handleBlur}
          rows={3}
        />
      </div>
      {showMenu && (
        <div className="absolute top-0 right-full mr-1 z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg py-1 w-40 animate-fade-in">
          <ColorPicker currentColor={color} onSelect={c => { onColorChange?.(c); setShowMenu(false); }} />
          <div className="border-t border-zinc-100 dark:border-zinc-800 my-1" />
          <button onClick={() => { onDelete?.(); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20">Delete note</button>
        </div>
      )}
    </div>
  );
});

SynthesisItemNode.displayName      = 'SynthesisItemNode';
SynthesisHighlightNode.displayName = 'SynthesisHighlightNode';
SynthesisPauseNode.displayName     = 'SynthesisPauseNode';
SynthesisFreetextNode.displayName  = 'SynthesisFreetextNode';
