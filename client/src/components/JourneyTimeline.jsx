import React from 'react';

export default function JourneyTimeline({ space }) {
  const doneItems = [];
  (space?.stages || []).forEach(s => {
    (s.items || []).forEach(i => {
      if (i.status === 'done' || i.status === 'done_quick') doneItems.push(i);
    });
  });

  doneItems.sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at));

  if (doneItems.length === 0) {
    return <div className="py-12 text-center text-sm text-zinc-400">No items completed yet.</div>;
  }

  return (
    <div className="py-12 overflow-x-auto hide-scrollbar">
      <div className="flex items-start min-w-max px-4 relative">
        <div className="absolute left-16 right-16 top-[11px] h-px bg-zinc-200 dark:bg-zinc-800" />
        {doneItems.map((item, idx) => {
          const d = new Date(item.updated_at);
          const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          return (
            <div key={item.id} className="relative flex flex-col items-center w-32 shrink-0 group cursor-default">
              <div className="w-6 h-6 rounded-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-300 dark:border-zinc-700 flex items-center justify-center z-10 group-hover:border-zinc-500 dark:group-hover:border-zinc-500 transition-colors">
                <div className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-700 group-hover:bg-zinc-500 dark:group-hover:bg-zinc-500 transition-colors" />
              </div>
              <div className="mt-4 text-center px-2">
                <div className="text-[10px] text-zinc-400 font-medium mb-1.5 uppercase tracking-wider">{dateStr}</div>
                <div className="text-xs text-zinc-700 dark:text-zinc-300 line-clamp-3 leading-snug">{item.title}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
