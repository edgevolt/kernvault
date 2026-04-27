import { useState } from 'react';
import { api } from '../api/client';

export default function SpaceSettingsModal({ space, onClose, onUpdated }) {
  const [name, setName] = useState(space?.name || '');
  const [intent, setIntent] = useState(space?.intent || '');
  const [methodology, setMethodology] = useState(space?.methodology || 'standard');
  const [targetDurationDays, setTargetDurationDays] = useState(space?.target_duration_days || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!intent.trim()) {
      setError('Intent is required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        name: name.trim(),
        intent: intent.trim(),
        methodology,
        target_duration_days: targetDurationDays ? parseInt(targetDurationDays) : null,
      };

      const updated = await api.updateSpace(space.id, payload);
      onUpdated?.(updated);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not update space settings.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-box animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-100">Space settings</h2>
          <button onClick={onClose} className="btn-ghost btn-sm rounded-full w-8 h-8 min-h-0 p-0 flex items-center justify-center text-lg">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              type="text"
              className="input"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={loading}
              maxLength={60}
              required
            />
          </div>

          <div>
            <label className="label">Intent</label>
            <textarea
              className="textarea h-20 resize-none"
              value={intent}
              onChange={e => setIntent(e.target.value)}
              disabled={loading}
              maxLength={200}
              required
            />
          </div>

          <div>
            <label className="label">Methodology</label>
            <select
              className="select"
              value={methodology}
              onChange={e => setMethodology(e.target.value)}
              disabled={loading}
            >
              <option value="standard">Standard (Summarization focus)</option>
              <option value="feynman">Feynman Technique (Teach back)</option>
              <option value="socratic">Socratic Method (Challenge assumptions)</option>
            </select>
          </div>

          <div>
            <label className="label">Target Pace (Days)</label>
            <input
              type="number"
              className="input"
              min="1"
              placeholder="Leave blank for no target"
              value={targetDurationDays}
              onChange={e => setTargetDurationDays(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded p-2.5">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
