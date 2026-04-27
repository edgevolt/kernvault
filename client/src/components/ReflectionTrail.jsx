import React, { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function ReflectionTrail({ spaceId }) {
  const [trail, setTrail] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getSpaceTrail(spaceId)
      .then(data => setTrail(data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [spaceId]);

  if (loading) return <div className="py-12 text-center text-sm text-zinc-400">Loading trail...</div>;
  if (trail.length === 0) return <div className="py-12 text-center text-sm text-zinc-400">No reflections or notes yet. Start processing items to build your trail.</div>;

  return (
    <div className="space-y-8 py-6 relative max-w-xl">
      <div className="absolute left-[11px] top-8 bottom-4 w-px bg-zinc-200 dark:bg-zinc-800" />
      {trail.map((entry, idx) => {
        const d = new Date(entry.created_at);
        const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const isReflection = entry.type === 'reflection';
        
        return (
          <div key={`${entry.item_id}-${idx}`} className="relative pl-10">
            <div className={`absolute left-0 top-1 w-[23px] h-[23px] rounded-full border-4 border-zinc-50 dark:border-zinc-950 flex items-center justify-center
              ${isReflection ? 'bg-zinc-800 dark:bg-zinc-200' : 'bg-zinc-300 dark:bg-zinc-700'}`} 
            />
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{dateStr}</span>
              <span className="text-xs text-zinc-300 dark:text-zinc-700">—</span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate" title={entry.item_title}>{entry.item_title}</span>
            </div>
            <div className={`text-sm leading-relaxed whitespace-pre-wrap ${isReflection ? 'text-zinc-900 dark:text-zinc-100 font-medium' : 'text-zinc-700 dark:text-zinc-300'}`}>
              {entry.body}
            </div>
          </div>
        );
      })}
    </div>
  );
}
