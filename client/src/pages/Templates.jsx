import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

const DEFAULT_TEMPLATES = [
  {
    name: 'Book Deep-Dive',
    description: 'Three-stage arc for working through a non-fiction book with intent and recall.',
    stages: ['Orientation', 'Deep Reading', 'Synthesis'],
  },
  {
    name: 'Online Course',
    description: 'Follow along with any structured online course or tutorial series.',
    stages: ['Foundations', 'Core Concepts', 'Applied Projects', 'Review'],
  },
  {
    name: 'Research Paper Stack',
    description: 'Process a batch of related papers with shared themes.',
    stages: ['Context & Background', 'Core Papers', 'Critical Review'],
  },
];

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getTemplates()
      .then(data => setTemplates(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const t = await api.createTemplate({ name: newName.trim(), description: newDesc.trim() });
      setTemplates(prev => [t, ...prev]);
      setNewName(''); setNewDesc(''); setShowNew(false);
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this template?')) return;
    await api.deleteTemplate(id);
    setTemplates(prev => prev.filter(t => t.id !== id));
  }

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950">
      <header className="top-bar">
        <Link to="/" className="btn-ghost btn-sm px-2">← Back</Link>
        <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 mx-auto">Templates</span>
        <button className="btn-primary btn-sm" onClick={() => setShowNew(v => !v)} id="templates-new-btn">New</button>
      </header>

      <main className="pt-20 max-w-2xl mx-auto px-4 pb-20">
        <h1 className="sr-only">Space Templates</h1>

        {showNew && (
          <div className="card p-5 mb-6 space-y-3 animate-fade-in">
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">New template</p>
            <input className="input text-sm w-full" placeholder="Template name" value={newName}
              onChange={e => setNewName(e.target.value)} autoFocus />
            <textarea className="textarea text-sm w-full" rows={2} placeholder="Description (optional)"
              value={newDesc} onChange={e => setNewDesc(e.target.value)} />
            <div className="flex gap-2">
              <button className="btn-ghost flex-1 text-sm" onClick={() => setShowNew(false)}>Cancel</button>
              <button className="btn-primary flex-1 text-sm" onClick={handleCreate} disabled={!newName.trim() || saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {/* Built-in defaults */}
        <section className="mb-8">
          <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 mb-3">Built-in</p>
          <div className="space-y-2">
            {DEFAULT_TEMPLATES.map(t => (
              <Link key={t.name} to={`/spaces/new?template=${encodeURIComponent(t.name)}`}
                className="flex items-start gap-4 card px-4 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                <div className="flex-1">
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{t.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{t.description}</p>
                  <div className="flex gap-1.5 mt-2">
                    {t.stages.map(s => (
                      <span key={s} className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded px-1.5 py-0.5">{s}</span>
                    ))}
                  </div>
                </div>
                <span className="text-zinc-300 dark:text-zinc-700 text-sm">›</span>
              </Link>
            ))}
          </div>
        </section>

        {/* User templates */}
        {!loading && templates.length > 0 && (
          <section>
            <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 mb-3">Saved</p>
            <div className="space-y-2">
              {templates.map(t => (
                <div key={t.id} className="flex items-center gap-3 card px-4 py-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{t.name}</p>
                    {t.description && <p className="text-xs text-zinc-500 mt-0.5">{t.description}</p>}
                  </div>
                  <button onClick={() => handleDelete(t.id)}
                    className="text-zinc-300 hover:text-red-400 transition-colors px-2 text-lg">×</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {loading && <div className="text-center py-12 text-sm text-zinc-400">Loading…</div>}
      </main>
    </div>
  );
}
