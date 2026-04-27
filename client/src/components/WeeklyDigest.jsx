import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function WeeklyDigest({ onClose }) {
  const [stats, setStats] = useState(null);
  
  useEffect(() => {
    api.getDigest()
      .then(setStats)
      .catch(console.error);
  }, []);

  if (!stats) return null;

  // Only show if there was some activity
  if (stats.completed_items === 0 && stats.recall_sessions === 0 && stats.notes_added === 0) {
    onClose();
    return null;
  }

  return (
    <div className="fixed inset-0 bg-zinc-50 dark:bg-zinc-950 z-50 flex items-center justify-center p-6 animate-fade-in">
      <div className="max-w-md w-full space-y-8">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Weekly Digest</p>
          <h1 className="text-3xl font-medium text-zinc-900 dark:text-zinc-100 leading-tight">
            Here's what you explored last week.
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50">
            <span className="block text-3xl font-light text-zinc-900 dark:text-zinc-100 mb-1">{stats.completed_items}</span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Items finished</span>
          </div>
          <div className="p-5 rounded-2xl bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50">
            <span className="block text-3xl font-light text-zinc-900 dark:text-zinc-100 mb-1">{stats.recall_sessions}</span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Recall sessions</span>
          </div>
          <div className="col-span-2 p-5 rounded-2xl bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50">
            <span className="block text-3xl font-light text-zinc-900 dark:text-zinc-100 mb-1">{stats.notes_added}</span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Thoughts & notes captured</span>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="btn-primary w-full py-4 text-base mt-4"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
