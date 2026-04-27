import { useState } from 'react';
import { api } from '../api/client';

export default function CompletionGate({ item, onDone }) {
  const [text, setText]         = useState(item.reflection || '');
  const [saving, setSaving]     = useState(false);
  const [done, setDone]         = useState(item.status === 'done' && !!item.reflection);
  const [error, setError]       = useState(null);

  const canSave = text.trim().length >= 10;

  async function handleDone() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await api.updateItem(item.id, { status: 'done', reflection: text.trim() });
      await api.createNote(item.id, { body: text.trim(), source: 'reflection' });
      setDone(true);
      onDone?.();
    } catch (err) {
      setError('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="pause-block animate-fade-in" role="region" aria-label="Complete">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-600 mb-2">
          Completed
        </p>
        <p className="text-sm text-zinc-700 dark:text-zinc-300 italic mb-2">"{item.reflection || text}"</p>
        <p className="text-xs text-zinc-400 dark:text-zinc-600">
          This item has been marked done. Your reflection is saved.
        </p>
      </div>
    );
  }

  return (
    <div id="reader-completion-gate" className="pause-block" role="region" aria-label="Completion gate">
      <p className="text-xs font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-600 mb-2">
        Before you move on
      </p>
      <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-3">
        Write one sentence: the core idea of this piece in your own words.
      </p>
      <textarea
        className="textarea text-sm mb-3"
        placeholder="The core idea is…"
        value={text}
        onChange={e => setText(e.target.value)}
        rows={2}
        maxLength={500}
        aria-label="Reflection"
      />
      {!canSave && text.length > 0 && (
        <p className="text-xs text-zinc-400 dark:text-zinc-600 mb-2">
          Keep going — {10 - text.trim().length} more character{10 - text.trim().length !== 1 ? 's' : ''} to unlock.
        </p>
      )}
      {error && (
        <p className="text-xs text-red-500 mb-2">{error}</p>
      )}
      <button
        className="btn-primary"
        onClick={handleDone}
        disabled={!canSave || saving}
        aria-label="Mark this item as done"
      >
        {saving ? 'Saving…' : 'Mark as done'}
      </button>
    </div>
  );
}
