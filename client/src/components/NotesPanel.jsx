import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { api } from '../api/client';
import { useStore } from '../store/useStore';
import { useVoiceInput } from '../hooks/useVoiceInput';

const SOURCE_LABELS = {
  manual: 'Note',
  pause_point: 'Pause',
  voice: 'Voice',
  reflection: 'Reflection',
};

export default function NotesPanel({ itemId, onClose }) {
  const voiceEnabled = useStore(s => s.settings.voiceEnabled);
  const notes         = useStore(s => s.notes);
  const setNotes      = useStore(s => s.setNotes);
  const addNote       = useStore(s => s.addNote);
  const removeNote    = useStore(s => s.removeNote);
  const highlights    = useStore(s => s.highlights[itemId] || []);
  const removeHighlight = useStore(s => s.removeHighlight);

  const [body, setBody]       = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const listEndRef            = useRef(null);

  const { listening, supported, start, stop } = useVoiceInput({
    onTranscript: (t) => setBody(prev => prev + (prev ? ' ' : '') + t),
  });

  const handleHighlightClick = (hlId) => {
    const mark = document.querySelector(`mark[data-highlight-id="${hlId}"]`);
    if (mark) {
      mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (window.innerWidth < 640) onClose();
    }
  };

  // Load notes on mount
  useEffect(() => {
    setFetching(true);
    api.getNotes(itemId)
      .then(data => setNotes(data))
      .catch(console.error)
      .finally(() => setFetching(false));
  }, [itemId, setNotes]);

  // Scroll to bottom when notes change
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [notes.length]);

  async function handleAdd() {
    if (!body.trim()) return;
    setLoading(true);
    try {
      const note = await api.createNote(itemId, { body: body.trim(), source: listening ? 'voice' : 'manual' });
      addNote(note);
      setBody('');
    } catch (err) {
      console.error('Failed to add note', err);
    } finally {
      setLoading(false);
    }
  }

  function toggleVoice() {
    if (listening) {
      stop();
    } else {
      start();
    }
  }

  return (
    <>
      {/* Mobile overlay backdrop */}
      <div
        className="fixed inset-0 bg-zinc-950/30 dark:bg-zinc-950/50 z-40 sm:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col
                   w-full sm:w-64
                   bg-zinc-50 dark:bg-zinc-950
                   border-l border-zinc-200 dark:border-zinc-800
                   animate-slide-right"
        role="complementary"
        aria-label="Notes panel"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <h2 className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
            {highlights.length > 0 ? `Notes & Highlights (${notes.length + highlights.length})` : 'Notes'}
          </h2>
          <button onClick={onClose} className="btn-ghost btn-sm p-0 w-9 h-9 min-h-0 rounded-full" aria-label="Close notes">
            ×
          </button>
        </div>

        {/* Notes list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {fetching && (
            <div className="space-y-2">
              <div className="skeleton h-10 rounded" />
              <div className="skeleton h-10 rounded" />
            </div>
          )}
          {!fetching && notes.length === 0 && highlights.length === 0 && (
            <p className="text-xs text-zinc-400 dark:text-zinc-600 text-center pt-8">
              No notes or highlights yet.
            </p>
          )}

          {/* Highlights Section */}
          {highlights.length > 0 && (
            <div className="space-y-3 pb-4">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Highlights</h3>
              {highlights.map(hl => (
                <div key={hl.id} className="group animate-fade-in cursor-pointer" onClick={() => handleHighlightClick(hl.id)}>
                  <div className="flex items-start justify-between gap-1 mb-0.5">
                    <div className="flex-1 border-l-2 border-yellow-400 dark:border-amber-600 pl-2">
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 italic line-clamp-3">&quot;{hl.selected_text}&quot;</p>
                    </div>
                    <button
                      className="opacity-0 group-hover:opacity-100 text-zinc-300 dark:text-zinc-700
                                 hover:text-zinc-500 dark:hover:text-zinc-400 text-xs transition-opacity shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        api.deleteHighlight(hl.id).then(() => removeHighlight(itemId, hl.id)).catch(console.error);
                      }}
                      aria-label="Delete highlight"
                      title="Delete"
                    >
                      ×
                    </button>
                  </div>
                  {hl.annotation && (
                    <p className="text-xs text-zinc-800 dark:text-zinc-200 mt-1.5 ml-2.5">
                      {hl.annotation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {notes.length > 0 && highlights.length > 0 && <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800/50">Notes</h3>}
          {notes.map(note => (
            <div key={note.id} className="group animate-fade-in">
              <div className="flex items-start justify-between gap-1 mb-0.5">
                <span className="source-badge bg-zinc-100 dark:bg-zinc-800">
                  {SOURCE_LABELS[note.source] || note.source}
                </span>
                <button
                  className="opacity-0 group-hover:opacity-100 text-zinc-300 dark:text-zinc-700
                             hover:text-zinc-500 dark:hover:text-zinc-400 text-xs transition-opacity"
                  onClick={() => {
                    api.deleteNote(note.id).then(() => removeNote(note.id)).catch(console.error);
                  }}
                  aria-label="Delete note"
                  title="Delete"
                >
                  ×
                </button>
              </div>
              <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {note.body}
              </p>
            </div>
          ))}
          <div ref={listEndRef} />
        </div>

        {/* Input area */}
        <div className="shrink-0 p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
          {listening && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 animate-pulse">
              🎤 Listening…
            </p>
          )}
          <textarea
            className="textarea text-sm"
            placeholder={listening ? 'Listening…' : 'Add a note…'}
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdd();
            }}
            aria-label="Note text"
          />
          <div className="flex gap-2">
            <button
              className="btn-secondary btn-sm flex-1"
              onClick={handleAdd}
              disabled={loading || !body.trim()}
            >
              {loading ? 'Saving…' : 'Add'}
            </button>
            {voiceEnabled && supported && (
              <button
                className={`btn-sm rounded ${listening
                  ? 'btn-primary animate-pulse'
                  : 'btn-secondary'}`}
                onClick={toggleVoice}
                aria-label={listening ? 'Stop recording' : 'Start voice input'}
                title={listening ? 'Stop' : 'Voice input'}
              >
                🎤
              </button>
            )}
          </div>
          <p className="text-xs text-zinc-400 dark:text-zinc-600">⌘↵ to save</p>
        </div>
      </div>
    </>
  );
}

NotesPanel.propTypes = {
  itemId: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
};
