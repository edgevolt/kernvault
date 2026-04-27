import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { useStore } from '../store/useStore';
import Tour from '../components/Tour';

function RecallSession({ item, onComplete, isPractice }) {
  const [step, setStep] = useState('prompt'); // 'prompt', 'reveal', 'transition'
  const [response, setResponse] = useState('');
  const [notes, setNotes] = useState([]);
  const [saving, setSaving] = useState(false);

  const daysAgo = Math.floor((Date.now() - new Date(item.updated_at).getTime()) / (1000 * 60 * 60 * 24));

  async function handleRemember() {
    if (response.trim().length === 0) return;
    setStep('reveal');
    try {
      const data = await api.getNotes(item.id);
      setNotes(data || []);
    } catch (e) { console.error(e); }
  }

  async function handleOutcome(outcome) {
    setSaving(true);
    try {
      await api.submitRecallSession(item.id, { response, outcome, isPractice });
      setStep('transition');
      setTimeout(() => {
        onComplete(item.id);
      }, 1000);
    } catch (e) {
      alert('Error saving session');
      setSaving(false);
    }
  }

  // Handle Skip directly from prompt
  async function handleSkip() {
    setSaving(true);
    try {
      await api.submitRecallSession(item.id, { response: '', outcome: 'skip', isPractice });
      setStep('transition');
      setTimeout(() => {
        onComplete(item.id);
      }, 1000);
    } catch (e) {
      alert('Error saving session');
      setSaving(false);
    }
  }

  if (step === 'transition') {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
        <p className="text-sm font-medium text-zinc-500 uppercase tracking-widest">
          {isPractice ? 'Practice Recorded' : 'Recorded'}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      {isPractice && (
        <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs text-center py-2 px-4 rounded-md">
          Practice recall — won't affect your recall schedule
        </div>
      )}
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-medium text-zinc-900 dark:text-zinc-100 mb-2 leading-snug">{item.title}</h2>
        <p className="text-[11px] text-zinc-500 uppercase tracking-widest font-medium mb-1">
          {item.space_name} <span className="mx-1 opacity-50">/</span> {item.stage_name}
        </p>
        <p className="text-sm text-zinc-400">Processed {daysAgo} day{daysAgo !== 1 ? 's' : ''} ago</p>
      </div>

      {step === 'prompt' && (
        <div id="recall-prompt" className="card p-6 animate-fade-in">
          <p className="text-sm text-zinc-700 dark:text-zinc-300 font-medium mb-4">
            Without looking it up — what do you remember about this?
          </p>
          <textarea
            className="textarea w-full h-32 mb-6"
            value={response}
            onChange={e => setResponse(e.target.value)}
            placeholder="I remember that..."
          />
          <div className="flex justify-between items-center gap-4">
            <button className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors" onClick={handleSkip} disabled={saving}>
              Skip for now
            </button>
            <button className="btn-primary min-w-[120px]" disabled={response.trim().length === 0 || saving} onClick={handleRemember}>
              I remember
            </button>
          </div>
        </div>
      )}

      {step === 'reveal' && (
        <div className="space-y-8 animate-fade-in">
          {/* User's response */}
          <div className="card p-6 border-l-4 border-l-zinc-800 dark:border-l-zinc-200">
            <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-medium mb-2">Your recall attempt</p>
            <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">{response}</p>
          </div>

          <div className="border-t border-zinc-200 dark:border-zinc-800" />

          {/* Original Content */}
          <div className="px-2">
            <h3 className="text-[10px] uppercase tracking-widest text-zinc-400 font-medium mb-6">Original Material</h3>
            {item.reflection && (
              <div className="mb-8">
                <p className="text-xs uppercase tracking-wider font-medium text-zinc-500 mb-2">Reflection</p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 italic border-l-2 border-zinc-200 dark:border-zinc-700 pl-4">"{item.reflection}"</p>
              </div>
            )}
            {notes.filter(n => n.source !== 'reflection').map(n => (
              <div key={n.id} className="mb-6">
                <p className="text-xs uppercase tracking-wider font-medium text-zinc-500 mb-2">{n.source.replace('_', ' ')} Note</p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{n.body}</p>
              </div>
            ))}
            {!item.reflection && notes.length === 0 && (
              <p className="text-sm text-zinc-500 italic">No notes were saved for this item.</p>
            )}
          </div>

          {/* Outcome selection */}
          <div className="card p-6 bg-zinc-100 dark:bg-zinc-800/50 mt-12 text-center">
            <p className="font-medium text-zinc-800 dark:text-zinc-200 mb-6">How did you do?</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto">
              <button className="btn-ghost border border-zinc-300 dark:border-zinc-700 flex-1" onClick={() => handleOutcome('needs_another_look')} disabled={saving}>
                Needs another look
              </button>
              <button className="btn-ghost border border-zinc-300 dark:border-zinc-700 flex-1" onClick={() => handleOutcome('skip')} disabled={saving}>
                Move on
              </button>
              <button className="btn-primary flex-1" onClick={() => handleOutcome('got_it')} disabled={saving}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RecallView() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const settings       = useStore(s => s.settings);
  const markTourSeen   = useStore(s => s.markTourSeen);
  
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const filterSpaceId = searchParams.get('space_id');
  const manualItemId = searchParams.get('item_id');

  useEffect(() => {
    api.getRecallQueue(manualItemId)
      .then(data => {
        if (filterSpaceId) {
          setQueue(data.filter(i => i.space_id === filterSpaceId));
        } else {
          setQueue(data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filterSpaceId, manualItemId]);

  if (loading) return <div className="min-h-dvh pt-24 text-center text-sm text-zinc-500">Loading queue...</div>;

  const currentItem = queue[0];

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 pb-20">
      <header className="top-bar">
        <Link to={filterSpaceId ? `/spaces/${filterSpaceId}` : "/"} className="btn-ghost btn-sm px-2">← Back</Link>
        <div className="flex-1 text-center">
          <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">
            Recall Queue {queue.length > 0 ? `(${queue.length})` : ''}
          </span>
        </div>
        <Link to="/search" className="btn-ghost btn-sm px-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" aria-label="Search" title="Search (/)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </Link>
      </header>

      <main className="pt-24 px-4">
        {!settings.onboarding?.recallTourSeen && !!currentItem && (
          <Tour
            run={true}
            steps={[
              {
                target: '#recall-prompt-area',
                title: 'Active Recall',
                content: 'Kernvault uses Spaced Repetition. Instead of passively re-reading, try to remember the core concepts. This strengthens your memory more effectively.',
                disableBeacon: false,
                placement: 'bottom'
              }
            ]}
            onFinish={() => markTourSeen('recallTourSeen')}
          />
        )}
        {currentItem ? (
          <RecallSession 
            key={currentItem.id} 
            item={currentItem} 
            isPractice={!!manualItemId}
            onComplete={(id) => setQueue(q => q.filter(i => i.id !== id))} 
          />
        ) : (
          <div className="max-w-md mx-auto text-center py-20 animate-fade-in">
            <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-3">You're all caught up.</h2>
            <p className="text-sm text-zinc-500">
              Nothing to recall right now. Check back after you've processed some items.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
